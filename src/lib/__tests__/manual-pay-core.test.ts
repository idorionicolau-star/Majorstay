import { describe, it, expect } from 'vitest';
import { isManualMethod, manualPaymentEmail, manualProofMessage, MANUAL_METHODS, paymentReference } from '@/lib/manual-pay-core';

describe('Pagamento directo', () => {
    it('números de M-Pesa e e-Mola', () => {
        expect(MANUAL_METHODS.mpesa.number).toBe('843641708');
        expect(MANUAL_METHODS.emola.number).toBe('872979951');
        expect(isManualMethod('mpesa')).toBe(true);
        expect(isManualMethod('card')).toBe(false);
        expect(isManualMethod('toString')).toBe(false);
    });
    it('referência curta com a empresa', () => {
        expect(paymentReference('c1-ab', new Date(0))).toBe('MSX0C1AB');
        expect(paymentReference('xyz', new Date(1_700_000_000_000))).toMatch(/^MSX[0-9A-Z]+XYZ$/);
    });
    it('mensagem do comprovativo', () => {
        const m = manualProofMessage({ company: 'Tapete Vermelho', email: 'a@b.com', plan: 'Mensal', amount: '1.000,00 MT', method: 'emola', reference: 'MSX1' });
        expect(m).toContain('Empresa: Tapete Vermelho');
        expect(m).toContain('Pago por: e-Mola');
        expect(m).toContain('Referência: MSX1');
        expect(manualProofMessage({ plan: 'Anual', amount: '1 MT', method: 'mpesa', reference: 'R' })).not.toContain('Empresa');
    });
});

describe('Email do pedido', () => {
    it('tem os dados, o botão para o painel e escapa o nome', () => {
        const e = manualPaymentEmail({ company: 'Loja <b>X</b>', email: 'a@b.com', createdBy: 'Ana', plan: 'Mensal', amount: '1.000,00 MT', method: 'mpesa', reference: 'MSX9', adminUrl: 'https://stock.majorgroup.app/admin/subscriptions' });
        expect(e.subject).toContain('M-Pesa');
        expect(e.subject).toContain('MSX9');
        expect(e.html).toContain('Loja &lt;b&gt;X&lt;/b&gt;');
        expect(e.html).toContain('84 364 1708');
        expect(e.html).toContain('href="https://stock.majorgroup.app/admin/subscriptions"');
    });
});
