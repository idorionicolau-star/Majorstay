import { describe, it, expect } from 'vitest';
import { r2Config, r2ObjectUrl, isR2PublicUrl } from '../r2-storage';

const env = { R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET: 'fotos', R2_PUBLIC_URL: 'https://pub-123.r2.dev/' };

describe('r2-storage', () => {
    it('só fica ativo com todas as variáveis e um endereço https', () => {
        expect(r2Config(env)?.publicUrl).toBe('https://pub-123.r2.dev');
        expect(r2Config({ ...env, R2_BUCKET: '' })).toBeNull();
        expect(r2Config({ ...env, R2_PUBLIC_URL: 'http://pub-123.r2.dev' })).toBeNull();
        expect(r2Config({})).toBeNull();
    });
    it('monta o endereço público do ficheiro', () => {
        expect(r2ObjectUrl('https://pub-123.r2.dev/', 'products/emp1/foto 1-ab.webp')).toBe('https://pub-123.r2.dev/products/emp1/foto%201-ab.webp');
    });
    it('o proxy só aceita o endereço do nosso bucket', () => {
        expect(isR2PublicUrl(new URL('https://pub-123.r2.dev/products/x.webp'), env)).toBe(true);
        expect(isR2PublicUrl(new URL('https://outro.r2.dev/x.webp'), env)).toBe(false);
        expect(isR2PublicUrl(new URL('http://pub-123.r2.dev/x.webp'), env)).toBe(false);
        expect(isR2PublicUrl(new URL('https://pub-123.r2.dev/x.webp'), {})).toBe(false);
    });
});
