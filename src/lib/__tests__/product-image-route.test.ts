import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockVerify = vi.fn();
const mockPut = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({ verifyIdToken: (...a: unknown[]) => mockVerify(...a) }));
vi.mock('@vercel/blob', () => ({ put: (...a: unknown[]) => mockPut(...a) }));

import { POST } from '@/app/api/product-image/route';

function request(file: File | null, extra: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (file) form.append('file', file);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return new Request('http://localhost/api/product-image', { method: 'POST', body: form, headers });
}

const img = (type = 'image/webp', size = 100) => new File([new Uint8Array(size)], 'Foto Bonita.webp', { type });

describe('POST /api/product-image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOBS_STORE_ID = 'store_test';
    mockVerify.mockResolvedValue({ uid: 'u1', companyId: 'empresaA' });
    mockPut.mockResolvedValue({ url: 'https://blob.example/products/empresaA/Foto-Bonita-abc.webp' });
  });

  it('sem sessão → 401', async () => {
    mockVerify.mockResolvedValue(null);
    const res = await POST(request(img()));
    expect(res.status).toBe(401);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('sem ficheiro → 400', async () => {
    const res = await POST(request(null));
    expect(res.status).toBe(400);
  });

  it('empresa diferente da do utilizador → 403', async () => {
    const res = await POST(request(img(), { companyId: 'empresaB' }));
    expect(res.status).toBe(403);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('tipo inválido → 400', async () => {
    const res = await POST(request(img('application/pdf')));
    expect(res.status).toBe(400);
  });

  it('imagem acima de 5 MB → 400', async () => {
    const res = await POST(request(img('image/webp', 5 * 1024 * 1024 + 1)));
    expect(res.status).toBe(400);
  });

  it('sem token nem OIDC → 500 claro', async () => {
    const res = await POST(request(img()));
    expect(res.status).toBe(500);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('com OIDC grava na pasta da empresa do utilizador e devolve o url', async () => {
    const res = await POST(request(img(), { companyId: 'empresaA' }, { 'x-vercel-oidc-token': 'oidc-123' }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toContain('blob.example');
    const [pathname, , opts] = mockPut.mock.calls[0];
    expect(pathname).toBe('products/empresaA/Foto-Bonita.webp');
    expect(opts).toMatchObject({ access: 'public', storeId: 'store_test', oidcToken: 'oidc-123', addRandomSuffix: true });
  });

  it('com BLOB_READ_WRITE_TOKEN usa o token', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'rw-token';
    const res = await POST(request(img()));
    expect(res.status).toBe(200);
    expect(mockPut.mock.calls[0][2]).toMatchObject({ token: 'rw-token' });
  });
});
