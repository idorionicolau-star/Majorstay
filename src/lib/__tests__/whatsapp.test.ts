import { describe, it, expect } from 'vitest';
import { normalizeMozPhone, buildWhatsAppUrl, buildBookingWhatsAppMessage, buildStayReceiptWhatsAppMessage } from '../whatsapp';
import type { Booking, Stay } from '../types';
import { formatCurrency } from '../utils';

describe('WhatsApp Hospitality Utils', () => {
  it('normaliza números de telefone de Moçambique com 9 dígitos', () => {
    expect(normalizeMozPhone('841234567')).toBe('258841234567');
    expect(normalizeMozPhone('829988776')).toBe('258829988776');
    expect(normalizeMozPhone('+258 84 123 4567')).toBe('258841234567');
    expect(normalizeMozPhone('258841234567')).toBe('258841234567');
  });

  it('gera URL universal do WhatsApp corretamente', () => {
    const url = buildWhatsAppUrl('841234567', 'Olá Hotel');
    expect(url).toContain('https://wa.me/258841234567?text=Ol%C3%A1%20Hotel');
  });

  it('gera mensagem de confirmação de reserva antecipada com todos os dados', () => {
    const booking: Booking = {
      id: 'book-1',
      clientName: 'Fernando Macamo',
      clientPhone: '849999999',
      roomName: 'Suíte Presidencial 201',
      checkInDate: new Date('2026-11-10T14:00:00Z'),
      durationHours: 3,
      depositAmount: 500,
      totalEstimated: 1500,
      status: 'confirmed',
      notes: 'Hóspede pediu champanhe gelado',
      createdBy: 'user-1',
      createdAt: new Date(),
    };

    const msg = buildBookingWhatsAppMessage(booking, 'Lodge Oasis');
    expect(msg).toContain('CONFIRMAÇÃO DE RESERVA — Lodge Oasis');
    expect(msg).toContain('Fernando Macamo');
    expect(msg).toContain('Suíte Presidencial 201');
    expect(msg).toContain('3 horas');
    expect(msg).toContain(formatCurrency(500));
    expect(msg).toContain('Hóspede pediu champanhe gelado');
  });

  it('gera recibo de check-out com discriminação de estadia e consumos', () => {
    const stay: Stay = {
      id: 'stay-1',
      roomId: 'room-1',
      roomName: 'Quarto 102',
      clientName: 'Dra. Amina',
      checkInAt: new Date('2026-11-09T18:00:00Z'),
      checkOutAt: new Date('2026-11-09T20:00:00Z'),
      contractedHours: 2,
      billedHours: 2,
      ratePerHourApplied: 400,
      totalAmountDue: 1040,
      totalAmountPaid: 1040,
      paymentMethod: 'M-Pesa',
      openedBy: 'user-1',
      status: 'closed',
      createdAt: new Date(),
      consumptions: [
        {
          id: 'c-1',
          productName: 'Cerveja 2M',
          quantity: 2,
          unitPrice: 80,
          totalPrice: 160,
          addedAt: new Date(),
          addedBy: 'user-1',
        },
        {
          id: 'c-2',
          productName: 'Batata Frita',
          quantity: 1,
          unitPrice: 80,
          totalPrice: 80,
          addedAt: new Date(),
          addedBy: 'user-1',
        },
      ],
    };

    const msg = buildStayReceiptWhatsAppMessage(stay, null, 'Hotel Flamingo');
    expect(msg).toContain('RECIBO DE ESTADIA — Hotel Flamingo');
    expect(msg).toContain('Quarto 102');
    expect(msg).toContain('Dra. Amina');
    expect(msg).toContain('2× Cerveja 2M');
    expect(msg).toContain('1× Batata Frita');
    expect(msg).toContain(formatCurrency(1040));
    expect(msg).toContain('(M-Pesa)');
  });
});
