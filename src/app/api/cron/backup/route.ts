export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { isCronRequest } from '@/lib/cron-auth';
import { del, list, put } from '@vercel/blob';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebase-admin';
import { backupPath, BACKUP_PREFIX, dayOf, expiredBackups } from '@/lib/backup-core';

/**
 * Cópia de segurança diária (Vercel Cron): os dados de cada empresa num JSON privado no Vercel Blob,
 * guardados 14 dias. Precisa de um Blob store PRIVADO ligado ao projecto com o prefixo BACKUP_BLOB
 * (a Vercel cria BACKUP_BLOB_STORE_ID e autentica por OIDC) — ou do seu token em BACKUP_BLOB_READ_WRITE_TOKEN.
 * As fotos usam outro store, público. Sem nenhum dos dois não faz nada.
 */
async function dumpDoc(ref: DocumentReference, depth = 0): Promise<Record<string, unknown>> {
    const snap = await ref.get();
    const out: Record<string, unknown> = { id: ref.id, data: snap.exists ? snap.data() : null };
    if (depth < 2) {
        const subs = await ref.listCollections();
        for (const col of subs) {
            const docs = await col.listDocuments();
            out[col.id] = await Promise.all(docs.map((d) => dumpDoc(d, depth + 1)));
        }
    }
    return out;
}

async function dumpCollection(db: Firestore, name: string) {
    const qs = await db.collection(name).get();
    return qs.docs.map((d) => ({ id: d.id, data: d.data() }));
}

export async function GET(req: Request) {
    if (!isCronRequest(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const storeId = process.env.BACKUP_BLOB_STORE_ID;
    const token = process.env.BACKUP_BLOB_READ_WRITE_TOKEN;
    // OIDC explícito + storeId: a SDK usa ESTE store e nunca cai no BLOB_READ_WRITE_TOKEN das fotos (público)
    const oidcToken = req.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;
    const auth = token ? { token } : storeId && oidcToken ? { storeId, oidcToken } : null;
    if (!auth) {
        const why = storeId ? 'sem token OIDC da Vercel' : 'BACKUP_BLOB_STORE_ID / BACKUP_BLOB_READ_WRITE_TOKEN não configurado';
        return NextResponse.json({ skipped: why }, { status: storeId ? 500 : 200 });
    }

    const db = initializeAdmin().firestore();
    const now = new Date();
    const day = dayOf(now);
    const opts = { access: 'private' as const, ...auth, addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' };
    const saved: string[] = [];
    const failed: string[] = [];

    const companies = await db.collection('companies').listDocuments();
    for (const ref of companies) {
        try {
            const data = await dumpDoc(ref);
            await put(backupPath(day, ref.id), JSON.stringify({ at: now.toISOString(), company: data }), opts);
            saved.push(ref.id);
        } catch (e) {
            console.error('backup', ref.id, e);
            failed.push(ref.id);
        }
    }
    try {
        const global = { users: await dumpCollection(db, 'users'), escalepaySales: await dumpCollection(db, 'escalepaySales'), billingRefs: await dumpCollection(db, 'billingRefs') };
        await put(backupPath(day, '_global'), JSON.stringify({ at: now.toISOString(), ...global }), opts);
    } catch (e) {
        console.error('backup global', e);
        failed.push('_global');
    }

    // apaga as cópias com mais de 14 dias
    let removed = 0;
    try {
        let cursor: string | undefined;
        do {
            const page = await list({ prefix: BACKUP_PREFIX, cursor, ...auth });
            const old = expiredBackups(page.blobs.map((b) => b.pathname), now);
            if (old.length) {
                await del(page.blobs.filter((b) => old.includes(b.pathname)).map((b) => b.url), auth);
                removed += old.length;
            }
            cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
    } catch (e) {
        console.error('backup cleanup', e);
    }

    return NextResponse.json({ day, saved: saved.length, failed, removed }, { status: failed.length ? 500 : 200 });
}
