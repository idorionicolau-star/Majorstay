import { describe, expect, it } from 'vitest';
import { linkErrorMessage, passwordAtRisk, shouldHintPassword, signInMethods } from '../sign-in-methods';

const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('formas de entrar', () => {
    it('lê o Google e a senha dos fornecedores da conta', () => {
        expect(signInMethods(['password'])).toEqual({ google: false, password: true });
        expect(signInMethods(['google.com', 'password'])).toEqual({ google: true, password: true });
        expect(signInMethods([])).toEqual({ google: false, password: false });
    });

    it('a senha só corre risco sem Google e com o email por confirmar', () => {
        expect(passwordAtRisk({ google: false, password: true }, false)).toBe(true);
        expect(passwordAtRisk({ google: false, password: true }, true)).toBe(false);
        expect(passwordAtRisk({ google: true, password: true }, false)).toBe(false);
    });

    it('depois de entrar com o Google sem senha, avisa uma só vez por conta', () => {
        const s = memory();
        const onlyGoogle = { google: true, password: false };
        expect(shouldHintPassword('u1', onlyGoogle, s)).toBe(true);
        expect(shouldHintPassword('u1', onlyGoogle, s)).toBe(false);
        expect(shouldHintPassword('u2', onlyGoogle, s)).toBe(true);
        expect(shouldHintPassword('u3', { google: true, password: true }, s)).toBe(false);
        expect(shouldHintPassword('u4', onlyGoogle, null)).toBe(false);
    });

    it('erros em português', () => {
        expect(linkErrorMessage('auth/credential-already-in-use')).toMatch(/outro utilizador/);
        expect(linkErrorMessage('xyz')).toMatch(/tente outra vez/);
    });
});
