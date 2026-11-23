// Email que o gerente recebe quando um turno de caixa é fechado. Sem Firebase: só texto, testável.
import { escapeHtml } from '@/lib/daily-report';
import { formatCurrency } from '@/lib/utils';
import type { ShiftTotals } from '@/lib/shifts';

export type ShiftCloseInfo = {
    company: string;
    brand: string;
    appUrl: string;
    employee: string;
    closedBy?: string;
    openedAt: Date | null;
    closedAt: Date;
    openingCash: number;
    countedCash: number;
    expectedCash: number;
    difference: number;
    totals: ShiftTotals;
    notes?: string;
};

const hhmm = (d: Date | null) => d && !isNaN(d.getTime())
    ? d.toLocaleString('pt-PT', { timeZone: 'Africa/Maputo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding: 6px 0; font-size: 14px; color: #475569;">${label}</td><td style="padding: 6px 0; text-align: right; font-size: 14px; ${bold ? 'font-weight: bold;' : ''}">${value}</td></tr>`;

export function shiftCloseEmail(i: ShiftCloseInfo): { subject: string; html: string } {
    const d = Math.round(i.difference * 100) / 100;
    const diffText = d === 0 ? 'Caixa certa' : `${d < 0 ? 'Falta' : 'Sobra'} ${formatCurrency(Math.abs(d))}`;
    const diffColor = d === 0 ? '#15803d' : '#b91c1c';
    const by = i.closedBy && i.closedBy !== i.employee ? ` (fechado por ${escapeHtml(i.closedBy)})` : '';
    return {
        subject: `Turno fechado — ${i.employee} · ${diffText}`,
        html: `
<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 560px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background-color: #006194; color: #fff; padding: 16px 24px; font-size: 17px; font-weight: bold;">${escapeHtml(i.brand)} · Turno fechado</div>
  <div style="padding: 20px 24px;">
    <p style="margin: 0 0 4px; font-size: 16px;"><b>${escapeHtml(i.employee)}</b>${by} · ${escapeHtml(i.company)}</p>
    <p style="margin: 0 0 16px; font-size: 13px; color: #64748b;">${hhmm(i.openedAt)} → ${hhmm(i.closedAt)}</p>
    <div style="border: 2px solid ${diffColor}; border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; font-size: 16px; font-weight: bold; color: ${diffColor};">${diffText}</div>
    <table style="width: 100%; border-collapse: collapse;">
      ${row('Fundo de caixa', formatCurrency(i.openingCash))}
      ${row('Vendas em dinheiro', formatCurrency(i.totals.cash))}
      ${row('Dinheiro esperado', formatCurrency(i.expectedCash), true)}
      ${row('Dinheiro contado', formatCurrency(i.countedCash), true)}
    </table>
    <h3 style="font-size: 15px; margin: 20px 0 6px;">Recebido neste turno (${i.totals.count} venda${i.totals.count === 1 ? '' : 's'})</h3>
    <table style="width: 100%; border-collapse: collapse;">
      ${row('Dinheiro', formatCurrency(i.totals.cash))}
      ${row('M-Pesa / E-Mola', formatCurrency(i.totals.mobile))}
      ${row('POS / Cartão', formatCurrency(i.totals.card))}
      ${i.totals.other ? row('Outros', formatCurrency(i.totals.other)) : ''}
      ${row('Total', formatCurrency(i.totals.total), true)}
    </table>
    ${i.notes ? `<p style="margin: 16px 0 0; padding: 10px 14px; background: #f8fafc; border-radius: 8px; font-size: 13px;"><b>Nota:</b> ${escapeHtml(i.notes)}</p>` : ''}
    <p style="margin: 20px 0 0; font-size: 13px;"><a href="${i.appUrl}/rooms/controlo" style="color: #006194;">Ver todos os turnos</a></p>
  </div>
</div>`,
    };
}
