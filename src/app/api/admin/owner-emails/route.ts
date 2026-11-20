export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';

/**
 * Super-administrador: o email de login do dono de cada empresa (companyId → email).
 * Vem da conta de acesso (Firebase Auth) do `ownerId`; se não houver, o email guardado na própria empresa.
 */
export async function GET(req: Request) {
    const decoded: any = await verifyIdToken(req);
    if (!decoded?.superAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    const admin = initializeAdmin();
    const snap = await admin.firestore().collection('companies').select('ownerId', 'email').get();
    const owners = new Map<string, string>();
    const fallback: Record<string, string> = {};
    snap.forEach((d) => {
        const data = d.data();
        if (typeof data.ownerId === 'string' && data.ownerId) owners.set(d.id, data.ownerId);
        if (typeof data.email === 'string' && data.email.trim()) fallback[d.id] = data.email.trim();
    });
    const uids = [...new Set(owners.values())];
    const emailByUid = new Map<string, string>();
    for (let i = 0; i < uids.length; i += 100) {
        try {
            const res = await admin.auth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
            res.users.forEach((u) => { if (u.email) emailByUid.set(u.uid, u.email); });
        } catch (e) {
            console.error('[owner-emails] getUsers falhou:', e);
        }
    }
    const emails: Record<string, string> = {};
    snap.forEach((d) => {
        const e = emailByUid.get(owners.get(d.id) || '') || fallback[d.id];
        if (e) emails[d.id] = e;
    });
    return NextResponse.json({ emails });
}
