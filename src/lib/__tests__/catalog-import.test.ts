import { describe, expect, it } from 'vitest';
import { parsePrice, parseText, planImport, rowsFromTable, buildImportPrompt } from '../catalog-import';

describe('parsePrice', () => {
    it('lê formatos comuns', () => {
        expect(parsePrice('7.200 Mts')).toBe(7200);
        expect(parsePrice('1.234,50')).toBe(1234.5);
        expect(parsePrice('297,50')).toBe(297.5);
        expect(parsePrice('12.5')).toBe(12.5);
        expect(parsePrice('1 250 MT')).toBe(1250);
        expect(parsePrice('1,250.75')).toBe(1250.75);
        expect(parsePrice(350)).toBe(350);
        expect(parsePrice('abc')).toBeNull();
        expect(parsePrice('')).toBeNull();
    });
});

describe('rowsFromTable', () => {
    it('reconhece colunas por sinónimos e ignora a revenda', () => {
        const rows = rowsFromTable([
            ['Código', 'Descrição', 'Família', 'Preço Revenda', 'PVP', 'Un'],
            ['BJ01', 'Banco Praça', 'Banco de concreto', '5.976', '7.200', 'un'],
            ['BJ02', 'Banco Simples', 'Banco de concreto', '3.735', '4.500', 'un'],
        ]);
        expect(rows).toEqual([
            { name: 'Banco Praça', category: 'Banco de concreto', price: 7200, unit: 'un', code: 'BJ01' },
            { name: 'Banco Simples', category: 'Banco de concreto', price: 4500, unit: 'un', code: 'BJ02' },
        ]);
    });
    it('sem cabeçalho: texto é o nome, números são o preço', () => {
        const rows = rowsFromTable([['Cimento 32.5', '650'], ['Areia fina', '1200'], ['Brita', '']]);
        expect(rows.map((r) => [r.name, r.price])).toEqual([['Cimento 32.5', 650], ['Areia fina', 1200], ['Brita', undefined]]);
    });
    it('só nomes (uma coluna)', () => {
        const rows = rowsFromTable([['Tijolo'], ['Cal'], ['Pó de pedra']]);
        expect(rows.map((r) => r.name)).toEqual(['Tijolo', 'Cal', 'Pó de pedra']);
    });
    it('cabeçalho em inglês', () => {
        const rows = rowsFromTable([['Product', 'Price'], ['Block 15', '45']]);
        expect(rows).toEqual([{ name: 'Block 15', price: 45 }]);
    });
});

describe('parseText', () => {
    it('resposta da IA (tabela com |)', () => {
        const rows = parseText(`Nome | Categoria | Preço | Unidade | Código
Banco Praça | Banco de concreto | 7200 | un | BJ01
Passadeira 8 Pistões | Passadeira (Lajeta) | 650 | m² | PS01
Borda Lisa 50 | Borda de piscina | 350,50 | un |`);
        expect(rows).toHaveLength(3);
        expect(rows[1]).toEqual({ name: 'Passadeira 8 Pistões', category: 'Passadeira (Lajeta)', price: 650, unit: 'm²', code: 'PS01' });
        expect(rows[2].price).toBe(350.5);
        expect(rows[2].code).toBeUndefined();
    });
    it('tabela markdown', () => {
        const rows = parseText(`| Produto | Preço |
|---|---|
| Cimento | 650 |
| Areia | 1.200 |`);
        expect(rows.map((r) => [r.name, r.price])).toEqual([['Cimento', 650], ['Areia', 1200]]);
    });
    it('cópia do Excel (tabulações)', () => {
        const rows = parseText('Artigo\tPreço de venda\nBloco 15\t45\nBloco 20\t55,5');
        expect(rows.map((r) => [r.name, r.price])).toEqual([['Bloco 15', 45], ['Bloco 20', 55.5]]);
    });
    it('lista do WhatsApp com categorias e preços', () => {
        const rows = parseText(`Categoria: Mesas
- Mesa Rectangular - 10.000 Mts
- Mesa Redonda: 10000
2. Mesa Decor ........ 6.500

BANCOS
Banco Praça 7.200 Mts
Banco Curvo 3.500 Mts`);
        expect(rows).toEqual([
            { name: 'Mesa Rectangular', category: 'Mesas', price: 10000 },
            { name: 'Mesa Redonda', category: 'Mesas', price: 10000 },
            { name: 'Mesa Decor', category: 'Mesas', price: 6500 },
            { name: 'Banco Praça', category: 'Bancos', price: 7200 },
            { name: 'Banco Curvo', category: 'Bancos', price: 3500 },
        ]);
    });
    it('só nomes: medidas no fim do nome não viram preço', () => {
        const rows = parseText('Bloco 15\nBloco 20\nCimento 32.5\nTijolo furado');
        expect(rows.map((r) => [r.name, r.price])).toEqual([['Bloco 15', undefined], ['Bloco 20', undefined], ['Cimento 32.5', undefined], ['Tijolo furado', undefined]]);
    });
    it('nomes em maiúsculas sem preço não viram categorias', () => {
        const rows = parseText('CIMENTO\nAREIA\nBRITA');
        expect(rows).toHaveLength(3);
        expect(rows.every((r) => !r.category)).toBe(true);
    });
    it('ignora linhas de revenda, desconto e códigos soltos', () => {
        const rows = parseText(`Cat: Banco de concreto   Des. 17%
N° Productos: 3
BJ01
Banco Praça
Revenda: 5.976mts
Banco Praça 7.200 Mts`);
        expect(rows.map((r) => [r.name, r.category, r.price])).toEqual([['Banco Praça', 'Banco de concreto', undefined], ['Banco Praça', 'Banco de concreto', 7200]]);
    });
});

describe('planImport', () => {
    const catalog = [{ id: 'a', name: 'Cimento 32.5N', price: 600 }, { id: 'b', name: 'Bloco 15', price: 40 }];
    it('separa novos, existentes, parecidos e repetidos', () => {
        const plan = planImport([
            { name: 'cimento 32.5n', price: 650 },
            { name: 'Bloco 20', price: 50 },
            { name: 'Areia' },
            { name: 'Areia', price: 100 },
        ], catalog);
        expect(plan.map((p) => p.status)).toEqual(['exists', 'new', 'new', 'duplicate']);
        expect(plan[0].match?.id).toBe('a');
        expect(plan[0].include).toBe(false);
        expect(plan[2].row.price).toBe(100); // o preço do repetido completa o primeiro
    });
});

describe('buildImportPrompt', () => {
    it('pede o formato que o leitor entende', () => {
        expect(buildImportPrompt()).toContain('Nome | Categoria | Preço | Unidade | Código');
    });
});
