import { describe, expect, it } from 'vitest';
import { buildErrorDigest, errorKey, groupErrors, maputoTime } from '../error-digest';

const at = Date.parse('2026-10-17T12:05:00Z');

describe('resumo diário de erros', () => {
    it('o mesmo erro com números diferentes conta como um só', () => {
        expect(errorKey('Documento 4f9a2b7c1d não existe')).toBe(errorKey('Documento 99887766aa não existe'));
        expect(errorKey('Falhou ao gravar 3 vendas')).toBe('Falhou ao gravar # vendas');
    });

    it('agrupa, conta empresas e pessoas e ordena pelo mais frequente', () => {
        const g = groupErrors([
            { message: 'A', companyId: 'c1', email: 'a@x', at, url: '/pos' },
            { message: 'B', companyId: 'c1', email: 'a@x', at },
            { message: 'B', companyId: 'c2', email: 'b@x', at: at + 1000, url: '/sales' },
            { message: 'B', companyId: 'c2', email: 'b@x', at: at - 1000 },
        ]);
        expect(g.map((x) => [x.message, x.count])).toEqual([['B', 3], ['A', 1]]);
        expect(g[0]).toMatchObject({ companies: ['c1', 'c2'], users: 2, lastUrl: '/sales', lastAt: at + 1000 });
    });

    it('hora de Maputo (UTC+2)', () => {
        expect(maputoTime(at)).toBe('17/10 14:05');
    });

    it('sem erros: diz que está tudo bem (e quantos começaram o teste)', () => {
        const d = buildErrorDigest({ errors: [], billing: [], newCompanies: [{ id: 'n1', name: 'Blocos Lda' }], companyNames: {} });
        expect(d.total).toBe(0);
        expect(d.subject).toBe('✅ MajorStockX: sem erros nas últimas 24 h · 1 novo em teste');
        expect(d.html).toContain('Tudo a funcionar');
        expect(d.html).toContain('Blocos Lda');
    });

    it('com erros: assunto com o total, nomes das empresas e texto escapado', () => {
        const d = buildErrorDigest({
            errors: [{ message: '<script>x</script> falhou', companyId: 'c1', at, url: 'https://stock.majorgroup.app/pos' }],
            billing: [{ event: 'payment', error: 'assinatura inválida', at: '2026-10-17T10:00:00Z' }],
            newCompanies: [],
            companyNames: { c1: 'Ferragens & Filhos' },
        });
        expect(d.subject).toBe('⚠️ MajorStockX: 1 erro · 1 pagamento com erro nas últimas 24 h');
        expect(d.html).toContain('&lt;script&gt;');
        expect(d.html).not.toContain('<script>');
        expect(d.html).toContain('Ferragens &amp; Filhos');
        expect(d.html).toContain('>/pos<');
        expect(d.html).toContain('assinatura inválida');
    });
});
