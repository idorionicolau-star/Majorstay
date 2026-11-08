import { describe, it, expect } from 'vitest';
import { companyStanding, fromDateInput, standingOrder, toDateInput } from '@/lib/admin-subscription';

const now = new Date('2026-10-13T10:00:00Z'); // 12:00 em Maputo

describe('Administração: tempo restante', () => {
    it('teste', () => {
        expect(companyStanding({ status: 'trial', trialEndsAt: '2026-10-20T09:00:00Z' }, now)).toMatchObject({ kind: 'trial', daysLeft: 7, label: 'Teste: faltam 7 dias' });
        expect(companyStanding({ status: 'trial', trialEndsAt: '2026-10-13T20:00:00Z' }, now).label).toBe('Teste acaba hoje');
        expect(companyStanding({ status: 'trial', trialEndsAt: '2026-10-10T09:00:00Z' }, now)).toMatchObject({ kind: 'trial_expired', label: 'Teste acabou há 3 dias' });
    });
    it('subscrição, tolerância e expirada', () => {
        expect(companyStanding({ status: 'active', subscriptionEndsAt: '2026-11-13T04:33:00Z' }, now)).toMatchObject({ kind: 'active', daysLeft: 31 });
        expect(companyStanding({ status: 'active', subscriptionEndsAt: '2026-10-12T09:00:00Z' }, now)).toMatchObject({ kind: 'grace', label: 'Em tolerância — acabou há 1 dia' });
        expect(companyStanding({ status: 'active', subscriptionEndsAt: '2026-10-01T09:00:00Z' }, now)).toMatchObject({ kind: 'expired', label: 'Subscrição acabou há 12 dias' });
        expect(companyStanding({ status: 'active' }, now).kind).toBe('active_open');
        expect(companyStanding({}, now).kind).toBe('active_open');
        expect(companyStanding({ status: 'suspended' }, now).kind).toBe('suspended');
    });
    it('ordem: tolerância, depois o que acaba mais cedo; expiradas e suspensas no fim', () => {
        const list = [
            { n: 'sus', s: companyStanding({ status: 'suspended' }, now) },
            { n: 'a30', s: companyStanding({ status: 'active', subscriptionEndsAt: '2026-11-12T10:00:00Z' }, now) },
            { n: 't2', s: companyStanding({ status: 'trial', trialEndsAt: '2026-10-15T10:00:00Z' }, now) },
            { n: 'exp', s: companyStanding({ status: 'active', subscriptionEndsAt: '2026-09-01T10:00:00Z' }, now) },
            { n: 'grace', s: companyStanding({ status: 'active', subscriptionEndsAt: '2026-10-12T10:00:00Z' }, now) },
        ].sort((a, b) => standingOrder(a.s) - standingOrder(b.s)).map((x) => x.n);
        expect(list).toEqual(['grace', 't2', 'a30', 'exp', 'sus']);
    });
    it('datas: ISO ↔ caixa de data (dia de Maputo)', () => {
        expect(toDateInput('2026-10-20T23:30:00Z')).toBe('2026-10-21');
        expect(toDateInput('')).toBe('');
        expect(fromDateInput('2026-10-21')).toBe('2026-10-21T21:59:59.000Z');
        expect(fromDateInput('21/10/2026')).toBeNull();
        expect(toDateInput(fromDateInput('2026-10-21'))).toBe('2026-10-21');
    });
});
