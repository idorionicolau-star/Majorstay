/**
 * Pedido da Vercel Cron (cabeçalho Authorization: Bearer CRON_SECRET). Sem CRON_SECRET configurado recusa sempre —
 * antes, sem a variável, "Bearer undefined" passava.
 */
export function isCronRequest(req: Request): boolean {
    const secret = process.env.CRON_SECRET || '';
    return secret.length > 0 && req.headers.get('authorization') === `Bearer ${secret}`;
}
