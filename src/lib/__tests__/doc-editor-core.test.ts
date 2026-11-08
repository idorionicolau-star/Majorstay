import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, initHistory, pushHistory, redoHistory, undoHistory } from '../undo-history';
import { defaultPrefix, suggestNumber } from '../doc-number';
import { CONVERT_TARGETS, draftToModel, draftTotals, emptyDraft, validItems } from '../app-document';
import { docTotals, itemSubtotal, vatFromPct } from '../doc-model';

describe('desfazer / refazer', () => {
    it('desfaz e refaz por ordem', () => {
        let h = initHistory('a');
        h = pushHistory(h, 'b', { now: 0 });
        h = pushHistory(h, 'c', { now: 5000 });
        expect(h.present).toBe('c');
        h = undoHistory(h); expect(h.present).toBe('b');
        h = undoHistory(h); expect(h.present).toBe('a');
        expect(canUndo(h)).toBe(false);
        h = redoHistory(h); expect(h.present).toBe('b');
        expect(canRedo(h)).toBe(true);
        h = redoHistory(h); expect(h.present).toBe('c');
        expect(canRedo(h)).toBe(false);
    });
    it('uma alteração nova apaga o "refazer"', () => {
        let h = pushHistory(pushHistory(initHistory(1), 2, { now: 0 }), 3, { now: 5000 });
        h = undoHistory(h);
        h = pushHistory(h, 9, { now: 9000 });
        expect(canRedo(h)).toBe(false);
        expect(undoHistory(h).present).toBe(2);
    });
    it('escrever uma palavra (mesmo campo, seguido) é um só passo', () => {
        let h = initHistory('');
        for (const [i, v] of ['b', 'bl', 'blo', 'bloc', 'bloco'].entries()) h = pushHistory(h, v, { key: 'desc:1', now: i * 100 });
        expect(h.past.length).toBe(1);
        expect(undoHistory(h).present).toBe('');
    });
    it('campos diferentes ou pausa longa são passos diferentes', () => {
        let h = initHistory({ a: '', b: '' });
        h = pushHistory(h, { a: 'x', b: '' }, { key: 'a', now: 0 });
        h = pushHistory(h, { a: 'x', b: 'y' }, { key: 'b', now: 100 });
        expect(h.past.length).toBe(2);
        h = pushHistory(h, { a: 'xx', b: 'y' }, { key: 'a', now: 5000 });
        h = pushHistory(h, { a: 'xxx', b: 'y' }, { key: 'a', now: 9000 });
        expect(h.past.length).toBe(4);
    });
    it('valores iguais não criam passo e o histórico tem limite', () => {
        const h = initHistory({ n: 1 });
        expect(pushHistory(h, { n: 1 })).toBe(h);
        let big = initHistory(0);
        for (let i = 1; i <= 300; i++) big = pushHistory(big, i, { now: i * 5000 });
        expect(big.past.length).toBe(100);
    });
});

describe('numeração sugerida', () => {
    it('usa a numeração configurada', () => {
        const company = { documentNumbering: { 'Factura': { prefix: 'FT', separator: '-', nextNumber: 42, padding: 4 } }, saleCounter: 10 };
        expect(suggestNumber('Factura', company)).toEqual({ number: 'FT-0042', fromConfig: true });
    });
    it('sem configuração usa o contador geral', () => {
        expect(suggestNumber('Cotação', { saleCounter: 6 })).toEqual({ number: 'COT-000007', fromConfig: false });
        expect(suggestNumber('Recibo', null)).toEqual({ number: 'REC-000001', fromConfig: false });
    });
    it('prefixos por tipo', () => {
        expect(['Cotação', 'Factura Proforma', 'Factura', 'Recibo', 'Guia de Remessa', 'Venda a Dinheiro'].map(defaultPrefix)).toEqual(['COT', 'FP', 'FAT', 'REC', 'GR', 'VD']);
    });
});

describe('totais do documento', () => {
    const items = [
        { id: '1', description: 'Bloco', quantity: 100, unit: 'un', unitPrice: 35 },
        { id: '2', description: 'Cimento', quantity: 10, unit: 'saco', unitPrice: 650, discountPct: 10 },
    ];
    it('desconto por linha, desconto geral e IVA', () => {
        expect(itemSubtotal(items[1])).toBe(5850);
        const d = { ...emptyDraft('Factura', 'FAT-1', null), items, discount: 450, vatPct: 17 };
        const t = draftTotals(d);
        expect(t.subtotal).toBe(9350);
        expect(t.discount).toBe(450);
        expect(t.vat).toBeCloseTo((9350 - 450) * 0.17, 5);
        expect(t.total).toBeCloseTo(8900 + 1513, 5);
    });
    it('o desconto nunca passa do subtotal e o IVA nunca é negativo', () => {
        expect(docTotals({ items, discount: 99999, vat: -5 }).total).toBe(0);
        expect(vatFromPct(items, 0, -3)).toBe(0);
    });
    it('só linhas com descrição e quantidade contam', () => {
        expect(validItems([{ id: 'a', description: ' ', quantity: 1, unit: 'un', unitPrice: 1 }, { id: 'b', description: 'x', quantity: 0, unit: 'un', unitPrice: 1 }, items[0]]).length).toBe(1);
    });
});

describe('rascunho → modelo do PDF', () => {
    it('só o anulado leva marca de água; rascunho e emitido não', () => {
        const d = { ...emptyDraft('Factura', 'FAT-1', null), items: [{ id: '1', description: 'Bloco', quantity: 1, unit: 'un', unitPrice: 10 }] };
        expect(draftToModel(d, null, { status: 'draft' }).style?.watermark).toBeUndefined();
        expect(draftToModel({ ...d, style: { ...d.style, watermark: 'RASCUNHO' } }, null, { status: 'draft' }).style?.watermark).toBeUndefined();
        expect(draftToModel(d, null, { status: 'cancelled' }).style?.watermark).toBe('ANULADO');
        expect(draftToModel(d, null, { status: 'issued' }).style?.watermark).toBeUndefined();
    });
});

describe('conversões', () => {
    it('Cotação → Proforma → Factura → Recibo/Guia', () => {
        expect(CONVERT_TARGETS['Cotação']).toEqual(['Factura Proforma', 'Factura']);
        expect(CONVERT_TARGETS['Factura Proforma']).toEqual(['Factura']);
        expect(CONVERT_TARGETS['Factura']).toEqual(['Recibo', 'Guia de Remessa']);
        expect(CONVERT_TARGETS['Recibo']).toEqual([]);
    });
});
