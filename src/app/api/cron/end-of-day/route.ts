export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { isCronRequest } from '@/lib/cron-auth';
import { initializeAdmin } from '@/lib/firebase-admin';
import { reportTime } from '@/lib/daily-report';
import { runEndOfDay } from '@/lib/end-of-day-run';
import { runFollowups } from '@/lib/followups-run';

export async function GET(req: Request) {
    if (!isCronRequest(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Cada hora possível tem o seu cron (vercel.json): este envia só às empresas que escolheram esta hora
    const slot = reportTime(new URL(req.url).searchParams.get('slot'));
    const startedAt = new Date().toISOString();
    try {
        const run = await runEndOfDay(slot);

        // os emails de acompanhamento saem uma vez por dia, no envio das 18h30 (a hora de sempre)
        let followups: unknown = null;
        if (slot === '18:30') {
            try { followups = await runFollowups(); } catch (e) { console.error('followups', e); }
        }

        // Os registos da Vercel (plano Hobby) duram 1 hora: guardamos o resultado para o super-administrador ver depois
        await initializeAdmin().firestore().collection('cronRuns').add({ kind: 'end-of-day', startedAt, ...run }).catch((e) => console.error('cronRuns', e));

        return NextResponse.json({ success: true, message: 'End of day reports generated and dispatched', slot, sent: run.sent, failed: run.failed, followups });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error executing End-of-Day cron:', error);
        await initializeAdmin().firestore().collection('cronRuns').add({ kind: 'end-of-day', startedAt, slot, fatal: message.slice(0, 300) }).catch(() => undefined);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
