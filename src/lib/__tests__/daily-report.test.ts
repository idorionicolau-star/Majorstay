import { describe, it, expect } from 'vitest';
import { criticalProducts, escapeHtml, topProducts } from '@/lib/daily-report';
import { DEFAULT_REPORT_TIME, REPORT_TIMES, reportDay, reportTime, reportTimeLabel, saleOnDay } from '@/lib/daily-report';
import vercel from '../../../vercel.json';

describe('Relatório do dia: mais vendidos', () => {
    it('soma por produto e ordena por quantidade (empate: valor)', () => {
        const top = topProducts([
            { productName: 'Pavê', quantity: 10, totalValue: 100 },
            { productName: 'Bloco', quantity: 5, totalValue: 500 },
            { productName: 'Pavê', quantity: 5, totalValue: 50 },
            { productName: 'Grelha', quantity: 5, totalValue: 80 },
            { productName: 'Tampa', quantity: 1, totalValue: 10 },
            { productName: '', quantity: 99 },
        ]);
        expect(top.map((t) => [t.name, t.quantity, t.value])).toEqual([['Pavê', 15, 150], ['Bloco', 5, 500], ['Grelha', 5, 80]]);
        expect(topProducts([])).toEqual([]);
    });
});

describe('Relatório do dia: stock crítico', () => {
    it('junta o mesmo produto no mesmo local ("" = Principal), desconta reservas e ignora a lixeira', () => {
        const list = criticalProducts([
            { name: 'Pavê', location: '', stock: 3, criticalStockThreshold: 10 },
            { name: 'Pavê', location: 'Principal', stock: 4, reservedStock: 2 },
            { name: 'Bloco', stock: 50, reservedStock: 45, criticalStockThreshold: 5 },
            { name: 'Grelha', stock: 100, criticalStockThreshold: 10 },
            { name: 'Velho', stock: 0, criticalStockThreshold: 5, deletedAt: '2026-01-01' },
        ]);
        expect(list).toEqual([
            { name: 'Pavê', location: '', available: 5, threshold: 10, unit: undefined },
            { name: 'Bloco', location: '', available: 5, threshold: 5, unit: undefined },
        ]);
    });
    it('com vários locais, mostra o nome do local', () => {
        const locs = [{ id: 'a', name: 'Loja' }, { id: 'b', name: 'Armazém' }];
        const list = criticalProducts([{ name: 'Pavê', location: 'b', stock: 0 }, { name: 'Pavê', location: '', stock: 0 }], locs);
        expect(list.map((p) => p.location).sort()).toEqual(['Armazém', 'Loja']);
    });
});

it('escapa HTML', () => {
    expect(escapeHtml('<b>"A" & \'B\'</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;');
});

describe('reportDay / saleOnDay (o dia de Maputo, como o Financeiro)', () => {
    // cron às 16:30 UTC = 18:30 em Maputo
    const now = new Date('2026-10-14T16:30:00.000Z');

    it('vai da meia-noite de Maputo até ao fim do dia', () => {
        expect(reportDay(now)).toEqual({ day: '2026-10-14', startISO: '2026-10-13T22:00:00.000Z', endISO: '2026-10-14T21:59:59.999Z', label: '14/10/2026' });
    });

    it('não junta as vendas de ontem à noite', () => {
        const { day } = reportDay(now);
        expect(saleOnDay('2026-10-13T19:00:00.000Z', day)).toBe(false); // ontem 21:00 em Maputo
        expect(saleOnDay('2026-10-13T21:59:59.000Z', day)).toBe(false);
        expect(saleOnDay('2026-10-13T22:00:00.000Z', day)).toBe(true); // hoje 00:00
        expect(saleOnDay('2026-10-14T15:59:00.000Z', day)).toBe(true); // hoje 17:59
    });

    it('datas só com o dia contam como esse dia', () => {
        expect(saleOnDay('2026-10-14', '2026-10-14')).toBe(true);
        expect(saleOnDay('2026-10-13', '2026-10-14')).toBe(false);
        expect(saleOnDay(undefined, '2026-10-14')).toBe(false);
        expect(saleOnDay('lixo', '2026-10-14')).toBe(false);
    });

    it('logo depois da meia-noite já é o dia seguinte', () => {
        expect(reportDay(new Date('2026-10-14T22:30:00.000Z')).day).toBe('2026-10-15');
    });
});

describe('Hora do relatório', () => {
    it('sem escolha (ou valor estranho) é 21:30', () => {
        expect(DEFAULT_REPORT_TIME).toBe('21:30');
        expect(reportTime(undefined)).toBe('21:30');
        expect(reportTime('03:00')).toBe('21:30');
        expect(reportTime('18:30')).toBe('18:30');
        expect(reportTimeLabel('21:30')).toBe('21h30');
    });

    it('cada hora tem o seu cron em vercel.json, à hora certa de Maputo (UTC+2)', () => {
        const crons = vercel.crons.filter((c) => c.path.startsWith('/api/cron/end-of-day'));
        expect(crons.map((c) => c.path.split('slot=')[1]).sort()).toEqual([...REPORT_TIMES].sort());
        for (const c of crons) {
            const [h, m] = c.path.split('slot=')[1].split(':').map(Number);
            expect(c.schedule).toBe(`${m} ${h - 2} * * *`);
        }
    });
});
