import { describe, expect, it } from 'vitest';
import { pickVoiceMatch, searchProducts } from '../quick-stock';
import { parseVoice } from '../voice-parse';
import type { Product } from '../types';

const p = (name: string): Product => ({ name, category: 'Geral', stock: 10, reservedStock: 0, price: 1, lowStockThreshold: 0, criticalStockThreshold: 0, lastUpdated: '', instanceId: name });
const catalog = ['Banco Praça', 'Banco Simples', 'Bloco 15', 'Bloco 20', 'Cimento Cola', 'Cimento 32.5N', 'Passadeira 8 Pistões', 'Passadeira Circular', 'Mesa Rectangular', 'Pó de pedra', 'Colher de pedreiro', 'Grelha Quadrada'].map(p);

/** O que a app faz com o que se disse: interpreta (com os nomes do inventário) e procura o primeiro item. */
const names = catalog.map((c) => c.name);
const say = (text: string) => {
    const it = parseVoice(text, names)[0];
    return { qty: it?.qty, hit: it ? searchProducts(catalog, it.term, 1)[0]?.name : undefined };
};

describe('procura por voz', () => {
    it('plural encontra o nome no singular', () => {
        expect(say('bancos praça x dois')).toEqual({ qty: 2, hit: 'Banco Praça' });
        expect(say('grelhas quadradas x 5')).toEqual({ qty: 5, hit: 'Grelha Quadrada' });
        expect(say('colheres de pedreiro x 3')).toEqual({ qty: 3, hit: 'Colher de pedreiro' });
    });
    it('palavras de ligação não impedem', () => {
        expect(say('blocos de quinze x cem')).toEqual({ qty: 100, hit: 'Bloco 15' });
        expect(say('pó pedra')).toMatchObject({ hit: 'Pó de pedra' });
    });
    it('um número no nome é tamanho, não quantidade', () => {
        expect(say('bloco quinze')).toEqual({ qty: null, hit: 'Bloco 15' });
        expect(say('bloco vinte')).toEqual({ qty: null, hit: 'Bloco 20' });
        expect(say('passadeira oito pistões')).toEqual({ qty: null, hit: 'Passadeira 8 Pistões' });
        expect(say('passadeira oito pistões x vinte')).toEqual({ qty: 20, hit: 'Passadeira 8 Pistões' });
    });
    it('quantidade com x colado', () => {
        expect(say('cimento cola x20')).toEqual({ qty: 20, hit: 'Cimento Cola' });
        expect(say('x20 cimento cola')).toEqual({ qty: 20, hit: 'Cimento Cola' });
    });
    it('erros pequenos do ditado', () => {
        expect(say('cimento colla').hit).toBe('Cimento Cola');
        expect(say('mesa retangular').hit).toBe('Mesa Rectangular');
    });
    it('com vários parecidos não adivinha: pergunta', () => {
        const r = pickVoiceMatch(catalog, 'bloco');
        expect(r.hit).toBeUndefined();
        expect(r.ambiguous.map((x) => x.name).sort()).toEqual(['Bloco 15', 'Bloco 20']);
        expect(pickVoiceMatch(catalog, 'bloco 15').hit?.name).toBe('Bloco 15');
        expect(pickVoiceMatch(catalog, 'banco praca').hit?.name).toBe('Banco Praça');
        expect(pickVoiceMatch(catalog, 'tijolo').hit).toBeUndefined();
    });
    it('o que não existe continua a não ser encontrado', () => {
        expect(say('tijolo vermelho').hit).toBeUndefined();
        expect(searchProducts(catalog, 'bloco 99')).toEqual([]);
    });
});

describe('searchProducts (teclado)', () => {
    it('continua a ordenar começos de nome primeiro', () => {
        const r = searchProducts(catalog, 'cimento').map((x) => x.name);
        expect(r.slice(0, 2).sort()).toEqual(['Cimento 32.5N', 'Cimento Cola']);
    });
    it('pesquisa só com palavras de ligação não rebenta', () => {
        expect(() => searchProducts(catalog, 'de')).not.toThrow();
    });
});
