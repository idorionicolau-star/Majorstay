export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { sanitizeSchedule } from '@/lib/shift-schedule';

/**
 * Turnos de cada hotel (nome, início e fim). POST { companyId, schedule: [{ name, start:'HH:MM', end:'HH:MM' }] }
 * — só Admin ou Dono. Grava em companies/{id}.shiftSchedule (lista vazia = sem turnos definidos).
 */
export async function POST(req: Request) {
  try {
    const decoded = (await verifyIdToken(req)) as { uid: string; superAdmin?: boolean; companyId?: string } | null;
    if (!decoded) return NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const companyId = String(body.companyId || '');
    if (!companyId) return NextResponse.json({ error: 'Identificador de empresa em falta.' }, { status: 400 });
    if (!decoded.superAdmin && companyId !== decoded.companyId) {
      return NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 });
    }
    const db = initializeAdmin().firestore();
    let allowed = decoded.superAdmin === true;
    if (!allowed) {
      const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
      const role = emp.exists ? (emp.data() || {}).role : null;
      allowed = role === 'Admin' || role === 'Dono';
    }
    if (!allowed) return NextResponse.json({ error: 'Só o administrador ou o dono pode definir os turnos.' }, { status: 403 });

    const raw = Array.isArray(body.schedule) ? body.schedule : [];
    const schedule = sanitizeSchedule(raw);
    if (schedule.length !== Math.min(raw.length, 6)) {
      return NextResponse.json({ error: 'Cada turno precisa de um nome e de horas válidas (HH:MM).' }, { status: 400 });
    }
    await db.doc(`companies/${companyId}`).update({ shiftSchedule: schedule });
    return NextResponse.json({ success: true, schedule });
  } catch (err) {
    console.error('Erro em POST /api/company-shifts:', err);
    return NextResponse.json({ error: 'Não foi possível guardar os turnos.' }, { status: 500 });
  }
}
