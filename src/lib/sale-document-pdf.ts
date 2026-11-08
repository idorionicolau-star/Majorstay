// Documento de venda (factura, recibo, guia, proforma…) como PDF verdadeiro.
// Antes "Guardar PDF" abria só a janela de impressão do browser.
import type jsPDF from 'jspdf';
import type { Company, Sale } from './types';
import type { DocModel, DocStyle } from './doc-model';
import { renderDocPDF } from './doc-pdf';

export function saleDocTitle(type?: Sale['documentType']) {
    switch (type) {
        case 'Factura Proforma': return 'Factura Proforma';
        case 'Cotação': return 'Cotação';
        case 'Venda a Dinheiro': return 'Venda a Dinheiro';
        case 'Guia de Remessa': return 'Guia de Remessa';
        case 'Recibo': return 'Recibo';
        default: return 'Factura';
    }
}

export function saleDocFileName(sale: Pick<Sale, 'documentType' | 'guideNumber'>) {
    const safe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_');
    return `${safe(saleDocTitle(sale.documentType))}_${safe(sale.guideNumber || 'sem-numero')}.pdf`;
}

/** Totais do documento — mesma conta que o documento impresso. */
export function saleDocTotals(sales: Sale[]) {
    const subtotal = sales.reduce((t, s) => t + (Number(s.subtotal) || (Number(s.quantity) || 0) * (Number(s.unitPrice) || 0)), 0);
    const discount = sales.reduce((t, s) => t + (Number(s.discount) || 0), 0);
    const vat = sales.reduce((t, s) => t + (Number(s.vat) || 0), 0);
    const total = subtotal - discount + vat;
    const paid = sales.reduce((t, s) => t + (Number(s.amountPaid) || 0), 0);
    return { subtotal, discount, vat, total, paid };
}

/** O aspecto escolhido nas Definições → Documentos (tema, cor, rodapé, assinaturas). */
export function companyDocStyle(company: Company | null): DocStyle {
    return {
        theme: company?.documentTheme,
        accent: company?.documentAccent,
        footerNote: company?.documentFooterNote,
        signaturePlace: company?.documentSignaturePlace,
        showSignatures: company?.documentShowSignatures,
        showClientSignature: company?.documentShowClientSignature === true,
    };
}

/** Linhas de vendas (um documento = vários artigos) → modelo do documento. */
export function saleToDocModel(sales: Sale[], company: Company | null, style?: DocStyle): DocModel {
    const sale = sales[0];
    const t = saleDocTotals(sales);
    return {
        type: (sale.documentType || 'Factura') as DocModel['type'],
        number: sale.guideNumber || '',
        issueDate: sale.date,
        client: { name: sale.clientName },
        items: sales.map((s) => ({
            id: s.id,
            description: s.productName || '',
            quantity: Number(s.quantity) || 0,
            unit: s.unit || 'un',
            unitPrice: Number(s.unitPrice) || 0,
            lineTotal: Number(s.subtotal) || (Number(s.quantity) || 0) * (Number(s.unitPrice) || 0),
        })),
        discount: t.discount,
        vat: t.vat,
        paid: t.paid,
        notes: sales.map((s) => s.notes).filter(Boolean).join(' · ') || undefined,
        paymentMethod: sale.paymentMethod,
        operator: sale.soldBy,
        offlinePending: !!sale.offlinePending,
        style: { ...companyDocStyle(company), ...style },
    };
}

export async function buildSaleDocumentPDF(saleOrSales: Sale | Sale[], company: Company | null, style?: DocStyle): Promise<jsPDF> {
    const sales = (Array.isArray(saleOrSales) ? saleOrSales : [saleOrSales]).filter(Boolean);
    if (!sales.length) throw new Error('Documento sem artigos.');
    return renderDocPDF(saleToDocModel(sales, company, style), company);
}

/** Gera e descarrega o ficheiro .pdf do documento. */
export async function downloadSaleDocumentPDF(saleOrSales: Sale | Sale[], company: Company | null, style?: DocStyle) {
    const sales = Array.isArray(saleOrSales) ? saleOrSales : [saleOrSales];
    const doc = await buildSaleDocumentPDF(sales, company, style);
    doc.save(saleDocFileName(sales[0]));
}
