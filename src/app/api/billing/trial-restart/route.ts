export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { canRestartTrial, trialEndFrom } from '@/lib/trial';

/**
 * Reinício ÚNICO do teste gratuito das empresas que já existiam: 14 dias a contar de quando alguém da empresa
 * volta a abrir o site. Corre no servidor porque as regras do Firestore não deixam a app mexer em `trialEndsAt`.
 * Só actua em empresas em teste, que ainda não foram reiniciadas e que nunca pagaram (ver `canRestartTrial`).
 * A transacção garante que dois utilizadores a abrir ao mesmo tempo só reiniciam uma vez.
 */
export async function POST(req: Request) {
    const decoded: any = await verifyIdToken(req);
    const companyId: string | undefined = decoded?.companyId;
    if (!decoded || !companyId) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const db = initializeAdmin().firestore();
    const ref = db.doc(`companies/${companyId}`);
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists || !canRestartTrial(snap.data() as any)) return { restarted: false as const };
        const now = new Date();
        const end = trialEndFrom(now);
        tx.update(ref, { trialEndsAt: end.toISOString(), trialRestartedAt: now.toISOString(), trialRestartedBy: decoded.uid });
        return { restarted: true as const, trialEndsAt: end.toISOString() };
    });
    return NextResponse.json(result);
}
