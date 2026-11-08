import { describe, expect, it } from 'vitest';
import { cleanSubject, escapeAll, escapeHtml, notAllowed, parseRecipients, safeImageUrl } from '../email-guard';

describe('envio de emails: proteções', () => {
    it('texto vindo do navegador nunca vira HTML', () => {
        expect(escapeHtml('<a href="x">Clique</a>')).toBe('&lt;a href=&quot;x&quot;&gt;Clique&lt;/a&gt;');
        expect(escapeAll({ n: '<b>', items: [{ p: 'A & B' }], q: 3 })).toEqual({ n: '&lt;b&gt;', items: [{ p: 'A &amp; B' }], q: 3 });
    });
    it('logótipo só por https', () => {
        expect(safeImageUrl('https://x.public.blob.vercel-storage.com/a.png')).toBe('https://x.public.blob.vercel-storage.com/a.png');
        expect(safeImageUrl('javascript:alert(1)')).toBe('');
        expect(safeImageUrl('https://a.com/x" onerror="y')).toBe('');
    });
    it('assunto numa linha e curto', () => {
        expect(cleanSubject('Olá\r\nBcc: x', 'F')).toBe('Olá Bcc: x');
        expect(cleanSubject('', 'Recibo')).toBe('Recibo');
        expect(cleanSubject('a'.repeat(300), 'F')).toHaveLength(120);
    });
    it('destinatários: só endereços válidos, sem repetir, e só os autorizados', () => {
        const r = parseRecipients(['Dono@Loja.co.mz, outro@x.com', 'dono@loja.co.mz', 'lixo']);
        expect(r).toEqual(['dono@loja.co.mz', 'outro@x.com']);
        expect(notAllowed(r, ['DONO@loja.co.mz'])).toEqual(['outro@x.com']);
        expect(notAllowed(['dono@loja.co.mz'], ['dono@loja.co.mz'])).toEqual([]);
    });
});
