import { describe, expect, it } from 'vitest';
import { createScanGate, isGoodRead } from '../scan-gate';

describe('leitor: o mesmo artigo à frente da câmara conta uma vez', () => {
    it('mantido à frente da câmara durante 10 s: uma só leitura', () => {
        const g = createScanGate(1200);
        let n = 0;
        for (let t = 0; t <= 10_000; t += 150) if (g.seen('600123', t)) n++;
        expect(n).toBe(1);
    });

    it('sai da imagem e volta: conta outra vez', () => {
        const g = createScanGate(1200);
        expect(g.seen('600123', 0)).toBe(true);
        expect(g.seen('600123', 300)).toBe(false);
        expect(g.seen('600123', 2000)).toBe(true); // não foi visto durante 1,7 s
    });

    it('outro código conta logo, e voltar ao primeiro também', () => {
        const g = createScanGate(1200);
        expect(g.seen('A', 0)).toBe(true);
        expect(g.seen('B', 200)).toBe(true);
        expect(g.seen('A', 400)).toBe(true);
    });

    it('depois de reset, o mesmo código conta', () => {
        const g = createScanGate(1200);
        g.seen('A', 0);
        g.reset();
        expect(g.seen('A', 100)).toBe(true);
    });

    it('leitura boa = mensagem com ✓', () => {
        expect(isGoodRead('✓ Cimento × 2')).toBe(true);
        expect(isGoodRead('✗ Cimento — esgotado')).toBe(false);
        expect(isGoodRead(undefined)).toBe(false);
    });
});
