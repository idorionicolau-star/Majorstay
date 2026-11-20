// Email de confirmação de quando a subscrição é activada: um por empresa, uma só vez (marca `activationEmailSentAt`).
import { escapeHtml } from '@/lib/daily-report';

export function activationEmailHtml(o: { company: string; name?: string | null; until?: string | null; planLabel?: string | null; appUrl: string; brand: string; whatsappUrl: string }): { subject: string; html: string } {
    const until = o.until ? new Date(o.until) : null;
    const untilText = until && !isNaN(until.getTime())
        ? until.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Maputo' })
        : null;
    const greeting = o.name ? `Olá, ${escapeHtml(o.name)}!` : 'Olá!';
    return {
        subject: `Subscrição ativada — ${o.brand}`,
        html: `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background-color: #006194; color: #fff; padding: 18px 24px; font-size: 18px; font-weight: bold;">${escapeHtml(o.brand)}</div>
  <div style="padding: 24px;">
    <p style="margin: 0 0 12px;">${greeting}</p>
    <p style="margin: 0 0 12px;">A subscrição de <b>${escapeHtml(o.company)}</b> está <b style="color: #15803d;">ativa</b>${o.planLabel ? ` (plano ${escapeHtml(o.planLabel)})` : ''}.</p>
    ${untilText ? `<p style="margin: 0 0 12px;">Válida até <b>${untilText}</b>.</p>` : ''}
    <p style="margin: 0 0 20px;">Obrigado por confiar no ${escapeHtml(o.brand)}. Este email é só a confirmação, não precisa de fazer nada.</p>
    <p style="margin: 0 0 20px;"><a href="${o.appUrl}" style="background-color: #006194; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">Abrir o ${escapeHtml(o.brand)}</a></p>
    <p style="margin: 0; font-size: 13px; color: #64748b;">Alguma dúvida? Fale connosco no <a href="${o.whatsappUrl}">WhatsApp</a>.</p>
  </div>
</div>`,
    };
}
