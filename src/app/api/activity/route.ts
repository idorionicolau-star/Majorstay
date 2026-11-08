export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';

/** Regista que alguém da empresa usou a app hoje (para os emails de "falta de uso"). Chamado no máx. 1×/dia. */
export async function POST(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.companyId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    const now = new Date().toISOString();
    const db = initializeAdmin().firestore();
    await Promise.all([
        db.doc(`companies/${decoded.companyId}`).set({ lastActiveAt: now }, { merge: true }),
        db.doc(`users/${decoded.uid}`).set({ lastActiveAt: now }, { merge: true }),
    ]);
    return NextResponse.json({ ok: true });
}
