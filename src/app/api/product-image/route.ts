export const dynamic = 'force-dynamic';

import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase-admin';

/**
 * Recebe a foto de um produto (já comprimida no navegador) e grava-a no Vercel Blob público.
 * Corre no servidor porque o store do Vercel liga por OIDC e não cria BLOB_READ_WRITE_TOKEN
 * (o envio directo do navegador precisa desse token).
 *
 * Autenticação do Blob, por ordem: BLOB_READ_WRITE_TOKEN (se existir) ou BLOBS_STORE_ID + token OIDC do Vercel.
 * Só utilizadores com sessão; só imagens; máx. 5 MB; só em products/{empresa do utilizador}/.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
};

export async function POST(req: Request): Promise<NextResponse> {
    const decoded = (await verifyIdToken(req)) as { companyId?: string; superAdmin?: boolean } | null;
    if (!decoded) {
        return NextResponse.json({ error: 'Sessão expirada. Por favor autentique-se novamente.' }, { status: 401 });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!form || !(file instanceof File)) {
        return NextResponse.json({ error: 'Ficheiro em falta.' }, { status: 400 });
    }

    const requestedCompany = String(form.get('companyId') || '').trim();
    const companyId = decoded.superAdmin ? requestedCompany || decoded.companyId : decoded.companyId;
    if (!companyId || (!decoded.superAdmin && requestedCompany && requestedCompany !== companyId)) {
        return NextResponse.json({ error: 'Acesso negado a esta empresa.' }, { status: 403 });
    }

    const extension = EXTENSIONS[file.type];
    if (!extension) {
        return NextResponse.json({ error: 'Tipo de imagem não suportado.' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'A imagem deve ter no máximo 5 MB.' }, { status: 400 });
    }

    const base = (file.name || 'foto').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'foto';
    const pathname = `products/${companyId}/${base}.${extension}`;

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const storeId = process.env.BLOBS_STORE_ID;
    const oidcToken = req.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;
    const auth = token ? { token } : storeId && oidcToken ? { storeId, oidcToken } : null;
    if (!auth) {
        console.error('Erro em /api/product-image: Blob sem token nem BLOBS_STORE_ID/OIDC');
        return NextResponse.json({ error: 'O armazenamento de fotos não está configurado no servidor.' }, { status: 500 });
    }

    try {
        const blob = await put(pathname, file, {
            access: 'public',
            addRandomSuffix: true,
            contentType: file.type,
            cacheControlMaxAge: 60 * 60 * 24 * 365,
            ...auth,
        });
        return NextResponse.json({ url: blob.url });
    } catch (e) {
        console.error('Erro em /api/product-image:', e instanceof Error ? e.message : e);
        return NextResponse.json({ error: 'Não foi possível guardar a foto.' }, { status: 500 });
    }
}
