export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * Serve, a partir do nosso domínio, uma imagem guardada no Vercel Blob (logótipo, fotos).
 * Os PDFs desenham a imagem num <canvas>, e o navegador só deixa se a imagem vier com CORS;
 * se o Blob não o enviar, o PDF perdia o logótipo sem avisar. Só aceita endereços do Vercel Blob e só imagens.
 */
const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(req: Request) {
    const raw = new URL(req.url).searchParams.get('url') || '';
    let target: URL;
    try { target = new URL(raw); } catch { return NextResponse.json({ error: 'Endereço inválido.' }, { status: 400 }); }
    if (target.protocol !== 'https:' || !target.hostname.endsWith('.public.blob.vercel-storage.com')) {
        return NextResponse.json({ error: 'Só imagens guardadas na app.' }, { status: 400 });
    }
    const res = await fetch(target, { cache: 'force-cache' }).catch(() => null);
    const type = res?.headers.get('content-type') || '';
    if (!res?.ok || !type.startsWith('image/')) return NextResponse.json({ error: 'Imagem não encontrada.' }, { status: 404 });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: 'Imagem demasiado grande.' }, { status: 413 });
    return new NextResponse(buf, { headers: { 'content-type': type, 'cache-control': 'public, max-age=86400' } });
}
