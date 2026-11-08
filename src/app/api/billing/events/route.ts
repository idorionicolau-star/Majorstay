export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';

/** Só para o super-administrador: os últimos webhooks da ZumboPay recebidos (já sem números de telefone). */
export async function GET(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const snap = await initializeAdmin().firestore().collection('billingEvents').orderBy('receivedAt', 'desc').limit(20).get();
    return NextResponse.json({ events: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
}
