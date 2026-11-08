import { describe, expect, it } from 'vitest';
import { appFrames, formatContext, snippetAt } from '../error-context';

const O = 'https://stock.majorgroup.app';
const stack = `Error: Minified React error #310
    at a_ (${O}/_next/static/chunks/7f9e.js:1:64543)
    at Object.or [as useMemo] (${O}/_next/static/chunks/7f9e.js:1:72010)
    at r.useMemo (${O}/_next/static/chunks/c609.js:1:9864)
    at L (${O}/_next/static/chunks/7f9e.js:1:215435)
    at x (https://outro.site/_next/static/chunks/zz.js:1:5)
    at r.useMemo (${O}/_next/static/chunks/c609.js:1:9864)`;

describe('contexto do erro', () => {
    it('lê as linhas da pilha do próprio site, sem repetir e sem outros sites', () => {
        const f = appFrames(stack, O);
        expect(f.map((x) => `${x.file.split('/').pop()}:${x.col}`)).toEqual(['7f9e.js:64543', '7f9e.js:72010', 'c609.js:9864', '7f9e.js:215435']);
        expect(appFrames(undefined, O)).toEqual([]);
        expect(appFrames(stack, O, 2)).toHaveLength(2);
    });

    it('recorta o código à volta da coluna e marca o sítio exato', () => {
        const src = 'linha1\nfunction L(){let t=useMemo(()=>1);return "A carregar aplicação"}';
        expect(snippetAt(src, 2, 20, 10, 12)).toBe('L(){let t=⟦useMemo(()=>');
        expect(snippetAt(src, 9, 1)).toBe('⟦');
    });

    it('junta os pedaços sem passar do limite', () => {
        const fr = { file: `${O}/_next/static/chunks/c609.js`, line: 1, col: 9864 };
        const txt = formatContext([{ frame: fr, snippet: 'abc' }, { frame: fr, snippet: 'x'.repeat(100) }], 60);
        expect(txt).toBe('# c609.js:1:9864\nabc');
    });
});
