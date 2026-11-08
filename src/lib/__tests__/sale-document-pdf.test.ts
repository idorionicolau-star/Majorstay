import { describe, it, expect } from 'vitest';
import { buildSaleDocumentPDF, saleDocFileName, saleDocTotals } from '../sale-document-pdf';
import type { Company, Sale } from '../types';

const company = { id: 'c', name: 'Blocos Maputo Lda', address: 'Av. 24 de Julho, Maputo', taxId: '400123456', phone: '84 000 0000', businessType: 'manufacturer', paymentInfo: 'M-Pesa: 84 000 0000\nBCI: 0001 2345 6789' } as Company;
const line = (i: number, extra: Partial<Sale> = {}) => ({
  id: `s${i}`, date: '2026-10-01T10:00:00.000Z', productId: `p${i}`, productName: `Bloco ${i * 5} x 40`, quantity: 100 * i, unit: 'un',
  unitPrice: 35, subtotal: 3500 * i, totalValue: 3500 * i, amountPaid: 3500 * i, soldBy: 'Ana', guideNumber: 'FT 2026/0042',
  status: 'Pago', documentType: 'Factura', clientName: 'Construtora Sol', paymentMethod: 'M-Pesa', ...extra,
}) as Sale;

describe('documento de venda em PDF', () => {
  it('gera um PDF verdadeiro com todos os artigos e o total', async () => {
    const sales = [line(1, { discount: 500 }), line(2), line(3)];
    const doc = await buildSaleDocumentPDF(sales, company);
    const raw = doc.output();
    expect(raw.startsWith('%PDF-')).toBe(true);
    for (const t of ['FACTURA', 'FT 2026/0042', 'Construtora Sol', 'Bloco 5 x 40', 'Bloco 15 x 40', 'Total a pagar', 'INFORMA']) expect(raw).toContain(t);
    expect(saleDocTotals(sales).total).toBe(3500 + 7000 + 10500 - 500);
  });

  it('nome do ficheiro sem barras nem acentos', () => {
    expect(saleDocFileName({ documentType: 'Cotação', guideNumber: 'CT 2026/7' })).toBe('Cotacao_CT_2026_7.pdf');
  });
});
