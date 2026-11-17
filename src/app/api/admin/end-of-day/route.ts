export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { listReportCompanies, runEndOfDay } from '@/lib/end-of-day-run';

/** Super-administrador: empresas com relatório ligado e as últimas execuções do cron (guardadas em cronRuns). */
export async function GET(req: Request) {
    const decoded = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const db = initializeAdmin().firestore();
    const [companies, runsSnap] = await Promise.all([
        listReportCompanies(),
        db.collection('cronRuns').orderBy('startedAt', 'desc').limit(20).get(),
    ]);
    return NextResponse.json({ companies, runs: runsSnap.docs.map((d) => ({ id: d.id, ...d.data() })), hasApiKey: !!process.env.RESEND_API_KEY });
}

/** Super-administrador: envia agora o relatório de hoje (até este momento) a uma empresa. { companyId } */
export async function POST(req: Request) {
    const decoded = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const { companyId } = await req.json().catch(() => ({}));
    if (typeof companyId !== 'string' || !companyId) return NextResponse.json({ error: 'Falta a empresa.' }, { status: 400 });
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY não configurado na Vercel.' }, { status: 503 });
    const run = await runEndOfDay('manual', companyId);
    if (!run.results.length) return NextResponse.json({ error: 'Esta empresa não tem nenhum email com o relatório ligado.' }, { status: 400 });
    return NextResponse.json(run, { status: run.failed ? 502 : 200 });
}
