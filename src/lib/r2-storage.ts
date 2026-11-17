import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Fotos no Cloudflare R2 (compatível com S3). Variáveis (Vercel → Settings → Environment Variables):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e
 *   R2_PUBLIC_URL (o endereço público do bucket: https://pub-xxxx.r2.dev ou o seu domínio, sem "/" no fim).
 * Sem elas a app continua a usar o Vercel Blob.
 */
type Env = Record<string, string | undefined>;

export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; publicUrl: string };

export function r2Config(env: Env = process.env): R2Config | null {
    const accountId = env.R2_ACCOUNT_ID?.trim();
    const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
    const bucket = env.R2_BUCKET?.trim();
    const publicUrl = env.R2_PUBLIC_URL?.trim().replace(/\/+$/, '');
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;
    if (!/^https:\/\//.test(publicUrl)) return null;
    return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

/** Endereço público de um ficheiro do bucket. */
export const r2ObjectUrl = (publicUrl: string, key: string) => `${publicUrl.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;

/** O endereço é do nosso bucket (para o proxy de imagens só servir o que é nosso)? */
export function isR2PublicUrl(url: URL, env: Env = process.env): boolean {
    const cfg = r2Config(env);
    if (!cfg) return false;
    try { return url.protocol === 'https:' && url.hostname === new URL(cfg.publicUrl).hostname; } catch { return false; }
}

/** Grava o ficheiro no bucket e devolve o endereço público. */
export async function putR2(key: string, body: Buffer, contentType: string, cfg: R2Config): Promise<string> {
    const client = new S3Client({
        region: 'auto',
        endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
    await client.send(new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
    }));
    return r2ObjectUrl(cfg.publicUrl, key);
}
