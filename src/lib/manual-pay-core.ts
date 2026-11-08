// Pagamento directo (manual) da subscrição: o cliente envia por M-Pesa ou e-Mola para os números da MajorStockX,
// manda o comprovativo por WhatsApp e o super-administrador confirma — a conta é activada nesse momento.
// Lógica pura (sem Firebase), para ser testada. O cartão continua pela ZumboPay.

export const MANUAL_METHODS = {
    mpesa: { label: 'M-Pesa', number: '843641708', display: '84 364 1708' },
    emola: { label: 'e-Mola', number: '872979951', display: '87 297 9951' },
} as const;

export type ManualMethod = keyof typeof MANUAL_METHODS;

export const isManualMethod = (m: unknown): m is ManualMethod => typeof m === 'string' && Object.prototype.hasOwnProperty.call(MANUAL_METHODS, m);

/** Referência do pagamento: curta, para o cliente escrever na mensagem da transferência. */
export function paymentReference(companyId: string, now: Date): string {
    return `MSX${now.getTime().toString(36).toUpperCase()}${companyId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}`;
}

/** A mensagem do comprovativo, já preenchida, para o WhatsApp. */
export function manualProofMessage(p: { company?: string | null; email?: string | null; plan: string; amount: string; method: ManualMethod; reference: string }): string {
    return [
        'Olá, paguei a subscrição da MajorStockX.',
        p.company ? `Empresa: ${p.company}` : '',
        p.email ? `Email: ${p.email}` : '',
        `Plano: ${p.plan}`,
        `Valor: ${p.amount}`,
        `Pago por: ${MANUAL_METHODS[p.method].label}`,
        `Referência: ${p.reference}`,
        '',
        '(Envio a seguir o comprovativo.)',
    ].filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n');
}

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Email para o super-administrador quando chega um pedido de pagamento directo. */
export function manualPaymentEmail(p: {
    company: string; email?: string | null; createdBy?: string | null; plan: string; amount: string; method: ManualMethod; reference: string; adminUrl: string;
}): { subject: string; html: string } {
    const m = MANUAL_METHODS[p.method];
    const row = (k: string, v: string) => `<tr><td style="padding: 6px 12px 6px 0; color: #64748b;">${k}</td><td style="padding: 6px 0; font-weight: bold;">${esc(v)}</td></tr>`;
    const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 560px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background-color: #0f172a; padding: 20px 24px; color: white; font-size: 18px; font-weight: bold;">💰 Novo pagamento por ${esc(m.label)}</div>
  <div style="padding: 24px;">
    <p style="margin-top: 0;">Um cliente diz que vai pagar (ou já pagou) a subscrição. Confirme quando o dinheiro entrar no ${esc(m.label)} ${esc(m.display)} e o comprovativo chegar.</p>
    <table style="border-collapse: collapse; font-size: 15px;">
      ${row('Empresa', p.company)}
      ${p.email ? row('Email', p.email) : ''}
      ${p.createdBy ? row('Pedido por', p.createdBy) : ''}
      ${row('Plano', p.plan)}
      ${row('Valor', p.amount)}
      ${row('Forma', `${m.label} (${m.display})`)}
      ${row('Referência', p.reference)}
    </table>
    <div style="text-align: center; margin: 28px 0 8px;">
      <a href="${esc(p.adminUrl)}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px;">Confirmar ou recusar</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 12px; color: #94a3b8;">MajorStockX · pagamentos directos</div>
</div>`;
    return { subject: `💰 Pagamento ${m.label} a confirmar — ${p.company} · ${p.amount} · ${p.reference}`, html };
}

/** Prazo prometido ao cliente para a confirmação manual (um só sítio: instruções, aviso e guia). */
export const MANUAL_CONFIRM_HOURS = 'segunda a sábado, das 8h às 18h';
export const MANUAL_CONFIRM_PROMISE = `em até 20 minutos em horário de funcionamento (${MANUAL_CONFIRM_HOURS}); fora desse horário, no início do dia seguinte`;
