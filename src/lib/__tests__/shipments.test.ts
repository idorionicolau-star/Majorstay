import { describe, expect, it } from 'vitest';
import { clampReceived, pendingFor, receiveResult, shipmentCode, type Shipment } from '../shipments';

const items = [{ name: 'Pavê', unit: 'm²', qty: 50 }, { name: 'Grelha', unit: 'un', qty: 10 }];

describe('envios com confirmação', () => {
    it('tudo recebido: estado recebido, sem faltas', () => {
        const r = receiveResult(items, {});
        expect(r.status).toBe('recebido');
        expect(r.items.map((i) => i.received)).toEqual([50, 10]);
        expect(r.missing).toEqual([]);
    });
    it('faltas ficam registadas', () => {
        const r = receiveResult(items, { 'Pavê': 48 });
        expect(r.status).toBe('com_diferenca');
        expect(r.missing).toEqual([{ name: 'Pavê', unit: 'm²', qty: 2 }]);
    });
    it('não se recebe mais do que saiu, nem negativo', () => {
        expect(clampReceived(10, 12)).toBe(10);
        expect(clampReceived(10, -1)).toBe(0);
        expect(clampReceived(10, NaN)).toBe(0);
    });
    it('pendentes só para os meus locais', () => {
        const s = (id: string, to: string, status: Shipment['status']) => ({ id, to, status } as Shipment);
        const list = [s('a', 'l1', 'em_transito'), s('b', 'l3', 'em_transito'), s('c', 'l1', 'recebido')];
        expect(pendingFor(list, new Set(['l1'])).map((x) => x.id)).toEqual(['a']);
        expect(pendingFor(list, null).map((x) => x.id)).toEqual(['a', 'b']);
    });
    it('código curto', () => {
        expect(shipmentCode(new Date('2026-10-21T10:00:00Z'), () => 0)).toBe('ENV-2610-AAAA');
    });
});
