/**
 * Shrinks a phone photo (often 3–6 MB) to a small WebP/JPEG (~50–150 KB) before upload.
 * Saves mobile data, storage and makes the catalogue load fast.
 */
export async function compressImage(file: File, maxSide = 900, quality = 0.8): Promise<Blob> {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return file;
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close?.();
        const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
        const blob = (await toBlob("image/webp")) || (await toBlob("image/jpeg"));
        return blob && blob.size < file.size ? blob : file;
    } catch {
        return file;
    }
}

export const extensionFor = (blob: Blob) =>
    blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
