import { describe, expect, it } from 'vitest';
import { DRAFT_TTL_MS, catalogDraftHasContent, clearDraft, readDraft, writeDraft } from '../form-draft';

const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), _m: m };
};

describe('rascunho de formulário', () => {
    it('guarda e devolve o que foi escrito', () => {
        const s = memory();
        writeDraft('k', { name: 'Cimento', barcode: '123' }, 1000, s);
        expect(readDraft('k', 2000, s)).toEqual({ name: 'Cimento', barcode: '123' });
    });

    it('passadas 24 horas já não vale (e é apagado)', () => {
        const s = memory();
        writeDraft('k', { name: 'Velho' }, 0, s);
        expect(readDraft('k', DRAFT_TTL_MS - 1, s)).toEqual({ name: 'Velho' });
        expect(readDraft('k', DRAFT_TTL_MS + 1, s)).toBeNull();
        expect(s._m.has('k')).toBe(false);
    });

    it('a foto grande não entra no rascunho, o resto sim', () => {
        const s = memory();
        writeDraft('k', { name: 'Tinta', imageUrl: 'data:image/png;base64,' + 'A'.repeat(200_000) }, 0, s);
        expect(readDraft('k', 1, s)).toEqual({ name: 'Tinta' });
    });

    it('apagar limpa; dados estragados ou sem armazenamento não rebentam', () => {
        const s = memory();
        writeDraft('k', { name: 'X' }, 0, s);
        clearDraft('k', s);
        expect(readDraft('k', 1, s)).toBeNull();
        s.setItem('k', '{não é json');
        expect(readDraft('k', 1, s)).toBeNull();
        expect(readDraft('k', 1, null)).toBeNull();
        expect(() => writeDraft('k', { a: 1 }, 0, null)).not.toThrow();
        const cheio = { ...memory(), setItem: () => { throw new Error('quota'); } };
        expect(() => writeDraft('k', { a: 1 }, 0, cheio)).not.toThrow();
    });

    it('só conta como rascunho se há algo escrito', () => {
        expect(catalogDraftHasContent({ name: '', barcode: '', price: 0, cost: 0, stock: 0 })).toBe(false);
        expect(catalogDraftHasContent({ name: '  ' })).toBe(false);
        expect(catalogDraftHasContent({ name: 'Cimento' })).toBe(true);
        expect(catalogDraftHasContent({ barcode: '789' })).toBe(true);
        expect(catalogDraftHasContent({ price: '650' })).toBe(true);
        expect(catalogDraftHasContent({ stock: '12,5' })).toBe(true);
        expect(catalogDraftHasContent(undefined)).toBe(false);
    });
});
