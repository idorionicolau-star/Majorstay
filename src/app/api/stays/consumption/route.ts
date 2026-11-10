export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import type { StayConsumptionItem } from '@/lib/types';

interface AuthorizeResult {
  decoded: { uid: string; email?: string; name?: string; superAdmin?: boolean; companyId?: string };
  employeeName: string;
  role: string;
  isAdminOrOwner: boolean;
  db: FirebaseFirestore.Firestore;
  admin: ReturnType<typeof initializeAdmin>;
}

async function authorizeUser(req: Request, companyId: string): Promise<{ error: NextResponse } | AuthorizeResult> {
  const decoded = (await verifyIdToken(req)) as AuthorizeResult['decoded'] | null;
  if (!decoded) {
    return { error: NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 }) };
  }
  if (!companyId || typeof companyId !== 'string') {
    return { error: NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 }) };
  }
  if (!decoded.superAdmin && companyId !== decoded.companyId) {
    return { error: NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 }) };
  }

  const admin = initializeAdmin();
  const db = admin.firestore();

  let employeeName = decoded.name || decoded.email || 'Funcionário';
  let role = decoded.superAdmin ? 'Admin' : 'Funcionario';
  let isAuthorized = decoded.superAdmin === true;

  if (!decoded.superAdmin) {
    const employeeDoc = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
    if (employeeDoc.exists) {
      const empData = employeeDoc.data() || {};
      employeeName = (empData.username as string) || employeeName;
      role = (empData.role as string) || role;
      const perm = empData.permissions?.rooms;
      if (['Admin', 'Dono'].includes(role) || perm === 'write') {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return { error: NextResponse.json({ error: 'Sem permissão para gerir consumos de quartos neste alojamento.' }, { status: 403 }) };
  }

  const isAdminOrOwner = decoded.superAdmin === true || ['Admin', 'Dono'].includes(role);

  return { decoded, employeeName, role, isAdminOrOwner, db, admin };
}

interface AddItemPayload {
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice?: number;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      companyId,
      stayId,
      action,
      items,
      consumptionId,
      reason = '',
    } = body;

    if (!companyId || !stayId || !action) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios em falta: companyId, stayId, action.' },
        { status: 400 }
      );
    }

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json(
        { error: 'Ação inválida. Utilize "add" ou "remove".' },
        { status: 400 }
      );
    }

    const auth = await authorizeUser(req, companyId);
    if ('error' in auth) return auth.error;
    const { decoded, employeeName, isAdminOrOwner, db, admin } = auth;

    const stayRef = db.doc(`companies/${companyId}/stays/${stayId}`);

    const result = await db.runTransaction(async (transaction) => {
      const staySnap = await transaction.get(stayRef);
      if (!staySnap.exists) {
        throw new Error('Estadia não encontrada.');
      }
      const stayData = staySnap.data() || {};
      if (stayData.status !== 'open') {
        throw new Error('Não é possível alterar consumos: a estadia já está encerrada.');
      }

      const currentConsumptions: StayConsumptionItem[] = stayData.consumptions || [];
      const underStockNotes: string[] = [];
      let updatedConsumptions: StayConsumptionItem[] = [];

      if (action === 'add') {
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error('Lista de itens a lançar está vazia.');
        }

        const newItems: StayConsumptionItem[] = [];

        for (let i = 0; i < items.length; i++) {
          const rawItem = items[i] as AddItemPayload;
          const qty = rawItem.quantity;

          // Validação da quantidade: inteira entre 1 e 100
          if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 100) {
            throw new Error(`Quantidade inválida para o item "${rawItem.productName || i + 1}". Deve ser um número inteiro entre 1 e 100.`);
          }

          let resolvedUnitPrice = 0;
          let resolvedProductName = (rawItem.productName || '').trim();

          if (rawItem.productId && typeof rawItem.productId === 'string' && rawItem.productId.trim() !== '') {
            // Produto do catálogo: lê da base de dados e ignora o unitPrice do cliente
            const prodRef = db.doc(`companies/${companyId}/products/${rawItem.productId}`);
            const prodSnap = await transaction.get(prodRef);
            if (!prodSnap.exists) {
              throw new Error(`Produto não encontrado no catálogo (ID: ${rawItem.productId}).`);
            }
            const prodData = prodSnap.data() || {};
            const catalogPrice = Number(prodData.price !== undefined ? prodData.price : prodData.salePrice);
            if (!Number.isFinite(catalogPrice) || catalogPrice < 0) {
              throw new Error(`Preço inválido no catálogo para o produto "${prodData.name || rawItem.productId}".`);
            }

            resolvedUnitPrice = catalogPrice;
            resolvedProductName = prodData.name || resolvedProductName || 'Produto do Bar';

            // Abate de stock com suporte a multi-localização e tolerância para stock insuficiente
            const currentStock = Number(prodData.stock) || 0;
            let newStock = currentStock - qty;

            if (currentStock < qty) {
              newStock = Math.max(0, currentStock === 0 ? 0 : 0);
              const diff = qty - Math.max(0, currentStock);
              underStockNotes.push(
                `Stock insuficiente em "${resolvedProductName}": stock era ${currentStock}, pedido ${qty}. Abatido até 0 (diferença de ${diff} MTn/un em falta)`
              );
            }

            transaction.update(prodRef, {
              stock: newStock,
              lastUpdated: new Date().toISOString(),
            });

            // Registar no stockMovements
            const movementRef = db.collection(`companies/${companyId}/stockMovements`).doc();
            transaction.set(movementRef, {
              productId: rawItem.productId,
              productName: resolvedProductName,
              type: 'OUT',
              quantity: -qty,
              fromLocationId: prodData.location || 'Principal',
              reason: `Consumo Quarto ${stayData.roomName || ''} (Estadia ${stayId})`,
              userId: decoded.uid,
              userName: employeeName,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
          } else {
            // Item livre (sem productId): apenas Admin ou Dono
            if (!isAdminOrOwner) {
              throw new Error('Apenas Administradores ou Donos podem lançar itens livres sem produto associado.');
            }
            const freePrice = Number(rawItem.unitPrice);
            if (!Number.isFinite(freePrice) || freePrice <= 0) {
              throw new Error(`O preço do item livre "${resolvedProductName || 'Sem nome'}" deve ser um número maior que zero.`);
            }
            resolvedUnitPrice = freePrice;
            if (!resolvedProductName) {
              resolvedProductName = 'Serviço / Item de Bar';
            }
          }

          const totalPrice = qty * resolvedUnitPrice;
          const consumptionItem: StayConsumptionItem = {
            id: `cons-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            productId: rawItem.productId || undefined,
            productName: resolvedProductName,
            quantity: qty,
            unitPrice: resolvedUnitPrice,
            totalPrice,
            addedAt: new Date().toISOString(),
            addedBy: decoded.uid,
            addedByName: employeeName,
          };

          newItems.push(consumptionItem);
        }

        updatedConsumptions = [...currentConsumptions, ...newItems];
      } else if (action === 'remove') {
        if (!consumptionId || typeof consumptionId !== 'string') {
          throw new Error('ID do consumo a remover é obrigatório.');
        }
        const cleanReason = (reason || '').trim();
        if (!cleanReason) {
          throw new Error('O motivo da remoção do consumo é obrigatório.');
        }

        const targetIndex = currentConsumptions.findIndex((c) => c.id === consumptionId);
        if (targetIndex === -1) {
          throw new Error('Consumo não encontrado nesta estadia.');
        }
        const targetItem = currentConsumptions[targetIndex];

        // Devolução de stock se o item tiver productId
        if (targetItem.productId) {
          const prodRef = db.doc(`companies/${companyId}/products/${targetItem.productId}`);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists) {
            const prodData = prodSnap.data() || {};
            const currentStock = Number(prodData.stock) || 0;
            const newStock = currentStock + targetItem.quantity;

            transaction.update(prodRef, {
              stock: newStock,
              lastUpdated: new Date().toISOString(),
            });

            // Registar movimento de entrada
            const movementRef = db.collection(`companies/${companyId}/stockMovements`).doc();
            transaction.set(movementRef, {
              productId: targetItem.productId,
              productName: targetItem.productName,
              type: 'IN',
              quantity: targetItem.quantity,
              toLocationId: prodData.location || 'Principal',
              reason: `Devolução por remoção de consumo (Estadia ${stayId}): ${cleanReason}`,
              userId: decoded.uid,
              userName: employeeName,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        updatedConsumptions = currentConsumptions.filter((c) => c.id !== consumptionId);
      }

      // Recalcular totais no servidor
      const consumptionsTotal = updatedConsumptions.reduce((sum, c) => sum + (c.quantity * c.unitPrice), 0);
      const stayHoursTotal = (Number(stayData.contractedHours) || 1) * (Number(stayData.ratePerHourApplied) || 0);
      const newTotalDue = stayHoursTotal + consumptionsTotal;

      transaction.update(stayRef, {
        consumptions: updatedConsumptions,
        totalAmountDue: newTotalDue,
      });

      // Registar na auditoria de hotelaria
      const auditRef = db.collection(`companies/${companyId}/hospitalityAudit`).doc();
      const auditReason = action === 'add'
        ? `Lançamento de ${items?.length || 1} consumo(s) no quarto ${stayData.roomName || ''}${underStockNotes.length ? ` (${underStockNotes.join('; ')})` : ''}`
        : `Remoção de consumo: ${(reason || '').trim()}`;

      transaction.set(auditRef, {
        action: action === 'add' ? 'add_consumption' : 'remove_consumption',
        targetId: stayId,
        targetType: 'stay',
        before: {
          consumptionsCount: currentConsumptions.length,
          consumptionsTotal: currentConsumptions.reduce((s, c) => s + (c.quantity * c.unitPrice), 0),
          totalAmountDue: stayData.totalAmountDue,
        },
        after: {
          consumptionsCount: updatedConsumptions.length,
          consumptionsTotal,
          totalAmountDue: newTotalDue,
        },
        reason: auditReason,
        userId: decoded.uid,
        userName: employeeName,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        companyId,
      });

      return {
        stayId,
        consumptions: updatedConsumptions,
        consumptionsTotal,
        newTotalDue,
      };
    });

    return NextResponse.json({
      success: true,
      message: action === 'add' ? 'Consumo(s) registado(s) com sucesso.' : 'Consumo removido com sucesso.',
      data: result,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro ao processar consumos do quarto.';
    console.error('Erro em /api/stays/consumption:', errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 400 }
    );
  }
}
