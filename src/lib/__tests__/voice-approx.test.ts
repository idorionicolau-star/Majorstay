import { describe, expect, it } from 'vitest';
import { approxProducts, phonetic, resolveVoice, wordSimilarity } from '../voice-approx';
import { parseVoice } from '../voice-parse';
import type { Product } from '../types';

const p = (name: string): Product => ({ name, category: 'Geral', stock: 10, reservedStock: 0, price: 1, lowStockThreshold: 0, criticalStockThreshold: 0, lastUpdated: '', instanceId: name });
const inv = ['Afiador de Plástico', 'Apontador Metálico', 'Pavê Borbulha', 'Pavê Liso', 'Bandoleira', 'Cimento Cola', 'Cimento 32.5N', 'Bloco 15', 'Bloco 20', 'Colher de pedreiro'].map(p);
const say = (t: string) => resolveVoice(inv, parseVoice(t, inv.map((x) => x.name))[0]);
const names = (r: ReturnType<typeof say>) => (r.kind === 'confirm' ? r.options.map((o) => o.name) : r.kind === 'hit' ? [r.product.name] : []);

describe('fonética portuguesa', () => {
  it('palavras que soam igual têm a mesma chave', () => {
    expect(phonetic('cola')).toBe(phonetic('colla'));
    expect(phonetic('chave')).toBe(phonetic('xave'));
    expect(phonetic('cimento')).toBe(phonetic('simento'));
    expect(phonetic('pave')).toBe(phonetic('pavê'));
  });
  it('números nunca se confundem', () => {
    expect(wordSimilarity('15', '20')).toBe(0);
    expect(wordSimilarity('15', '15')).toBe(1);
  });
  it('parecidas pontuam alto, diferentes baixo', () => {
    expect(wordSimilarity('bandoleta', 'bandoleira')).toBeGreaterThan(0.7);
    expect(wordSimilarity('afiador', 'apontador')).toBeGreaterThan(0.5);
    expect(wordSimilarity('tijolo', 'cimento')).toBeLessThan(0.4);
  });
});

describe('o que a app faz com o que se disse', () => {
  it('certo → adiciona sem perguntar', () => {
    expect(names(say('afiador de plástico 15 unidades'))).toEqual(['Afiador de Plástico']);
    expect(say('afiador de plástico 15 unidades').kind).toBe('hit');
    expect(say('15 metros de pavê borbulha').kind).toBe('hit');
    expect(say('bloco quinze x 20').kind).toBe('hit');
  });
  it('parecido mas não certo → pede confirmação', () => {
    const r = say('bandoleta x 3');
    expect(r.kind).toBe('confirm');
    expect(names(r)[0]).toBe('Bandoleira');
    const q = say('15 afiadora de plástico');
    expect(q.kind).toBe('confirm');
    expect(names(q)[0]).toBe('Afiador de Plástico');
  });
  it('vários possíveis → pergunta qual', () => {
    const r = say('pavê x 10');
    expect(r.kind).toBe('confirm');
    expect(names(r).sort()).toEqual(['Pavê Borbulha', 'Pavê Liso']);
  });
  it('nada parecido → não encontrado', () => {
    expect(say('martelo de borracha x 2').kind).toBe('none');
  });
  it('a unidade que faz parte do nome ainda se encontra', () => {
    const lata = [p('Lata de tinta branca'), p('Tinta spray')];
    const r = resolveVoice(lata, parseVoice('duas latas de tinta branca', lata.map((x) => x.name))[0]);
    expect(r.kind === 'hit' && r.product.name).toBe('Lata de tinta branca');
  });
  it('ordena do mais parecido', () => {
    const top = approxProducts(inv, 'cimento cola', 3);
    expect(top[0].product.name).toBe('Cimento Cola');
    expect(top[0].score).toBeGreaterThan(0.95);
  });
});
