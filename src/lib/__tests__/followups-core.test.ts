import { describe, it, expect } from 'vitest';
import { countEvery, followupEmail, latestActivity, nextFollowup, type CompanyFacts } from '@/lib/followups-core';

const now = new Date('2026-10-13T08:00:00Z'); // 10:00 em Maputo
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const ahead = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();
const base = (o: Partial<CompanyFacts> = {}): CompanyFacts => ({
    status: 'trial', trialEndsAt: ahead(10), startedAt: ago(4), lastActiveAt: ago(0),
    hasProducts: true, hasSale: true, countedRecently: true, tipsAllowed: true, sent: {}, ...o,
});

describe('Follow-ups: prazos', () => {
    it('teste: faltam 3 dias, último dia, acabou', () => {
        expect(nextFollowup(base({ trialEndsAt: ahead(2.5) }), now)?.type).toBe('trial-3d');
        expect(nextFollowup(base({ trialEndsAt: new Date('2026-10-13T20:00:00Z').toISOString() }), now)?.type).toBe('trial-last');
        expect(nextFollowup(base({ trialEndsAt: ago(2) }), now)?.type).toBe('trial-ended');
        expect(nextFollowup(base({ trialEndsAt: ahead(10) }), now)).toBeNull();
    });
    it('cada aviso vai uma vez (por data de fim)', () => {
        const f = base({ trialEndsAt: ahead(2.5) });
        const first = nextFollowup(f, now)!;
        expect(nextFollowup({ ...f, sent: { [first.key]: ago(1.5) } }, now)).toBeNull();
    });
    it('subscrição a acabar e acabada', () => {
        expect(nextFollowup(base({ status: 'active', subscriptionEndsAt: ahead(2), trialEndsAt: null }), now)?.type).toBe('sub-3d');
        expect(nextFollowup(base({ status: 'active', subscriptionEndsAt: ago(1), trialEndsAt: null }), now)?.type).toBe('sub-ended');
    });
    it('os prazos vão mesmo sem dicas e mesmo com a semana cheia; suspensa não recebe nada', () => {
        const sent = { a: ago(2), b: ago(3), c: ago(4) };
        expect(nextFollowup(base({ trialEndsAt: ahead(2.5), tipsAllowed: false, sent }), now)?.type).toBe('trial-3d');
        expect(nextFollowup(base({ status: 'suspended', trialEndsAt: ahead(2) }), now)).toBeNull();
    });
});

describe('Follow-ups: primeiros passos e falta de uso', () => {
    it('sem produtos ao fim de 2 dias; sem venda ao fim de 3', () => {
        expect(nextFollowup(base({ hasProducts: false, hasSale: false, startedAt: ago(2) }), now)?.type).toBe('start-products');
        expect(nextFollowup(base({ hasProducts: false, startedAt: ago(1) }), now)).toBeNull();
        expect(nextFollowup(base({ hasSale: false, startedAt: ago(3) }), now)?.type).toBe('start-sale');
    });
    it('5 e 14 dias sem abrir a app (uma vez cada)', () => {
        expect(nextFollowup(base({ lastActiveAt: ago(6) }), now)?.type).toBe('inactive-5');
        const f = base({ lastActiveAt: ago(15) });
        const n = nextFollowup(f, now)!;
        expect(n.type).toBe('inactive-14');
        expect(nextFollowup({ ...f, sent: { [n.key]: ago(2), [`inactive-5:${n.key.split(':')[1]}`]: ago(9) } }, now)).toBeNull();
    });
    it('sem último acesso registado (contas antigas): não conta como falta de uso', () => {
        expect(nextFollowup(base({ lastActiveAt: null, startedAt: ago(60) }), now)).toBeNull();
    });
    it('quem pediu para não receber dicas não recebe', () => {
        expect(nextFollowup(base({ lastActiveAt: ago(6), tipsAllowed: false }), now)).toBeNull();
    });
    it('conta acabada há mais de 14 dias: sem dicas', () => {
        expect(nextFollowup(base({ trialEndsAt: ago(20), lastActiveAt: ago(20), sent: { [`trial-ended:${ago(20).slice(0, 10)}`]: ago(19) } }), now)).toBeNull();
    });
});

