export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';

/**
 * Sends a push notification to the devices registered for a company
 * (companies/{companyId}/pushTokens). FCM is free, also on the Spark plan.
 *
 * Body: { companyId, title, body, link?, tag?, includeSelf? }
 * By default the device that triggered the event is not notified (it already knows);
 * `includeSelf: true` is used by the "test" button.
 */
export async function POST(req: Request) {
    const decoded = await verifyIdToken(req);
    if (!decoded) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { companyId, title, body, link, tag, includeSelf, audience, excludeToken } = await req.json();
    if (!companyId || !title) return NextResponse.json({ error: 'Dados em falta.' }, { status: 400 });
    if (!(decoded as any).superAdmin && companyId !== (decoded as any).companyId) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    try {
        const admin = initializeAdmin();
        const snap = await admin.firestore().collection(`companies/${companyId}/pushTokens`).get();
        // Não avisa só o aparelho que fez a acção (os outros aparelhos da mesma conta recebem).
        // Aparelhos antigos, sem código guardado, continuam a ser excluídos pela conta.
        let targets = snap.docs.filter((d) => includeSelf || (excludeToken ? d.id !== excludeToken : d.get('userId') !== decoded.uid));
        if (audience === 'managers') {
            // Só gestores (Admin/Dono) recebem, p.ex., pedidos de confirmação de preço.
            const ids = Array.from(new Set(targets.map((d) => d.get('userId') as string).filter(Boolean)));
            const emps = await Promise.all(ids.map((id) => admin.firestore().doc(`companies/${companyId}/employees/${id}`).get()));
            const managers = new Set(emps.filter((e) => ['Admin', 'Dono'].includes(e.get('role'))).map((e) => e.id));
            targets = targets.filter((d) => managers.has(d.get('userId')));
        }
        if (!targets.length) return NextResponse.json({ sent: 0, devices: snap.size });

        const tokens = targets.map((d) => d.id);
        const data: Record<string, string> = {
            title: String(title).slice(0, 120),
            body: String(body || '').slice(0, 400),
            link: typeof link === 'string' && link.startsWith('/') ? link : '/dashboard',
            ...(tag ? { tag: String(tag).slice(0, 60) } : {}),
        };

        const res = await admin.messaging().sendEachForMulticast({
            tokens,
            data, // data-only: the service worker builds the notification (icon, link) itself
            webpush: { headers: { Urgency: 'high', TTL: '86400' } },
        });

        // Clean up devices that uninstalled the app or revoked permission
        const dead: Promise<unknown>[] = [];
        res.responses.forEach((r, i) => {
            const code = r.error?.code || '';
            if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
                dead.push(targets[i].ref.delete());
            }
        });
        await Promise.allSettled(dead);

        const firstError = res.responses.find((r) => r.error)?.error;
        return NextResponse.json({
            sent: res.successCount, failed: res.failureCount, removed: dead.length, devices: snap.size,
            ...(firstError ? { errorCode: firstError.code, errorMessage: firstError.message?.slice(0, 200) } : {}),
        });
    } catch (error: any) {
        console.error('Push error:', error);
        return NextResponse.json({ error: 'Falha ao enviar notificação.', details: error?.message }, { status: 500 });
    }
}
