export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';

/**
 * Wi-Fi do hotel (mostrado ao hóspede no QR do quarto, só depois do PIN).
 * POST { companyId, wifiSsid, wifiPassword } — só Admin ou Dono. Grava em companies/{id}.
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
    if (!allowed) return NextResponse.json({ error: 'Só o administrador ou o dono pode alterar o Wi-Fi.' }, { status: 403 });

    const wifiSsid = String(body.wifiSsid ?? '').trim().slice(0, 64);
    const wifiPassword = String(body.wifiPassword ?? '').trim().slice(0, 64);
    await db.doc(`companies/${companyId}`).update({ wifiSsid, wifiPassword });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro em POST /api/company-wifi:', err);
    return NextResponse.json({ error: 'Não foi possível guardar o Wi-Fi.' }, { status: 500 });
  }
}
