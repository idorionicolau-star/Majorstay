export const dynamic = 'force-dynamic';

import { randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { priceChanged } from '@/lib/checkout-pricing';
import { planCheckIn, subscriptionBlocked } from '@/lib/stay-checkin';

/**
 * Check-in de estadias, feito no servidor.
 *
 * O computador da funcionária só diz: quarto, horas, pacote e dados do cliente. O preço, o bloco de horas, o total,
 * a hora de entrada e o PIN são calculados aqui, a partir do quarto que o administrador configurou.
 * Assim nenhuma funcionária (nem um ecrã desatualizado) consegue gravar um preço diferente do do administrador.
 */

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

async function authorizeUser(req: Request, companyId: unknown) {
  const decoded = (await verifyIdToken(req)) as any;
  if (!decoded) return { error: NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 }) };
  if (!companyId || typeof companyId !== 'string') return { error: NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 }) };
  if (!decoded.superAdmin && companyId !== decoded.companyId) return { error: NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 }) };

  const admin = initializeAdmin();
  const db = admin.firestore();
  let employeeName = decoded.name || decoded.email || 'Recepção';
  let ok = decoded.superAdmin === true;
  if (!ok) {
    const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
    if (emp.exists) {
      const d = emp.data() || {};
      employeeName = d.username || employeeName;
      // Como nas regras da base de dados: o Dono só vê; Admin ou quem tem escrita em Quartos pode abrir estadias.
      if (d.role === 'Admin' || d.permissions?.rooms === 'write') ok = true;
    }
  }
  if (!ok) return { error: NextResponse.json({ error: 'Sem permissão para fazer check-in neste alojamento.' }, { status: 403 }) };
  return { decoded, employeeName, db, admin };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, roomId } = body;
    if (!roomId || typeof roomId !== 'string') return NextResponse.json({ error: 'Quarto em falta.' }, { status: 400 });

    const auth = await authorizeUser(req, companyId);
    if ('error' in auth) return auth.error;
    const { decoded, employeeName, db, admin } = auth;

    const payAtExit = body.payAtExit === true;
    const paymentMethod = clean(body.paymentMethod, 40) || 'Dinheiro';
    const roomRef = db.doc(`companies/${companyId}/rooms/${roomId}`);
    const companyRef = db.doc(`companies/${companyId}`);
    const stayRef = db.collection(`companies/${companyId}/stays`).doc();

    const result = await db.runTransaction(async (tx) => {
      const [roomSnap, companySnap] = await Promise.all([tx.get(roomRef), tx.get(companyRef)]);
      if (!roomSnap.exists) throw Object.assign(new Error('Quarto não encontrado.'), { http: 404 });
      const room = roomSnap.data() || {};
      const company = (companySnap.exists ? companySnap.data() : {}) || {};

      if (!decoded.superAdmin && subscriptionBlocked(company, Date.now())) {
        throw Object.assign(new Error('A subscrição deste alojamento não está ativa. Contacte o administrador.'), { http: 403 });
      }
      if (room.active === false) throw Object.assign(new Error('Este quarto está desativado.'), { http: 409 });
      if (room.status !== 'free' || room.currentStayId) {
        throw Object.assign(new Error('Este quarto já não está livre. Atualize o ecrã.'), { http: 409, code: 'ROOM_NOT_FREE' });
      }

      const now = new Date();
      const plan = planCheckIn(room, { contractedHours: body.contractedHours, packageType: body.packageType }, now, company.timeZone || undefined);
      if ('error' in plan) throw Object.assign(new Error(plan.error), { http: 400 });

      // O ecrã mostrou outro valor (quarto alterado entretanto, ou ecrã antigo): não grava, para ninguém cobrar um preço que não é o do quarto.
      if (priceChanged(body.expectedTotal, plan.totalAmountDue)) {
        throw Object.assign(new Error('O preço deste quarto mudou. Feche o check-in e abra de novo para ver o valor certo.'), {
          http: 409, code: 'PRICE_CHANGED', serverTotal: plan.totalAmountDue,
        });
      }

      const accessPin = String(randomInt(100000, 1000000));
      const expectedCheckOutAt = new Date(now.getTime() + plan.contractedHours * 3600_000).toISOString();
      const ts = admin.firestore.FieldValue.serverTimestamp();
      const roomName = clean(room.name, 80) || 'Quarto';

      tx.set(stayRef, {
        roomId,
        roomName,
        clientName: clean(body.clientName, 100) || 'Hóspede Particular',
        clientPhone: clean(body.clientPhone, 30),
        clientDoc: clean(body.clientDoc, 40),
        vehiclePlate: clean(body.vehiclePlate, 15).toUpperCase(),
        vehicleBrand: clean(body.vehicleBrand, 30),
        vehicleModel: clean(body.vehicleModel, 30),
        vehicleColor: clean(body.vehicleColor, 30),
        accessPin,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        checkInAt: ts,
        expectedCheckOutAt,
        contractedHours: plan.contractedHours,
        extensions: [],
        ratePerHourApplied: plan.ratePerHourApplied,
        ...(plan.blockHours > 1 && !plan.packageType ? { blockHours: plan.blockHours } : {}),
        ...(plan.packageType ? { packageType: plan.packageType, packagePrice: plan.packagePrice, packageHours: plan.packageHours } : {}),
        totalAmountDue: plan.totalAmountDue,
        totalAmountPaid: payAtExit ? 0 : plan.totalAmountDue,
        ...(payAtExit ? { payAtExit: true } : {}),
        paymentMethod,
        openedBy: decoded.uid,
        openedByName: employeeName,
        status: 'open',
        notes: clean(body.notes, 500),
        createdAt: ts,
      });
      tx.update(roomRef, { status: 'occupied', currentStayId: stayRef.id, updatedAt: ts });

      const auditRef = db.collection(`companies/${companyId}/hospitalityAudit`).doc();
      tx.set(auditRef, {
        action: 'open_stay',
        targetId: stayRef.id,
        targetType: 'stay',
        before: { roomStatus: room.status, roomRatePerHour: room.ratePerHour ?? null, roomMinimumHours: room.minimumHours ?? null },
        after: {
          contractedHours: plan.contractedHours,
          ratePerHourApplied: plan.ratePerHourApplied,
          totalAmountDue: plan.totalAmountDue,
          ...(plan.packageType ? { packageType: plan.packageType } : {}),
        },
        reason: 'Check-in feito no servidor com o preço do quarto',
        userId: decoded.uid,
        userName: employeeName,
        timestamp: ts,
        companyId,
      });

      return { stayId: stayRef.id, accessPin, roomName, plan, expectedCheckOutAt, checkInAt: now.getTime() };
    });

    return NextResponse.json({
      success: true,
      stayId: result.stayId,
      accessPin: result.accessPin,
      roomName: result.roomName,
      contractedHours: result.plan.contractedHours,
      totalAmountDue: result.plan.totalAmountDue,
      expectedCheckOutAt: result.expectedCheckOutAt,
      checkInAt: result.checkInAt,
    });
  } catch (e: any) {
    if (e?.http) {
      return NextResponse.json(
        { error: e.message, ...(e.code ? { code: e.code } : {}), ...(e.serverTotal !== undefined ? { serverTotal: e.serverTotal } : {}) },
        { status: e.http }
      );
    }
    console.error('[stays/checkin]', e);
    return NextResponse.json({ error: 'Não foi possível fazer o check-in. Tente de novo.' }, { status: 500 });
  }
}
