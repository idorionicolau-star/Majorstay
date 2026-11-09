export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { calculateStayPricing, normalizeDate } from '@/lib/hospitality-calc';
import { nextGuideNumber } from '@/lib/sale-plan';
import type { Sale } from '@/lib/types';

/**
 * Endpoint de Check-out de Estadias (MajorStay).
 *
 * Executado no servidor para garantir:
 * 1. Proteção anti-roubo: carimbo de data/hora oficial do servidor, impossibilitando
 *    que funcionários atrasem o relógio do computador para ocultar horas excedidas.
 * 2. Cálculo correto de horas faturadas (hora começada = hora paga; mínimo de horas contratadas).
 * 3. Integração automática com o Caixa (criação de registo de Venda a Dinheiro correspondente).
 * 4. Registo de auditoria imutável (hospitalityAudit).
 */

async function authorizeUser(req: Request, companyId: string) {
  const decoded = (await verifyIdToken(req)) as any;
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

  let employeeName = decoded.name || decoded.email || 'Rececionista';
  let isAuthorized = decoded.superAdmin === true;

  if (!isAuthorized) {
    const employeeDoc = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
    if (employeeDoc.exists) {
      const empData = employeeDoc.data() || {};
      employeeName = empData.username || employeeName;
      const role = empData.role;
      const perm = empData.permissions?.rooms;
      if (['Admin', 'Dono'].includes(role) || perm === 'write') {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return { error: NextResponse.json({ error: 'Sem permissão para encerrar estadias neste alojamento.' }, { status: 403 }) };
  }

  return { decoded, employeeName, db, admin };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, stayId, roomId, amountPaid: customAmountPaid, paymentMethod = 'Dinheiro', notes = '', roomNextStatus = 'cleaning' } = body;

    if (!companyId || !stayId || !roomId) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios em falta: companyId, stayId, roomId.' }, { status: 400 });
    }

    const auth = await authorizeUser(req, companyId);
    if ('error' in auth) return auth.error;
    const { decoded, employeeName, db, admin } = auth;

    const stayRef = db.doc(`companies/${companyId}/stays/${stayId}`);
    const roomRef = db.doc(`companies/${companyId}/rooms/${roomId}`);
    const companyRef = db.doc(`companies/${companyId}`);

    // Execução em transação atómica para evitar concorrência ou encerramento duplo
    const result = await db.runTransaction(async (transaction) => {
      const staySnap = await transaction.get(stayRef);
      if (!staySnap.exists) {
        throw new Error('Estadia não encontrada.');
      }
      const stayData = staySnap.data() || {};
      if (stayData.status !== 'open') {
        throw new Error('Esta estadia já se encontra encerrada.');
      }

      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists) {
        throw new Error('Quarto associado não encontrado.');
      }
      const roomData = roomSnap.data() || {};

      const companySnap = await transaction.get(companyRef);
      const companyData = (companySnap.exists ? companySnap.data() : {}) || {};

      // Carimbo oficial do servidor
      const serverNow = new Date();
      const checkInDate = normalizeDate(stayData.checkInAt);
      const contractedHours = Number(stayData.contractedHours) || 1;
      const ratePerHour = Number(stayData.ratePerHourApplied || roomData.ratePerHour || 0);

      const pricing = calculateStayPricing({
        checkInAt: checkInDate,
        checkOutAt: serverNow,
        contractedHours,
        ratePerHour,
        graceMinutes: 10,
        consumptions: stayData.consumptions || [],
      });

      const totalAmountDue = pricing.totalAmountDue;
      const finalAmountPaid = typeof customAmountPaid === 'number' && !isNaN(customAmountPaid)
        ? customAmountPaid
        : totalAmountDue;

      // Numeração de documento oficial (Venda a Dinheiro)
      const { guideNumber, saleCounter, numberingUpdate } = nextGuideNumber(companyData, 'Venda a Dinheiro');

      // 1. Criar registo de Venda no Caixa
      const saleRef = db.collection(`companies/${companyId}/sales`).doc();
      const checkInStr = checkInDate.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
      const checkOutStr = serverNow.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
      const consumptionsCount = (stayData.consumptions || []).length;
      const consumptionsText = consumptionsCount > 0
        ? ` | Consumos do Bar (${consumptionsCount} itens, ${pricing.consumptionsAmountDue} MT): ` +
          stayData.consumptions.map((c: any) => `${c.quantity}x ${c.productName} (${c.totalPrice} MT)`).join(', ')
        : '';
      const staySummaryNote = `Quarto: ${stayData.roomName || roomData.name}. Entrada: ${checkInStr}. Saída: ${checkOutStr}. Horas: ${pricing.billedHours}h (${pricing.stayAmountDue} MT)${consumptionsText}. ${notes}`.trim();

      const newSale: Omit<Sale, 'id'> = {
        date: serverNow.toISOString().slice(0, 10),
        productId: roomId,
        productName: `Estadia: ${stayData.roomName || roomData.name || 'Quarto'}${consumptionsCount > 0 ? ' + Consumos Bar' : ''}`,
        quantity: pricing.billedHours,
        unit: 'horas',
        unitPrice: pricing.ratePerHour,
        subtotal: totalAmountDue,
        totalValue: totalAmountDue,
        amountPaid: finalAmountPaid,
        soldBy: employeeName,
        guideNumber,
        location: roomData.name || 'Geral',
        status: 'Pago',
        documentType: 'Venda a Dinheiro',
        clientName: stayData.clientName || 'Hóspede Particular',
        paymentMethod,
        notes: staySummaryNote,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      };

      transaction.set(saleRef, newSale);

      // 2. Atualizar numeração da empresa
      transaction.update(companyRef, {
        saleCounter,
        ...numberingUpdate,
      });

      // 3. Atualizar a estadia como fechada
      transaction.update(stayRef, {
        status: 'closed',
        checkOutAt: admin.firestore.FieldValue.serverTimestamp(),
        billedHours: pricing.billedHours,
        totalAmountDue,
        totalAmountPaid: finalAmountPaid,
        paymentMethod,
        closedBy: decoded.uid,
        closedByName: employeeName,
        saleId: saleRef.id,
        notes: notes ? `${stayData.notes ? stayData.notes + ' | ' : ''}${notes}` : (stayData.notes || ''),
      });

      // 4. Atualizar status do quarto (cleaning ou free)
      const validNextStatus = roomNextStatus === 'free' ? 'free' : 'cleaning';
      transaction.update(roomRef, {
        status: validNextStatus,
        currentStayId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Registar auditoria de hotelaria
      const auditRef = db.collection(`companies/${companyId}/hospitalityAudit`).doc();
      transaction.set(auditRef, {
        action: 'close_stay',
        targetId: stayId,
        targetType: 'stay',
        before: {
          status: stayData.status,
          checkInAt: stayData.checkInAt,
          contractedHours: stayData.contractedHours,
          ratePerHourApplied: stayData.ratePerHourApplied,
        },
        after: {
          status: 'closed',
          billedHours: pricing.billedHours,
          totalAmountDue,
          totalAmountPaid: finalAmountPaid,
          paymentMethod,
          saleId: saleRef.id,
        },
        reason: 'Check-out efetuado no servidor com sucesso',
        userId: decoded.uid,
        userName: employeeName,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        companyId,
      });

      return {
        stayId,
        saleId: saleRef.id,
        guideNumber,
        pricing,
        finalAmountPaid,
        paymentMethod,
        roomStatus: validNextStatus,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Check-out efetuado com sucesso.',
      data: result,
    });
  } catch (err: any) {
    console.error('Erro no checkout de estadia:', err);
    return NextResponse.json(
      { error: err.message || 'Ocorreu um erro ao processar o check-out.' },
      { status: 400 }
    );
  }
}
