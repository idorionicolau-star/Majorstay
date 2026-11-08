import { describe, expect, it } from 'vitest';
import { companyHas, companyMaxUsers, companyTierLabel, featureForPath, onLegacyPlan, resolvePayTier, tierAmount, tierFor } from '../tiers';

describe('planos: preços', () => {
    it('Pro mantém os preços de sempre', () => {
        expect([tierAmount('pro', 'mensal'), tierAmount('pro', 'trimestral'), tierAmount('pro', 'anual')]).toEqual([1000, 2700, 10200]);
    });
    it('Básico e Business com o mesmo desconto por período', () => {
        expect([tierAmount('basico', 'mensal'), tierAmount('basico', 'trimestral'), tierAmount('basico', 'anual')]).toEqual([300, 810, 3060]);
        expect([tierAmount('business', 'mensal'), tierAmount('business', 'trimestral'), tierAmount('business', 'anual')]).toEqual([2000, 5400, 20400]);
    });
    it('plano antigo paga o preço do Pro', () => {
        expect(tierAmount('atual', 'anual')).toBe(10200);
    });
});

describe('planos: o que cada empresa tem', () => {
    const basico = { status: 'active', tier: 'basico' };
    const pro = { status: 'active', tier: 'pro' };
    const business = { status: 'active', tier: 'business' };
    const antiga = { status: 'active' };
    const teste = { status: 'trial', tier: 'basico' };

    it('Básico: sem produção, sem encomendas, 1 utilizador', () => {
        expect(companyHas(basico, 'production')).toBe(false);
        expect(companyHas(basico, 'orders')).toBe(false);
        expect(companyHas(basico, 'tapSell')).toBe(true); // vender por toque em todos os planos
        expect(companyMaxUsers(basico)).toBe(1);
    });
    it('Pro: encomendas e variações sim, produção não, 5 utilizadores', () => {
        expect(companyHas(pro, 'orders')).toBe(true);
        expect(companyHas(pro, 'variants')).toBe(true);
        expect(companyHas(pro, 'production')).toBe(false);
        expect(companyMaxUsers(pro)).toBe(5);
    });
    it('Business: tudo, sem limite de utilizadores', () => {
        expect(companyHas(business, 'production')).toBe(true);
        expect(companyHas(business, 'locations')).toBe(true);
        expect(companyMaxUsers(business)).toBeNull();
    });
    it('quem já pagava antes dos planos não perde nada', () => {
        expect(onLegacyPlan(antiga)).toBe(true);
        expect(companyHas(antiga, 'production')).toBe(true);
        expect(companyMaxUsers(antiga)).toBeNull();
        expect(companyTierLabel(antiga)).toMatch(/Completo/);
    });
    it('em teste tudo aberto, mas não conta como plano antigo', () => {
        expect(companyHas(teste, 'production')).toBe(true);
        expect(onLegacyPlan({ status: 'trial' })).toBe(false);
    });
    it('a funcionalidade diz qual o plano mais barato que a tem', () => {
        expect(tierFor('production').id).toBe('business');
        expect(tierFor('orders').id).toBe('pro');
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
        expect(resolvePayTier(undefined, { status: 'active', tier: 'basico' })).toBe('basico');
        expect(resolvePayTier(undefined, { status: 'active' })).toBe('atual');
        expect(resolvePayTier(undefined, { status: 'trial' })).toBe('pro');
    });
});

describe('planos: páginas', () => {
    it('cada página da sua funcionalidade', () => {
        expect(featureForPath('/production/new')).toBe('production');
        expect(featureForPath('/raw-materials')).toBe('production');
        expect(featureForPath('/pos/catalogo')).toBe('tapSell');
        expect(featureForPath('/pos')).toBeNull();
        expect(featureForPath('/orders')).toBe('orders');
        expect(featureForPath('/ordersx')).toBeNull();
        expect(featureForPath('/dashboard')).toBeNull();
    });
});
