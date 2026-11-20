import { describe, it, expect } from 'vitest';
import { activationEmailHtml } from '@/lib/activation-email';

const base = { company: 'Blue <Ocean>', appUrl: 'https://stay.majorgroup.app', brand: 'MajorStay', whatsappUrl: 'https://wa.me/258' };

describe('activationEmailHtml', () => {
    it('confirma a subscrição, com a data de fim, plano e nome', () => {
        const m = activationEmailHtml({ ...base, name: 'Ana', until: '2026-12-20T21:59:59.000Z', planLabel: 'Mensal' });
        expect(m.subject).toBe('Subscrição ativada — MajorStay');
        expect(m.html).toContain('Olá, Ana!');
        expect(m.html).toContain('plano Mensal');
        expect(m.html).toContain('2026');
        expect(m.html).toContain('https://stay.majorgroup.app');
    });
    it('escapa o nome da empresa e funciona sem data nem plano', () => {
        const m = activationEmailHtml({ ...base });
        expect(m.html).toContain('Blue &lt;Ocean&gt;');
        expect(m.html).not.toContain('Válida até');
        expect(m.html).toContain('Olá!');
    });
});
