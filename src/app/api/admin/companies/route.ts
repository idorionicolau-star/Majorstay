export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { fromDateInput } from '@/lib/admin-subscription';
import { GRACE_DAYS } from '@/lib/plans';
import { isTierId } from '@/lib/tiers';

const STATUSES = ['active', 'trial', 'suspended'];

/**
 * Super-administrador: muda o estado e as datas de uma empresa. As datas chegam como AAAA-MM-DD e são gravadas
 * como ISO completo (fim do dia em Maputo) — o formato que as regras do Firestore lêem — e a subscrição actualiza
 * também `paidUntilMs` (o que as regras usam para deixar escrever). Antes a página gravava "AAAA-MM-DD" à mão e um
 * teste prolongado ficava, para as regras, já expirado.
 */
export async function POST(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const { companyId, status, trialEndsAt, subscriptionEndsAt, tier } = await req.json().catch(() => ({}));
    if (typeof companyId !== 'string' || !companyId || companyId.includes('/')) return NextResponse.json({ error: 'Empresa inválida.' }, { status: 400 });
    if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    // plano: um nível, ou "atual" = sem nível (plano antigo, tudo incluído). undefined = não mexer.
    if (tier !== undefined && tier !== 'atual' && !isTierId(tier)) return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    const trial = trialEndsAt ? fromDateInput(String(trialEndsAt)) : null;
    const sub = subscriptionEndsAt ? fromDateInput(String(subscriptionEndsAt)) : null;
    if ((trialEndsAt && !trial) || (subscriptionEndsAt && !sub)) return NextResponse.json({ error: 'Data inválida (use AAAA-MM-DD).' }, { status: 400 });

    const ref = initializeAdmin().firestore().doc(`companies/${companyId}`);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    const update = {
        status,
        trialEndsAt: trial ?? FieldValue.delete(),
        subscriptionEndsAt: sub ?? FieldValue.delete(),
        paidUntilMs: sub ? new Date(sub).getTime() + GRACE_DAYS * 86_400_000 : FieldValue.delete(),
        ...(tier === undefined ? {} : { tier: isTierId(tier) ? tier : FieldValue.delete() }),
        adminUpdatedAt: new Date().toISOString(),
        adminUpdatedBy: decoded.email || decoded.uid,
    };
    await ref.update(update);
    return NextResponse.json({ ok: true, status, trialEndsAt: trial, subscriptionEndsAt: sub, tier: isTierId(tier) ? tier : null });
}
