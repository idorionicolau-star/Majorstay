// Recibo curto para enviar por WhatsApp depois da venda (aqui quase ninguém usa email). Puro, para testes.
import type { CartItem } from '@/lib/types';

/** Número para o wa.me: só dígitos; um número moçambicano de 9 dígitos (8x…) ganha o 258. */
export function waPhone(phone?: string | null): string | null {
    const d = (phone || '').replace(/\D/g, '').replace(/^00/, '');
    if (!d) return null;
    if (d.length === 9 && d.startsWith('8')) return `258${d}`;
    return d.length >= 9 ? d : null;
}

export function receiptText(o: { company?: string; client?: string; items: CartItem[]; total: number; date: Date; money: (n: number) => string }): string {
    const lines: string[] = [];
    if (o.company) lines.push(`*${o.company}*`);
    lines.push(`Recibo de ${o.date.toLocaleDateString('pt-PT')}${o.client ? ` · ${o.client}` : ''}`, '');
    for (const i of o.items) lines.push(`${i.quantity} ${i.unit || 'un'} × ${i.productName} = ${o.money(i.subtotal)}`);
    lines.push('', `*Total: ${o.money(o.total)}*`, 'Obrigado pela preferência!');
    return lines.join('\n');
}

export const waShareLink = (text: string, phone?: string | null) => {
    const to = waPhone(phone);
    return `https://wa.me/${to || ''}?text=${encodeURIComponent(text)}`;
};
