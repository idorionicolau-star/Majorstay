import { describe, expect, it } from 'vitest';
import { habitualLocation, recordLocation } from '../habitual-location';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe('localização habitual', () => {
    it('sem histórico não há habitual', () => {
        expect(habitualLocation(['a', 'b'], mem())).toBeNull();
    });
    it('a primeira escolha já é a habitual', () => {
        const s = mem(); recordLocation('fabrica', 1, s);
        expect(habitualLocation(['loja', 'fabrica'], s)).toBe('fabrica');
    });
    it('manda a mais usada, não a última', () => {
        const s = mem();
        recordLocation('fabrica', 1, s); recordLocation('fabrica', 2, s); recordLocation('loja', 3, s);
        expect(habitualLocation(['loja', 'fabrica'], s)).toBe('fabrica');
    });
    it('empate: a mais recente; localização apagada é ignorada', () => {
        const s = mem();
        recordLocation('fabrica', 1, s); recordLocation('loja', 2, s);
        expect(habitualLocation(['loja', 'fabrica'], s)).toBe('loja');
        expect(habitualLocation(['fabrica'], s)).toBe('fabrica');
    });
});
