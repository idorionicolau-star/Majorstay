import type { Auth } from 'firebase/auth';
import { compressImage, extensionFor } from '@/lib/image-compress';

/**
 * Compresses a product photo (≤900px WebP, ~100 KB) and sends it to /api/product-image, which stores it in Vercel Blob.
 * Returns the public URL to store in product.imageUrl.
 * (Firebase Storage stopped working on the free Spark plan.)
 */
export async function uploadProductImage(file: File, auth: Auth, companyId: string): Promise<string> {
    const compressed = await compressImage(file);
    const base = (file.name || 'foto').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'foto';
    const token = await auth.currentUser?.getIdToken();
    // Limite de tempo: sem ele, uma rede lenta parecia "a guardar para sempre".
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 40_000);
    try {
        const form = new FormData();
        form.append('file', compressed, `${base}.${extensionFor(compressed)}`);
        form.append('companyId', companyId);
        const res = await fetch('/api/product-image', {
            method: 'POST',
            body: form,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            signal: ctrl.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) throw new Error(data.error || 'Não foi possível guardar a foto.');
        return data.url as string;
    } catch (e) {
        if (ctrl.signal.aborted) throw new Error('O envio demorou demasiado. Verifique a internet e tente de novo.');
        throw e;
    } finally {
        clearTimeout(timer);
    }
}
