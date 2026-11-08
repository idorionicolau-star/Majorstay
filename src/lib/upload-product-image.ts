import { upload } from '@vercel/blob/client';
import type { Auth } from 'firebase/auth';
import { compressImage, extensionFor } from '@/lib/image-compress';

/**
 * Compresses a product photo (≤900px WebP, ~100 KB) and uploads it to Vercel Blob.
 * Returns the public URL to store in product.imageUrl.
 * (Firebase Storage stopped working on the free Spark plan.)
 */
export async function uploadProductImage(file: File, auth: Auth, companyId: string): Promise<string> {
    const compressed = await compressImage(file);
    const base = (file.name || 'foto').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'foto';
    const pathname = `products/${companyId}/${base}.${extensionFor(compressed)}`;
    const token = await auth.currentUser?.getIdToken();
    // A biblioteca repete o envio muitas vezes se a rede/CSP falhar — sem limite parecia "a guardar para sempre".
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 40_000);
    try {
        const result = await upload(pathname, compressed, {
            access: 'public',
            handleUploadUrl: '/api/blob-upload',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            contentType: compressed.type || file.type,
            abortSignal: ctrl.signal,
        });
        return result.url;
    } catch (e) {
        if (ctrl.signal.aborted) throw new Error('O envio demorou demasiado. Verifique a internet e tente de novo.');
        throw e;
    } finally {
        clearTimeout(timer);
    }
}
