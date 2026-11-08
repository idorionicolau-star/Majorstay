import { describe, expect, it } from 'vitest';
import { locationIn, pickActive, sameLocation } from '../product-ref';

describe('local do produto: "Principal" e "sem local" são o mesmo sítio', () => {
    it('locationIn procura as duas formas numa empresa de um só local', () => {
        expect(locationIn('Principal').sort()).toEqual(['', 'Principal']);
        expect(locationIn('').sort()).toEqual(['', 'Principal']);
        expect(locationIn(undefined).sort()).toEqual(['', 'Principal']);
    });
    it('com vários locais procura só o pedido', () => {
        expect(locationIn('armazem-2')).toEqual(['armazem-2']);
    });
    it('sameLocation', () => {
        expect(sameLocation('', 'Principal')).toBe(true);
        expect(sameLocation(undefined, '')).toBe(true);
        expect(sameLocation('Principal', 'Principal')).toBe(true);
        expect(sameLocation('a', 'b')).toBe(false);
        expect(sameLocation('a', '')).toBe(false);
    });
});

describe('pickActive', () => {
    const d = (deletedAt?: string) => ({ data: () => ({ deletedAt }) });
    it('ignora os da lixeira', () => {
        const active = d();
        expect(pickActive([d('2026-10-02'), active])).toBe(active);
        expect(pickActive([d('2026-10-02')])).toBeUndefined();
        expect(pickActive([])).toBeUndefined();
    });
});
