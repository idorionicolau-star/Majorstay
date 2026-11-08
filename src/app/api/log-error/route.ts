export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';

const ADMIN_EMAILS = ['digitalwarriorguru@gmail.com', 'idorionicolau@gmail.com'];
const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);

// Limite simples por instância: evita que um ciclo de erros encha a base de dados.
const recent = new Map<string, number[]>();
function tooMany(key: string) {
    const now = Date.now();
    const list = (recent.get(key) || []).filter((t) => now - t < 60_000);
    list.push(now);
    recent.set(key, list);
    if (recent.size > 500) recent.clear();
    return list.length > 10;
}

/** Regista um erro de ecrã (collection `errorLogs`, só legível pelo servidor). */
export async function POST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
        if (tooMany(ip)) return NextResponse.json({ ok: false }, { status: 429 });

        const b = await req.json().catch(() => ({}));
        if (!b?.message) return NextResponse.json({ ok: false }, { status: 400 });
        const decoded: any = await verifyIdToken(req).catch(() => null); // opcional: erro pode ocorrer antes do login

        const admin = initializeAdmin();
        await admin.firestore().collection('errorLogs').add({
            message: clip(b.message, 500),
            stack: clip(b.stack, 3000),
            source: clip(b.source, 40),
            url: clip(b.url, 300),
            context: clip(b.context, 4000),
            version: clip(b.version, 12),
            userAgent: clip(req.headers.get('user-agent'), 200),
            uid: decoded?.uid || null,
            email: decoded?.email || null,
            companyId: decoded?.companyId || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('log-error falhou:', e);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

/** Últimos erros — só para os administradores da plataforma. */
export async function GET(req: Request) {
    const decoded: any = await verifyIdToken(req);
    const email = String(decoded?.email || '').toLowerCase();
    if (!decoded || !(decoded.superAdmin || ADMIN_EMAILS.includes(email))) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }
    const admin = initializeAdmin();
    const snap = await admin.firestore().collection('errorLogs').orderBy('createdAt', 'desc').limit(100).get();
    const items = snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, ...x, createdAt: x.createdAt?.toMillis?.() ?? null };
    });
    return NextResponse.json({ items });
}
