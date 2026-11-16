export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';

/**
 * POST { companyId, roomId } (funcionário com acesso a Quartos):
 * gera um PIN novo de 6 dígitos para a estadia aberta do quarto e tira o bloqueio de tentativas.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyId = typeof body.companyId === 'string' ? body.companyId : '';
    const roomId = typeof body.roomId === 'string' ? body.roomId : '';
    const decoded = (await verifyIdToken(req)) as { uid: string; superAdmin?: boolean; companyId?: string } | null;
    if (!decoded) return NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 });
    if (!companyId || !roomId) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });
    if (!decoded.superAdmin && companyId !== decoded.companyId) return NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 });

    const db = initializeAdmin().firestore();
    if (!decoded.superAdmin) {
      const emp = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
      const d = emp.exists ? emp.data() || {} : {};
      if (!(d.role === 'Admin' || d.role === 'Dono' || d.permissions?.rooms === 'write')) {
        return NextResponse.json({ error: 'Sem permissão para os quartos.' }, { status: 403 });
      }
    }

    const snap = await db.collection(`companies/${companyId}/stays`).where('roomId', '==', roomId).where('status', '==', 'open').limit(1).get();
    if (snap.empty) return NextResponse.json({ error: 'Este quarto não tem estadia aberta.' }, { status: 404 });
    const pin = String(randomInt(100000, 1000000));
    await snap.docs[0].ref.update({ accessPin: pin, pinFailedAttempts: 0, pinLockCount: 0, pinLockedUntil: null });
    return NextResponse.json({ success: true, pin });
  } catch (err) {
    console.error('Erro ao renovar PIN:', err);
    return NextResponse.json({ error: 'Não foi possível renovar o PIN.' }, { status: 500 });
  }
}
