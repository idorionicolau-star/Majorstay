/**
 * Limite de pedidos por IP para as rotas públicas (QR do quarto).
 * Em memória: em serverless cada instância conta à parte, por isso trava abusos
 * e inundações simples, mas não é um limite exato. Sem IP (local/testes) não limita.
 */
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
}

/** true = pedido permitido; false = excedeu o limite. */
export function rateLimitOk(req: Request, bucket: string, max: number, windowMs: number): boolean {
  const ip = clientIp(req);
  if (!ip) return true;
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return true;
}

export const TOO_MANY = 'Demasiados pedidos. Aguarde um minuto e tente de novo.';
