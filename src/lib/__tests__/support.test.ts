import { describe, it, expect } from 'vitest';
import { emailLink, supportMessage, whatsappLink, SUPPORT } from '@/lib/support';

describe('suporte', () => {
    it('WhatsApp em formato internacional (+258), com a mensagem preenchida', () => {
        expect(SUPPORT.whatsapp).toBe('258842333717');
        expect(whatsappLink()).toBe('https://wa.me/258842333717');
        expect(whatsappLink('Olá & até já')).toBe('https://wa.me/258842333717?text=Ol%C3%A1%20%26%20at%C3%A9%20j%C3%A1');
    });
    it('email com assunto e corpo', () => {
        expect(emailLink('Ajuda', 'linha 1\nlinha 2')).toBe('mailto:idorionicolau@gmail.com?subject=Ajuda&body=linha%201%0Alinha%202');
    });
    it('a mensagem leva empresa, utilizador, página, problema e pede as capturas', () => {
        const m = supportMessage({ company: 'Estaleiro X', user: 'Ana', page: '/inventory/quick', problem: 'Não grava a entrada' });
        expect(m).toContain('Empresa: Estaleiro X');
        expect(m).toContain('Utilizador: Ana');
        expect(m).toContain('Página: /inventory/quick');
        expect(m).toContain('O problema: Não grava a entrada');
        expect(m).toContain('capturas de ecrã');
        expect(supportMessage({})).not.toContain('Empresa:');
    });
});
