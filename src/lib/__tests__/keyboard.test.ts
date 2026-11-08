import { describe, expect, it } from 'vitest';
import { createKeyboardIntent } from '../keyboard';

describe('o teclado só abre quando a pessoa toca num campo', () => {
    it('no telemóvel começa fechado: nenhum foco automático', () => {
        const k = createKeyboardIntent({ isTouch: () => true });
        expect(k.allowsAutoFocus()).toBe(false);
    });

    it('no computador o foco automático continua', () => {
        const k = createKeyboardIntent({ isTouch: () => false });
        expect(k.allowsAutoFocus()).toBe(true);
    });

    it('tocar num campo dá licença; "Fechar teclado" tira-a; tocar outra vez devolve-a', () => {
        const k = createKeyboardIntent({ isTouch: () => true });
        k.wanted();
        expect(k.allowsAutoFocus()).toBe(true);
        k.hidden();
        expect(k.allowsAutoFocus()).toBe(false);
        k.wanted();
        expect(k.allowsAutoFocus()).toBe(true);
    });

    it('no computador, fechar o teclado (ex.: Esc) não impede o foco automático de ser decidido por quem o pediu', () => {
        const k = createKeyboardIntent({ isTouch: () => false });
        k.hidden();
        expect(k.allowsAutoFocus()).toBe(false); // se a pessoa pediu para fechar, respeita-se
        k.wanted();
        expect(k.allowsAutoFocus()).toBe(true);
    });

    it('o aparelho só é perguntado uma vez (não muda a meio)', () => {
        let touch = true;
        const k = createKeyboardIntent({ isTouch: () => touch });
        expect(k.allowsAutoFocus()).toBe(false);
        touch = false;
        expect(k.allowsAutoFocus()).toBe(false);
    });
});
