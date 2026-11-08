// Modelo neutro de um documento (cotação, factura, recibo…) para o desenhar em PDF, venha de onde vier:
// de linhas de vendas (documentos já existentes) ou do editor de documentos.
import type { DocThemeId } from '@/lib/doc-themes';

export type DocumentType = 'Cotação' | 'Factura Proforma' | 'Factura' | 'Recibo' | 'Guia de Remessa' | 'Venda a Dinheiro';
export const DOCUMENT_TYPES: DocumentType[] = ['Cotação', 'Factura Proforma', 'Factura', 'Recibo', 'Guia de Remessa', 'Venda a Dinheiro'];

export type DocItem = {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    /** desconto desta linha, em % */
    discountPct?: number;
    /** valor da linha já calculado (vendas antigas); se existir, manda sobre quantidade × preço */
    lineTotal?: number;
};

export type DocClient = { name?: string; taxId?: string; address?: string; phone?: string; email?: string };

export type DocStyle = {
    theme?: DocThemeId;
    /** cor de destaque, "#rrggbb" */
    accent?: string;
    showLogo?: boolean;
    showSignatures?: boolean;
    /** linha de assinatura do cliente (opcional; desligada por defeito) */
    showClientSignature?: boolean;
    /** assinatura desenhada de quem emite / do cliente (data URL) */
    companySignature?: string;
    clientSignature?: string;
    signaturePlace?: string;
    footerNote?: string;
    /** "RASCUNHO", "ANULADO", "CÓPIA"… escrito na diagonal, a cinzento claro */
    watermark?: string;
};

export type DocModel = {
    type: DocumentType;
    number: string;
    issueDate: string;
    /** vencimento (facturas) ou validade (cotações) */
    dueDate?: string;
    client: DocClient;
    items: DocItem[];
    discount: number;
    /** IVA em valor e, se se souber, a taxa */
    vat: number;
    vatPct?: number;
    paid?: number;
    notes?: string;
    paymentTerms?: string;
    paymentMethod?: string;
    operator?: string;
    offlinePending?: boolean;
    style?: DocStyle;
};

export const docTitle = (type?: string): string => {
    switch (type) {
        case 'Factura Proforma': return 'Factura Proforma';
        case 'Cotação': return 'Cotação';
        case 'Venda a Dinheiro': return 'Venda a Dinheiro';
        case 'Guia de Remessa': return 'Guia de Remessa';
        case 'Recibo': return 'Recibo';
        default: return 'Factura';
    }
};

/** Propostas: não movem dinheiro nem são facturas. */
export const isQuoteLike = (type?: string) => type === 'Factura Proforma' || type === 'Cotação';

export const itemSubtotal = (i: Pick<DocItem, 'quantity' | 'unitPrice' | 'discountPct' | 'lineTotal'>) => {
    if (typeof i.lineTotal === 'number' && Number.isFinite(i.lineTotal)) return i.lineTotal;
    const gross = (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0);
    const d = Math.min(100, Math.max(0, Number(i.discountPct) || 0));
    return gross * (1 - d / 100);
};

/** Totais de um documento: subtotal das linhas, desconto geral, IVA e total. */
export function docTotals(m: Pick<DocModel, 'items' | 'discount' | 'vat' | 'paid'>) {
    const subtotal = m.items.reduce((t, i) => t + itemSubtotal(i), 0);
    const discount = Math.min(subtotal, Math.max(0, Number(m.discount) || 0));
    const vat = Math.max(0, Number(m.vat) || 0);
    const total = subtotal - discount + vat;
    const paid = Number(m.paid) || 0;
    return { subtotal, discount, vat, total, paid, due: Math.max(0, total - paid) };
}

/** IVA a partir da taxa, sobre o valor depois do desconto. */
export function vatFromPct(items: DocItem[], discount: number, pct: number) {
    const subtotal = items.reduce((t, i) => t + itemSubtotal(i), 0);
    return Math.max(0, subtotal - Math.min(subtotal, Math.max(0, discount))) * (Math.max(0, pct) / 100);
}
