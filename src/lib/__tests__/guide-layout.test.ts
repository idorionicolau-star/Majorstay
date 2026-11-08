import { describe, it, expect } from 'vitest';
import { holeFor, keyboardOpen, placePopover, routeMatches, shadesAround } from '@/lib/guide-layout';

describe('guias: geometria', () => {
    it('buraco com folga, sem sair do ecrã', () => {
        expect(holeFor({ top: 100, left: 50, width: 200, height: 40 }, 400, 800)).toEqual({ top: 94, left: 44, width: 212, height: 52 });
        expect(holeFor({ top: -20, left: -10, width: 500, height: 900 }, 400, 800)).toEqual({ top: 0, left: 0, width: 400, height: 800 });
    });
    it('as 4 faixas cobrem tudo menos o buraco', () => {
        const h = { top: 100, left: 50, width: 100, height: 50 };
        const s = shadesAround(h, 400, 800);
        const area = s.reduce((t, b) => t + b.width * b.height, 0);
        expect(area + h.width * h.height).toBe(400 * 800);
    });
    it('telemóvel: o balão fica do lado oposto ao elemento', () => {
        expect(placePopover({ top: 600, left: 10, width: 300, height: 50 }, 390, 844).side).toBe('dock-top');
        expect(placePopover({ top: 100, left: 10, width: 300, height: 50 }, 390, 844).side).toBe('dock-bottom');
    });
    it('computador: por baixo se couber, senão por cima', () => {
        expect(placePopover({ top: 100, left: 400, width: 200, height: 40 }, 1280, 900).side).toBe('below');
        expect(placePopover({ top: 780, left: 400, width: 200, height: 40 }, 1280, 900).side).toBe('above');
        expect(placePopover(null, 1280, 900).side).toBe('center');
    });
    it('compara o endereço do passo', () => {
        expect(routeMatches('/pos?demo=1', '/pos', '?demo=1')).toBe(true);
        expect(routeMatches('/pos?demo=1', '/pos', '')).toBe(false);
        expect(routeMatches('/catalog', '/catalog', '?x=1')).toBe(true);
        expect(routeMatches('/catalog', '/pos', '')).toBe(false);
    });
    it('telemóvel com teclado aberto: o balão fica na parte visível, junto ao campo', () => {
        const visible = { top: 0, height: 420 }; // teclado tapa a metade de baixo
        expect(keyboardOpen(844, visible)).toBe(true);
        expect(keyboardOpen(844, { top: 0, height: 844 })).toBe(false);
        // campo em cima → balão por baixo dele, acima do teclado
        const a = placePopover({ top: 80, left: 10, width: 300, height: 50 }, 390, 844, 150, 360, visible);
        expect(a.side).toBe('below');
        expect(a.top! + 150).toBeLessThanOrEqual(420);
        // campo em baixo da área visível → balão por cima dele
        expect(placePopover({ top: 330, left: 10, width: 300, height: 50 }, 390, 844, 150, 360, visible).side).toBe('above');
        // sem espaço nenhum → encosta ao topo da área visível (nunca atrás do teclado)
        const c = placePopover({ top: 150, left: 10, width: 300, height: 120 }, 390, 844, 200, 360, visible);
        expect(c.side).toBe('dock-top');
        expect(c.top).toBe(8);
    });
    it('telemóvel sem teclado: encostado em baixo usa top (não fica por trás de nada)', () => {
        const p = placePopover({ top: 100, left: 10, width: 300, height: 50 }, 390, 844, 200);
        expect(p.side).toBe('dock-bottom');
        expect(p.top).toBe(844 - 200 - 12);
    });
});
