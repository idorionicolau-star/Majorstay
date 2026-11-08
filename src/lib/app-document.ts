// O documento tal como se guarda no Firestore (companies/{id}/documents/{docId}) e a sua passagem para o PDF.
import type { Company } from '@/lib/types';
import { docTotals, vatFromPct, type DocClient, type DocItem, type DocModel, type DocStyle, type DocumentType } from '@/lib/doc-model';
import { companyDocStyle } from '@/lib/sale-document-pdf';

export type DocStatus = 'draft' | 'issued' | 'cancelled';

export type AppDocument = {
    id: string;
    type: DocumentType;
    status: DocStatus;
    /** Em rascunho pode ficar vazio ou ser qualquer um; ao emitir fica fixo. */
    number: string;
    issueDate: string;
    /** vencimento (facturas) ou validade (cotações) */
    dueDate?: string;
    client: DocClient;
    items: DocItem[];
    /** desconto geral, em valor */
    discount: number;
    /** taxa de IVA em %, 0 = sem IVA */
    vatPct: number;
    notes?: string;
    paymentTerms?: string;
    paymentMethod?: string;
    style: DocStyle;
    /** valores calculados no momento de guardar, para as listas não terem de recalcular */
    totals: { subtotal: number; discount: number; vat: number; total: number };
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    issuedAt?: string;
    issuedBy?: string;
    cancelledAt?: string;
    cancelledBy?: string;
    cancelReason?: string;
    /** documento de onde este foi convertido */
    sourceId?: string;
    sourceNumber?: string;
};

/** Os campos que o utilizador edita (o resto é gerido pela app). */
export type DocDraft = Pick<AppDocument, 'type' | 'number' | 'issueDate' | 'dueDate' | 'client' | 'items' | 'discount' | 'vatPct' | 'notes' | 'paymentTerms' | 'paymentMethod' | 'style'>;

export const newItem = (): DocItem => ({ id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, description: '', quantity: 1, unit: 'un', unitPrice: 0 });

export function emptyDraft(type: DocumentType, number: string, company: Company | null): DocDraft {
    const quote = type === 'Cotação' || type === 'Factura Proforma';
    const issue = new Date();
    const due = new Date(issue.getTime() + (quote ? 15 : 15) * 864e5);
    return {
        type, number, issueDate: issue.toISOString(), dueDate: due.toISOString(),
        client: {}, items: [newItem()], discount: 0, vatPct: 0,
        style: { ...companyDocStyle(company), showSignatures: company?.documentShowSignatures !== false },
    };
}

export function draftTotals(d: Pick<DocDraft, 'items' | 'discount' | 'vatPct'>) {
    const vat = vatFromPct(d.items, d.discount, d.vatPct);
    const t = docTotals({ items: d.items, discount: d.discount, vat });
    return { subtotal: t.subtotal, discount: t.discount, vat: t.vat, total: t.total };
}

/** Só as linhas com descrição e quantidade contam num documento. */
export const validItems = (items: DocItem[]) => items.filter((i) => i.description.trim() && Number(i.quantity) > 0);

export function draftToModel(d: DocDraft, company: Company | null, extra: { status?: DocStatus; operator?: string } = {}): DocModel {
    const items = validItems(d.items);
    const vat = vatFromPct(items, d.discount, d.vatPct);
    // só o anulado leva marca de água; o rascunho sai limpo (o "RASCUNHO" atrapalhava enviar o documento)
    const wm = extra.status === 'cancelled' ? 'ANULADO' : undefined;
    const kept = d.style.watermark === 'RASCUNHO' ? undefined : d.style.watermark;
    return {
        type: d.type, number: d.number, issueDate: d.issueDate, dueDate: d.dueDate, client: d.client,
        items: items.length ? items : d.items, discount: d.discount, vat, vatPct: d.vatPct || undefined,
        notes: d.notes, paymentTerms: d.paymentTerms, paymentMethod: d.paymentMethod, operator: extra.operator,
        style: { ...companyDocStyle(company), ...d.style, watermark: wm ?? kept },
    };
}

export const docToDraft = (d: AppDocument): DocDraft => ({
    type: d.type, number: d.number, issueDate: d.issueDate, dueDate: d.dueDate, client: d.client, items: d.items,
    discount: d.discount, vatPct: d.vatPct, notes: d.notes, paymentTerms: d.paymentTerms, paymentMethod: d.paymentMethod, style: d.style,
});

/** Ordem natural de conversão: Cotação → Proforma → Factura → Recibo / Guia. */
export const CONVERT_TARGETS: Record<DocumentType, DocumentType[]> = {
    'Cotação': ['Factura Proforma', 'Factura'],
    'Factura Proforma': ['Factura'],
    'Factura': ['Recibo', 'Guia de Remessa'],
    'Recibo': [],
    'Guia de Remessa': ['Factura'],
    'Venda a Dinheiro': [],
};

/** Firestore recusa `undefined`: tira-o de um objecto (e dos filhos). */
export function stripUndefined<T>(v: T): T {
    return JSON.parse(JSON.stringify(v, (_k, val) => (val === undefined ? null : val)), (_k, val) => val) as T;
}
