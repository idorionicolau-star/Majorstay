import { describe, expect, it } from 'vitest';
import { companyHas, companyMaxRooms, companyMaxUsers, companyTierLabel, featureForPath, onLegacyPlan, resolvePayTier, tierAmount, tierFor } from '../tiers';

describe('planos MajorStay: preços', () => {
    it('Pro preços de hotelaria (1500 MT/mês)', () => {
        expect([tierAmount('pro', 'mensal'), tierAmount('pro', 'trimestral'), tierAmount('pro', 'anual')]).toEqual([1500, 4050, 15300]);
    });
    it('Business e Enterprise com desconto por período (10% trimestral, 15% anual)', () => {
        expect([tierAmount('business', 'mensal'), tierAmount('business', 'trimestral'), tierAmount('business', 'anual')]).toEqual([3500, 9450, 35700]);
        expect([tierAmount('enterprise', 'mensal'), tierAmount('enterprise', 'trimestral'), tierAmount('enterprise', 'anual')]).toEqual([7500, 20250, 76500]);
    });
    it('plano antigo paga o preço do Pro', () => {
        expect(tierAmount('atual', 'anual')).toBe(15300);
    });
});

describe('planos MajorStay: o que cada alojamento tem', () => {
    const pro = { status: 'active', tier: 'pro' };
    const business = { status: 'active', tier: 'business' };
    const enterprise = { status: 'active', tier: 'enterprise' };
    const antiga = { status: 'active' };
    const teste = { status: 'trial', tier: 'pro' };

    it('Pro: até 15 quartos, bar, reservas e documentos, 3 utilizadores', () => {
        expect(companyHas(pro, 'rooms')).toBe(true);
        expect(companyHas(pro, 'tapSell')).toBe(true);
        expect(companyHas(pro, 'bookings')).toBe(true);
        expect(companyHas(pro, 'documents')).toBe(true);
        expect(companyHas(pro, 'locations')).toBe(false);
        expect(companyMaxRooms(pro)).toBe(15);
        expect(companyMaxUsers(pro)).toBe(3);
    });
    it('Business: até 30 quartos, encomendas e variações sim, 10 utilizadores', () => {
        expect(companyHas(business, 'orders')).toBe(true);
        expect(companyHas(business, 'variants')).toBe(true);
        expect(companyHas(business, 'production')).toBe(true);
        expect(companyMaxRooms(business)).toBe(30);
        expect(companyMaxUsers(business)).toBe(10);
    });
    it('Enterprise: tudo, quartos e utilizadores ilimitados', () => {
        expect(companyHas(enterprise, 'production')).toBe(true);
        expect(companyHas(enterprise, 'locations')).toBe(true);
        expect(companyMaxRooms(enterprise)).toBeNull();
        expect(companyMaxUsers(enterprise)).toBeNull();
    });
    it('quem já pagava antes dos planos não perde nada (quartos e utilizadores ilimitados)', () => {
        expect(onLegacyPlan(antiga)).toBe(true);
        expect(companyHas(antiga, 'production')).toBe(true);
        expect(companyMaxRooms(antiga)).toBeNull();
        expect(companyMaxUsers(antiga)).toBeNull();
        expect(companyTierLabel(antiga)).toMatch(/Completo/);
    });
    it('em teste tudo aberto, mas não conta como plano antigo', () => {
        expect(companyHas(teste, 'production')).toBe(true);
        expect(companyMaxRooms(teste)).toBeNull();
        expect(onLegacyPlan({ status: 'trial' })).toBe(false);
    });
    it('a funcionalidade diz qual o plano mais barato que a tem', () => {
        expect(tierFor('locations').id).toBe('enterprise');
        expect(tierFor('orders').id).toBe('business');
    });
});

describe('planos: o que se pode pagar', () => {
    it('um nível válido é aceite; "atual" só no plano antigo', () => {
        expect(resolvePayTier('business', { status: 'active', tier: 'pro' })).toBe('business');
        expect(resolvePayTier('atual', { status: 'active' })).toBe('atual');
        expect(resolvePayTier('atual', { status: 'active', tier: 'pro' })).toBeNull();
        expect(resolvePayTier('atual', { status: 'trial' })).toBeNull();
        expect(resolvePayTier('ultra', { status: 'active' })).toBeNull();
    });
    it('pedido sem nível (app antiga): o que a empresa já tem', () => {
        expect(resolvePayTier(undefined, { status: 'active', tier: 'pro' })).toBe('pro');
        expect(resolvePayTier(undefined, { status: 'active' })).toBe('atual');
        expect(resolvePayTier(undefined, { status: 'trial' })).toBe('pro');
    });
});

describe('planos: páginas', () => {
    it('cada página da sua funcionalidade', () => {
        expect(featureForPath('/production')).toBe('production');
        expect(featureForPath('/raw-materials')).toBe('production');
        expect(featureForPath('/pos/catalogo')).toBe('tapSell');
        expect(featureForPath('/pos')).toBeNull();
        expect(featureForPath('/orders')).toBe('orders');
        expect(featureForPath('/ordersx')).toBeNull();
        expect(featureForPath('/dashboard')).toBeNull();
    });
});
