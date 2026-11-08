export const dynamic = 'force-dynamic';

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase-admin';

/**
 * Issues short-lived tokens so the browser uploads product photos straight to Vercel Blob
 * (the file never passes through this server). Only signed-in users of the company can
 * upload, only images, only under products/{theirCompanyId}/, max 5 MB.
 * Needs BLOB_READ_WRITE_TOKEN (added automatically when a Blob store is connected in Vercel).
 */
export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    try {
        const json = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname) => {
                const decoded = await verifyIdToken(request);
                if (!decoded) throw new Error('Não autorizado.');
                const companyId = (decoded as any).companyId;
                if (!(decoded as any).superAdmin && (!companyId || !pathname.startsWith(`products/${companyId}/`))) {
                    throw new Error('Acesso negado.');
                }
                return {
                    allowedContentTypes: ['image/webp', 'image/jpeg', 'image/png', 'image/gif'],
                    maximumSizeInBytes: 5 * 1024 * 1024,
                    addRandomSuffix: true,
                    cacheControlMaxAge: 60 * 60 * 24 * 365,
                };
            },
        });
        return NextResponse.json(json);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
}
