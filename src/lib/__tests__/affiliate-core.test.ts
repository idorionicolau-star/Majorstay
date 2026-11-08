import { describe, expect, it } from 'vitest';
import { affiliateLink, checkAffiliate, clientCommission, suggestCode } from '../affiliate-core';

describe('afiliados', () => {
    it('código sugerido a partir do nome, sem repetir', () => {
        expect(suggestCode('Maria José', new Set(), () => 0.5)).toBe('MARIA55');
        expect(suggestCode('Éder', new Set(['EDER55']), (() => { let i = 0; return () => (i++ === 0 ? 0.5 : 0.1); })())).toBe('EDER19');
        expect(affiliateLink('MARIA55')).toBe('https://stock.majorgroup.app/register?codigo=MARIA55');
    });

    it('valida: nome, telefone, código único; comissão 40% / 12 meses por defeito; desconto opcional', () => {
        const taken = new Set(['MJTP86']);
        const ok = checkAffiliate({ name: ' Maria  José ', phone: '84 123 4567', code: 'maria55' }, taken, 899);
        expect(ok).toEqual({ ok: true, value: { code: 'MARIA55', name: 'Maria José', phone: '841234567', commissionPct: 40, commissionMonths: 12, clientPrice: null, clientMonths: null } });
        const withDiscount = checkAffiliate({ name: 'Ana', phone: '+258841234567', code: 'ANA10', clientPrice: '700' }, taken, 899);
        expect(withDiscount.ok && withDiscount.value.clientPrice === 700 && withDiscount.value.clientMonths === 3).toBe(true);
        expect(checkAffiliate({ name: 'A', phone: '841234567', code: 'AAAA' }, taken, 899).ok).toBe(false);
        expect(checkAffiliate({ name: 'Ana', phone: '8412', code: 'ANA10' }, taken, 899).ok).toBe(false);
        expect(checkAffiliate({ name: 'Ana', phone: '841234567', code: 'mjtp86' }, taken, 899)).toEqual({ ok: false, error: 'O código MJTP86 já existe.' });
        expect(checkAffiliate({ name: 'Ana', phone: '841234567', code: 'AN-1' }, taken, 899).ok).toBe(false);
        expect(checkAffiliate({ name: 'Ana', phone: '841234567', code: 'ANA10', clientPrice: '950' }, taken, 899).ok).toBe(false);
    });

    it('comissão: % do que foi pago nos 12 meses a seguir ao 1.º pagamento', () => {
        const now = new Date('2027-03-15T10:00:00Z');
        const pays = [
            { amount: 899, paidAt: '2026-10-20T10:00:00Z', status: 'paid' },
            { amount: 899, paidAt: '2026-11-20T10:00:00Z', status: 'paid' },
            { amount: 899, paidAt: '2027-03-10T10:00:00Z', status: 'paid' },
            { amount: 899, paidAt: '2027-11-01T10:00:00Z', status: 'paid' }, // já fora do ano
            { amount: 899, paidAt: '2026-12-01T10:00:00Z', status: 'failed' },
        ];
        const c = clientCommission(pays, 40, 12, now);
        expect(c.paidTotal).toBe(899 * 3);
        expect(c.commission).toBe(1078.8);
        expect(c.thisMonth).toBe(359.6);
        expect(c.endsAt).toBe('2027-10-20T10:00:00.000Z');
        expect(clientCommission([], 40, 12, now)).toEqual({ firstPaidAt: null, endsAt: null, paidTotal: 0, commission: 0, thisMonth: 0 });
    });
});
