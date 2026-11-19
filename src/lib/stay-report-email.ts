// Secções do email do fecho do dia com as estadias e as viaturas. Sem telefone nem BI do hóspede (o email pode ser reencaminhado).
import { escapeHtml } from '@/lib/daily-report';
import { formatCurrency } from '@/lib/utils';
import { hhmmMaputo, dayTimeMaputo, staysTotals, type StayRow } from '@/lib/stay-report';

const MAX_SHOWN = 60;
const cell = 'padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 14px;';
const h3 = (t: string) => `<h3 style="font-size: 16px; margin: 24px 0 8px;">${t}</h3>`;
const more = (n: number) => n > 0 ? `<p style="font-size: 13px; color: #64748b; margin: 6px 0 0;">e mais ${n} no painel.</p>` : '';

export function paymentsHtml(payments: { method: string; amount: number }[]): string {
    if (!payments.length) return '';
    return `${h3('💳 Recebido por forma de pagamento')}
<table style="width: 100%; border-collapse: collapse;">
${payments.map((p) => `<tr><td style="${cell}">${escapeHtml(p.method)}</td><td style="${cell} text-align: right; white-space: nowrap; font-weight: bold;">${formatCurrency(p.amount)}</td></tr>`).join('')}
</table>`;
}

export function staysHtml(rows: StayRow[]): string {
    if (!rows.length) return '';
    const t = staysTotals(rows);
    const items = rows.slice(0, MAX_SHOWN).map((r) => {
        const vehicle = r.vehicle
            ? `<span style="font-weight: bold; color: #0369a1;">🚗 ${escapeHtml(r.vehicle)}</span>`
            : '<span style="color: #b45309;">🚗 sem viatura registada</span>';
        const hours = `${r.billedHours || r.contractedHours}h${r.package ? ` (${r.package})` : ''}${r.extensionsCount ? `, ${r.extensionsCount} prorrogaç${r.extensionsCount === 1 ? 'ão' : 'ões'}` : ''}`;
        const people = [r.checkInBy && `check-in: ${escapeHtml(r.checkInBy)}`, r.checkOutBy && `check-out: ${escapeHtml(r.checkOutBy)}`].filter(Boolean).join(' · ');
        return `<tr><td style="${cell}">
  <div><b>${escapeHtml(r.room)}</b> · ${hhmmMaputo(r.checkIn)} → ${hhmmMaputo(r.checkOut)} · ${hours}</div>
  <div>${vehicle}</div>
  <div style="color: #475569; font-size: 13px;">${escapeHtml(r.client)} · Quarto ${formatCurrency(r.roomAmount)}${r.consumptionsAmount > 0 ? ` + Bar ${formatCurrency(r.consumptionsAmount)}` : ''}${r.discount > 0 ? ` − Desconto ${formatCurrency(r.discount)}` : ''} = <b>${formatCurrency(r.total)}</b>${r.paymentMethod ? ` · ${escapeHtml(r.paymentMethod)}` : ''}</div>
  ${people ? `<div style="color: #94a3b8; font-size: 12px;">${people}</div>` : ''}
</td></tr>`;
    }).join('');
    return `${h3(`🛏️ Estadias (${t.count})`)}
<p style="margin: 0 0 8px; font-size: 14px;">Quartos <b>${formatCurrency(t.rooms)}</b> · Bar <b>${formatCurrency(t.bar)}</b>${t.discount ? ` · Descontos ${formatCurrency(t.discount)}` : ''} · Total <b style="color: #15803d;">${formatCurrency(t.total)}</b></p>
<table style="width: 100%; border-collapse: collapse;">${items}</table>${more(rows.length - MAX_SHOWN)}`;
}

export function parkedHtml(rows: StayRow[]): string {
    if (!rows.length) return '';
    return `${h3(`🚗 Viaturas no parque agora (${rows.length})`)}
<table style="width: 100%; border-collapse: collapse;">
${rows.slice(0, MAX_SHOWN).map((r) => `<tr>
  <td style="${cell}"><b>${escapeHtml(r.room)}</b><br/><span style="color: #475569; font-size: 13px;">${escapeHtml(r.client)}</span></td>
  <td style="${cell}">${r.vehicle ? `<b style="color: #0369a1;">${escapeHtml(r.vehicle)}</b>` : '<span style="color: #b45309;">sem viatura registada</span>'}</td>
  <td style="${cell} text-align: right; white-space: nowrap; color: #64748b;">entrou ${dayTimeMaputo(r.checkIn)}</td>
</tr>`).join('')}
</table>${more(rows.length - MAX_SHOWN)}`;
}

export function noPlateHtml(rooms: string[]): string {
    if (!rooms.length) return '';
    return `<div style="background-color: #fffbeb; border: 1px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin: 20px 0; font-size: 14px;">
⚠️ <b>${rooms.length} check-in${rooms.length === 1 ? '' : 's'} sem matrícula registada</b>: ${rooms.map(escapeHtml).join(', ')}.
</div>`;
}
