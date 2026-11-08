export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { claimSales } from '@/lib/escalepay-server';
import { ESCALEPAY_SOURCE, normEmail } from '@/lib/escalepay-core';

/**
 * O administrador da empresa abre a app: se houver compras da EscalePay feitas com o email dele ainda por usar,
 * activam a empresa. `{ source: "escalepay" }` marca a empresa como vinda do link dos afiliados.
 */
export async function POST(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.companyId || !decoded.email) return NextResponse.json({ applied: 0 });
    const db = initializeAdmin().firestore();
    const role = (await db.doc(`companies/${decoded.companyId}/employees/${decoded.uid}`).get()).get('role');
    if (!['Admin', 'Dono'].includes(role)) return NextResponse.json({ applied: 0 });
    const body = await req.json().catch(() => ({} as any));
    if (body.source === ESCALEPAY_SOURCE) {
        const ref = db.doc(`companies/${decoded.companyId}`);
        if (!(await ref.get()).get('source')) await ref.set({ source: ESCALEPAY_SOURCE }, { merge: true });
    }
    // a compra é de quem prova que o email é seu: email confirmado (o Google já vem confirmado). Antes bastava uma conta
    // com o mesmo email, mesmo por confirmar, para ficar com a compra de outra pessoa.
    if (!decoded.email_verified) {
        const waiting = await db.collection('escalepaySales').where('email', '==', normEmail(decoded.email)).where('claimedBy', '==', null).limit(1).get();
        return NextResponse.json({ applied: 0, ...(waiting.empty ? {} : { needsVerification: true }) });
    }
    return NextResponse.json(await claimSales(decoded.companyId, decoded.email));
}