describe('Follow-ups: contagem', () => {
    const paid = (o: Partial<CompanyFacts>) => base({ status: 'active', trialEndsAt: null, subscriptionEndsAt: ahead(40), startedAt: ago(60), ...o });
    it('sem contagem há 30 dias, quem usa a app recebe; repete só passado o prazo', () => {
        expect(nextFollowup(paid({ countedRecently: false }), now)?.type).toBe('count');
        expect(nextFollowup(paid({ countedRecently: false, sent: { count: ago(10) } }), now)).toBeNull();
        expect(nextFollowup(paid({ countedRecently: false, sent: { count: ago(31) } }), now)?.type).toBe('count');
        expect(nextFollowup(paid({ countedRecently: true }), now)).toBeNull();
        expect(nextFollowup(paid({ countedRecently: null }), now)).toBeNull();
    });
    it('empresa nova (menos dias que o prazo) não recebe ainda', () => {
        expect(nextFollowup(base({ countedRecently: false, startedAt: ago(10) }), now)).toBeNull();
    });
    it('prazo: 7 a 180 dias, por defeito 30', () => {
        expect(countEvery(undefined)).toBe(30);
        expect(countEvery(3)).toBe(30);
        expect(countEvery(15)).toBe(15);
    });
});

describe('Follow-ups: limites', () => {
    it('no máximo 1 por dia e 3 dicas por semana', () => {
        expect(nextFollowup(base({ lastActiveAt: ago(6), sent: { x: ago(0.5) } }), now)).toBeNull();
        expect(nextFollowup(base({ lastActiveAt: ago(6), sent: { a: ago(1.5), b: ago(3), c: ago(5) } }), now)).toBeNull();
        expect(nextFollowup(base({ lastActiveAt: ago(6), sent: { a: ago(1.5), b: ago(3), c: ago(9) } }), now)?.type).toBe('inactive-5');
    });
});

describe('Follow-ups: email', () => {
    const ctx = { company: 'Loja <X>', name: 'Ana Maria', appUrl: 'https://stock.majorgroup.app', whatsappUrl: 'https://wa.me/258842333717', unsubscribeUrl: 'https://stock.majorgroup.app/api/email/unsubscribe?c=1&t=2' };
    it('dicas têm o link para sair; avisos de prazo não', () => {
        const tip = followupEmail({ type: 'start-sale', kind: 'tips', key: 'start-sale' }, ctx);
        expect(tip.html).toContain('Olá, Ana!');
        expect(tip.html).toContain('href="https://stock.majorgroup.app/pos"');
        expect(tip.html).toContain('Não quero receber estas dicas');
        expect(tip.html).toContain('Loja &lt;X&gt;');
        const acc = followupEmail({ type: 'trial-3d', kind: 'account', key: 'k' }, { ...ctx, trialEndsAt: '2026-10-16T10:00:00Z' });
        expect(acc.html).not.toContain('Não quero receber');
        expect(acc.html).toContain('16 de outubro');
    });
});

describe('Follow-ups: último uso conta também o trabalho feito offline', () => {
    it('vendas e movimentos mais recentes que o "abri a app" contam como uso', () => {
        expect(latestActivity(ago(8), [ago(1), null], now)).toBe(ago(1));
        expect(latestActivity(ago(1), [ago(8)], now)).toBe(ago(1));
        // o caso do problema: abriu a app há 8 dias sem internet, vendeu offline ontem → não é "falta de uso"
        expect(nextFollowup(base({ lastActiveAt: latestActivity(ago(8), [ago(1)], now) }), now)).toBeNull();
    });
    it('datas no futuro não contam; contas sem registo continuam sem data', () => {
        expect(latestActivity(ago(8), [ahead(3)], now)).toBe(ago(8));
        expect(latestActivity(null, [ago(1)], now)).toBeNull();
    });
});
