export const dynamic = 'force-dynamic';

import { KITCHEN_ENABLED, isKitchenProduct } from '@/lib/features';
import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import type { StayConsumptionItem } from '@/lib/types';
import { contractedStayAmount } from '@/lib/hospitality-calc';

interface AuthorizeResult {
  decoded: { uid: string; email?: string; name?: string; superAdmin?: boolean; companyId?: string };
  employeeName: string;
  role: string;
  isAdminOrOwner: boolean;
  db: FirebaseFirestore.Firestore;
  admin: ReturnType<typeof initializeAdmin>;
}

async function authorizeUser(req: Request, companyId: string, kitchenOrderOnly = false): Promise<{ error: NextResponse } | AuthorizeResult> {
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
      // O Dono só vê (não lança nem apaga consumos). A cozinha só pode entregar pedidos de hóspedes.
      if (role === 'Admin' || perm === 'write' || (kitchenOrderOnly && empData.permissions?.['raw-materials'] === 'write')) {
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
  serviceId?: string;
  isService?: boolean;
  productName?: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
  weightKg?: number;
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
      orderId,
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

    const auth = await authorizeUser(req, companyId, action === 'add' && typeof orderId === 'string' && orderId.length > 0);
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

      let orderRef: FirebaseFirestore.DocumentReference | null = null;
      let orderData: Record<string, any> = {};
      const currentConsumptions: StayConsumptionItem[] = stayData.consumptions || [];
      const underStockNotes: string[] = [];
      let updatedConsumptions: StayConsumptionItem[] = [];

      if (action === 'add') {
        let addItems: AddItemPayload[] = Array.isArray(items) ? (items as AddItemPayload[]) : [];

        // Confirmação de um pedido do hóspede: os itens vêm do próprio pedido (nunca do navegador)
        // e o pedido passa a "confirmado" na MESMA transacção, para não se cobrar duas vezes.
        if (orderId) {
          if (typeof orderId !== 'string') throw new Error('Pedido inválido.');
          orderRef = db.doc(`companies/${companyId}/roomOrders/${orderId}`);
          const orderSnap = await transaction.get(orderRef);
          if (!orderSnap.exists) throw new Error('Pedido não encontrado.');
          orderData = orderSnap.data() || {};
          if (orderData.status !== 'pending') throw new Error('Este pedido já foi tratado.');
          if (orderData.stayId !== stayId) throw new Error('Este pedido pertence a outra estadia.');
          addItems = ((orderData.items as any[]) || []).map((it) => ({
            productId: it.productId,
            productName: it.productName,
            quantity: it.quantity,
            notes: it.notes,
            weightKg: it.weightKg,
          }));
        }

        if (addItems.length === 0) {
          throw new Error('Lista de itens a lançar está vazia.');
        }

        // O Firestore exige todas as leituras antes de qualquer escrita: ler já todos os produtos e serviços.
        const productSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>();
        const productIds = Array.from(
          new Set(
            addItems
              .map((it) => (typeof it.productId === 'string' ? it.productId.trim() : ''))
              .filter((id) => id !== '')
          )
        );
        const snaps = await Promise.all(productIds.map((id) => transaction.get(db.doc(`companies/${companyId}/products/${id}`))));
        productIds.forEach((id, idx) => productSnaps.set(id, snaps[idx]));

        // Leitura prévia dos serviços cadastrados (se existirem)
        const serviceSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>();
        const serviceIds = Array.from(
          new Set(
            addItems
              .map((it) => (typeof it.serviceId === 'string' ? it.serviceId.trim() : ''))
              .filter((id) => id !== '')
          )
        );
        if (serviceIds.length > 0) {
          const sSnaps = await Promise.all(serviceIds.map((id) => transaction.get(db.doc(`companies/${companyId}/services/${id}`))));
          serviceIds.forEach((id, idx) => serviceSnaps.set(id, sSnaps[idx]));
        }

        // Leitura prévia dos ingredientes de pratos (se existirem) ainda antes de qualquer escrita
        const rawIngredientIds: string[] = [];
        productSnaps.forEach((snap) => {
          if (snap.exists) {
            const d = snap.data() || {};
            if (d.isDish && d.rawIngredientId && typeof d.rawIngredientId === 'string') {
              const cleanRaw = d.rawIngredientId.trim();
              if (cleanRaw && !productSnaps.has(cleanRaw)) {
                rawIngredientIds.push(cleanRaw);
              }
            }
          }
        });
        if (rawIngredientIds.length > 0) {
          const uniqueRaw = Array.from(new Set(rawIngredientIds));
          const rawSnaps = await Promise.all(uniqueRaw.map((id) => transaction.get(db.doc(`companies/${companyId}/products/${id}`))));
          uniqueRaw.forEach((id, idx) => productSnaps.set(id, rawSnaps[idx]));
        }

        const runningStock = new Map<string, number>();

        const newItems: StayConsumptionItem[] = [];

        for (let i = 0; i < addItems.length; i++) {
          const rawItem = addItems[i] as AddItemPayload;
          const qty = rawItem.quantity;

          // Validação da quantidade: inteira entre 1 e 100
          if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 100) {
            throw new Error(`Quantidade inválida para o item "${rawItem.productName || i + 1}". Deve ser um número inteiro entre 1 e 100.`);
          }

          let resolvedUnitPrice = 0;
          let weighedKg: number | undefined;
          let resolvedProductName = (rawItem.productName || '').trim();
          let rawDeductionRecord: StayConsumptionItem['rawDeduction'] = undefined;
          let isService = Boolean(rawItem.isService);
          let resolvedServiceId: string | undefined = undefined;

          if (rawItem.productId && typeof rawItem.productId === 'string' && rawItem.productId.trim() !== '') {
            // Produto do catálogo: lê da base de dados e ignora o unitPrice do cliente
            const prodRef = db.doc(`companies/${companyId}/products/${rawItem.productId.trim()}`);
            const prodSnap = productSnaps.get(rawItem.productId.trim());
            if (!prodSnap || !prodSnap.exists) {
              throw new Error(`Produto não encontrado no catálogo (ID: ${rawItem.productId}).`);
            }
            const prodData = prodSnap.data() || {};
            const catalogPrice = Number(prodData.price !== undefined ? prodData.price : prodData.salePrice);
            if (!Number.isFinite(catalogPrice) || catalogPrice < 0) {
              throw new Error(`Preço inválido no catálogo para o produto "${prodData.name || rawItem.productId}".`);
            }

            resolvedUnitPrice = catalogPrice;
            resolvedProductName = prodData.name || resolvedProductName || 'Produto do Bar';

            if (!KITCHEN_ENABLED && isKitchenProduct(prodData)) {
              throw new Error(`"${resolvedProductName}" não está disponível (a cozinha está desativada).`);
            }
            const isDish = Boolean(prodData.isDish);
            if (prodData.soldByWeight) {
              const w = Number(rawItem.weightKg);
              if (!Number.isFinite(w) || w < 0.1 || w > 50) {
                throw new Error(`Indique o peso (kg) de "${resolvedProductName}".`);
              }
              weighedKg = Math.round(w * 1000) / 1000;
            }
            const rawIngId = prodData.rawIngredientId ? String(prodData.rawIngredientId).trim() : '';
            const rawSnap = rawIngId ? productSnaps.get(rawIngId) : null;

            if (isDish && rawIngId && rawSnap && rawSnap.exists) {
              // --- PRATO CONFECIONADO: Abate matéria-prima alimentar em Kg na câmara fria/despensa ---
              const rawData = rawSnap.data() || {};
              const rawRef = db.doc(`companies/${companyId}/products/${rawIngId}`);
              const rawUnit = String(rawData.unit || 'kg').toLowerCase();
              const portionQty = Number(prodData.rawQuantityPerPortion) || 0.3; // ex: 300g por dose
              const customWeight = weighedKg && rawUnit === 'kg' ? weighedKg : undefined; // venda ao peso abate o peso servido
              const totalDeducted = customWeight ? customWeight : Math.round(portionQty * qty * 1000) / 1000;

              const currentRawStock = runningStock.has(rawIngId) ? (runningStock.get(rawIngId) as number) : Number(rawData.stock) || 0;
              const newRawStock = Math.max(0, Math.round((currentRawStock - totalDeducted) * 1000) / 1000);

              if (currentRawStock < totalDeducted) {
                underStockNotes.push(
                  `Stock de cozinha insuficiente em "${rawData.name || 'Alimento'}": restavam ${currentRawStock} ${rawUnit}, pedido consumiu ${totalDeducted} ${rawUnit}.`
                );
              }

              runningStock.set(rawIngId, newRawStock);
              transaction.update(rawRef, {
                stock: newRawStock,
                lastUpdated: new Date().toISOString(),
              });

              // Movimento de saída do ingrediente alimentar em kg
              const rawMoveRef = db.collection(`companies/${companyId}/stockMovements`).doc();
              transaction.set(rawMoveRef, {
                productId: rawIngId,
                productName: rawData.name || 'Ingrediente Alimentar',
                type: 'OUT',
                quantity: -totalDeducted,
                fromLocationId: rawData.location || 'Cozinha',
                reason: `Confecção de ${qty}x ${resolvedProductName} (Quarto ${stayData.roomName || ''})`,
                userId: decoded.uid,
                userName: employeeName,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
              });

              rawDeductionRecord = {
                ingredientId: rawIngId,
                ingredientName: String(rawData.name || 'Alimento').trim(),
                quantityDeducted: totalDeducted,
                unit: rawUnit,
              };
            } else {
              // --- PRODUTO CONVENCIONAL DE PRATELEIRA / BAR ---
              const stockKey = rawItem.productId.trim();
              const currentStock = runningStock.has(stockKey) ? (runningStock.get(stockKey) as number) : Number(prodData.stock) || 0;
              let newStock = currentStock - qty;

              if (currentStock < qty) {
                newStock = 0;
                const diff = qty - Math.max(0, currentStock);
                underStockNotes.push(
                  `Stock insuficiente em "${resolvedProductName}": stock era ${currentStock}, pedido ${qty}. Abatido até 0 (diferença de ${diff} unidades em falta)`
                );
              }

              runningStock.set(stockKey, newStock);
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
            }
          } else if (rawItem.serviceId && typeof rawItem.serviceId === 'string' && rawItem.serviceId.trim() !== '') {
            // Serviço oficial cadastrado no alojamento (Lavandaria, Massagem, Transfers, etc.)
            const srvId = rawItem.serviceId.trim();
            const srvSnap = serviceSnaps.get(srvId);
            if (!srvSnap || !srvSnap.exists) {
              throw new Error(`Serviço não encontrado (ID: ${srvId}).`);
            }
            const srvData = srvSnap.data() || {};
            const servicePrice = Number(srvData.price);
            if (!Number.isFinite(servicePrice) || servicePrice < 0) {
              throw new Error(`Preço inválido para o serviço "${srvData.name || srvId}".`);
            }
            resolvedUnitPrice = servicePrice;
            resolvedProductName = srvData.name || resolvedProductName || 'Serviço de Hotelaria';
            isService = true;
            resolvedServiceId = srvId;
          } else {
            // Item livre (sem productId e sem serviceId): apenas Admin ou Dono
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

          const totalPrice = weighedKg ? Math.round(weighedKg * resolvedUnitPrice * 100) / 100 : qty * resolvedUnitPrice;
          const consumptionItem: StayConsumptionItem = {
            id: `cons-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            productId: rawItem.productId || undefined,
            serviceId: resolvedServiceId,
            isService: isService || Boolean(resolvedServiceId),
            productName: resolvedProductName,
            quantity: qty,
            unitPrice: resolvedUnitPrice,
            totalPrice,
            addedAt: new Date().toISOString(),
            addedBy: decoded.uid,
            addedByName: employeeName,
            ...(orderRef ? { orderId: orderRef.id } : {}),
            ...(rawItem.notes ? { notes: String(rawItem.notes).trim() } : {}),
            ...(weighedKg ? { weightKg: weighedKg } : {}),
            ...(rawDeductionRecord ? { rawDeduction: rawDeductionRecord } : {}),
          };

          newItems.push(consumptionItem);
        }

        updatedConsumptions = [...currentConsumptions, ...newItems];

        if (orderRef) {
          transaction.update(orderRef, {
            status: 'confirmed',
            resolvedAt: new Date().toISOString(),
            resolvedBy: decoded.uid,
            resolvedByName: employeeName,
            consumptionIds: newItems.map((c) => c.id),
          });
        }
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

        // Devolução de matéria-prima alimentar em Kg (se foi prato com dedução de cozinha)
        if (targetItem.rawDeduction) {
          const rawId = targetItem.rawDeduction.ingredientId;
          const rawRef = db.doc(`companies/${companyId}/products/${rawId}`);
          const rawSnap = await transaction.get(rawRef);
          if (rawSnap.exists) {
            const rawData = rawSnap.data() || {};
            const currentStock = Number(rawData.stock) || 0;
            const returnQty = targetItem.rawDeduction.quantityDeducted;
            const newStock = Math.round((currentStock + returnQty) * 1000) / 1000;

            transaction.update(rawRef, {
              stock: newStock,
              lastUpdated: new Date().toISOString(),
            });

            // Registar movimento de entrada/devolução do alimento em kg
            const movementRef = db.collection(`companies/${companyId}/stockMovements`).doc();
            transaction.set(movementRef, {
              productId: rawId,
              productName: targetItem.rawDeduction.ingredientName,
              type: 'IN',
              quantity: returnQty,
              toLocationId: rawData.location || 'Cozinha',
              reason: `Devolução por cancelamento de confecção (Estadia ${stayId}): ${cleanReason}`,
              userId: decoded.uid,
              userName: employeeName,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        } else if (targetItem.productId) {
          // Devolução de stock convencional se o item tiver productId
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
      const stayHoursTotal = contractedStayAmount(stayData as any);
      const newTotalDue = stayHoursTotal + consumptionsTotal;

      transaction.update(stayRef, {
        consumptions: updatedConsumptions,
        totalAmountDue: newTotalDue,
      });

      // Registar na auditoria de hotelaria
      const auditRef = db.collection(`companies/${companyId}/hospitalityAudit`).doc();
      const auditReason = action === 'add'
        ? `${orderRef ? `Confirmação do pedido do hóspede ${orderRef.id}: ` : 'Lançamento de '}${orderRef ? (orderData.items?.length || 1) : (items?.length || 1)} consumo(s) no quarto ${stayData.roomName || ''}${underStockNotes.length ? ` (${underStockNotes.join('; ')})` : ''}`
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
