import { describe, it, expect } from 'vitest';
import { shiftCloseEmail } from '@/lib/shift-email';

const base = {
    company: 'Blue <Ocean>', brand: 'MajorStay', appUrl: 'https://stay.majorgroup.app', employee: 'Ana',
    openedAt: new Date('2026-11-23T17:00:00Z'), closedAt: new Date('2026-11-24T05:00:00Z'),
    openingCash: 500, countedCash: 1900, expectedCash: 2000, difference: -100,
    totals: { cash: 1500, mobile: 300, card: 0, other: 0, total: 1800, count: 7 },
};

describe('shiftCloseEmail', () => {
    it('diz quem fechou, a diferença e o recebido', () => {
        const m = shiftCloseEmail({ ...base, notes: 'troco <b>' });
        expect(m.subject).toContain('Ana');
        expect(m.subject).toContain('Falta');
        expect(m.html).toContain('7 vendas');
        expect(m.html).toContain('Blue &lt;Ocean&gt;');
        expect(m.html).toContain('troco &lt;b&gt;');
        expect(m.html).toContain('/rooms/controlo');
    });
    it('caixa certa e fechado por outra pessoa', () => {
        const m = shiftCloseEmail({ ...base, difference: 0, countedCash: 2000, closedBy: 'Gerente' });
        expect(m.subject).toContain('Caixa certa');
        expect(m.html).toContain('fechado por Gerente');
    });
});
