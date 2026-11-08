export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { isCronRequest } from '@/lib/cron-auth';
import { Resend } from 'resend';
import { initializeAdmin } from '@/lib/firebase-admin';
import { buildErrorDigest, type BillingFailLite, type ErrorLogLite, type NewCompanyLite } from '@/lib/error-digest';
import { SUPPORT } from '@/lib/support';

/**
 * Resumo diário de erros para o dono da plataforma (Vercel Cron, 06:00 de Maputo): os erros que os clientes
 * apanharam nas últimas 24 h, pagamentos que falharam e as empresas que começaram o teste. ?dry=1 mostra sem enviar.
 */
export async function GET(req: Request) {
    if (!isCronRequest(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const dry = new URL(req.url).searchParams.get('dry') === '1';
    const admin = initializeAdmin();
    const db = admin.firestore();
    const since = new Date(Date.now() - 24 * 3600_000);

    const [errSnap, billSnap, newSnap] = await Promise.all([
        db.collection('errorLogs').where('createdAt', '>=', admin.firestore.Timestamp.fromDate(since)).orderBy('createdAt', 'desc').limit(500).get(),
        db.collection('billingEvents').where('receivedAt', '>=', since.toISOString()).limit(200).get(),
        // empresa nova: o teste começa ao registar (trialRestartedAt = hora do registo)
        db.collection('companies').where('trialRestartedAt', '>=', since.toISOString()).limit(50).get(),
    ]);

    const errors: ErrorLogLite[] = errSnap.docs.map((d) => {
        const x = d.data();
        return { message: String(x.message || ''), url: x.url || undefined, companyId: x.companyId || null, email: x.email || null, at: x.createdAt?.toMillis?.() ?? Date.now() };
    });
    const billing: BillingFailLite[] = billSnap.docs
        .map((d) => d.data())
        .filter((x) => x.error)
        .map((x) => ({ event: String(x.event || '—'), error: String(x.error), at: String(x.receivedAt) }));
    const newCompanies: NewCompanyLite[] = newSnap.docs.map((d) => ({ id: d.id, name: String(d.get('name') || d.id) }));

    // os nomes das empresas que apanharam erros (em vez dos códigos)
    const ids = [...new Set(errors.map((e) => e.companyId).filter(Boolean) as string[])].slice(0, 30);
    const companyNames: Record<string, string> = {};
    if (ids.length) {
        const snaps = await db.getAll(...ids.map((id) => db.collection('companies').doc(id)));
        snaps.forEach((s) => { if (s.exists) companyNames[s.id] = String(s.get('name') || s.id); });
    }

    const digest = buildErrorDigest({ errors, billing, newCompanies, companyNames });
    if (dry) return NextResponse.json({ subject: digest.subject, total: digest.total, groups: digest.groups.length, newCompanies: newCompanies.length });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ skipped: 'RESEND_API_KEY não configurado' });
    const res: any = await new Resend(apiKey).emails.send({
        from: 'Major Assistant <assistant@majorgroup.app>',
        to: [SUPPORT.email],
        subject: digest.subject,
        html: digest.html,
    });
    if (res?.error) return NextResponse.json({ error: res.error?.message || 'falhou o envio' }, { status: 502 });
    return NextResponse.json({ sent: true, subject: digest.subject, total: digest.total });
}
