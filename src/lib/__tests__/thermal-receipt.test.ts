import { describe, it, expect } from 'vitest';
import { buildStayReceipt, buildKitchenTicket, receiptToHtml, escapeHtml } from '@/lib/thermal-receipt';

describe('impressão térmica', () => {
  const base = {
    hotel: 'Guest <House>',
    roomName: 'Quarto 3',
    clientName: 'João',
    vehiclePlate: 'ABC-123-MC',
    checkIn: new Date('2026-11-14T10:00:00'),
    checkOut: new Date('2026-11-14T13:00:00'),
    stayLabel: '3h de estadia',
    stayAmount: 900,
    consumptions: [
      { quantity: 2, productName: 'Heineken', totalPrice: 300 },
      { quantity: 1, productName: 'Peixe ao peso', totalPrice: 400, weightKg: 0.5, notes: 'sem sal' },
    ],
    total: 1600,
    paid: 1600,
    paymentMethod: 'Dinheiro',
    final: true,
  };

  it('recibo final tem total, pagamento, matrícula e kg', () => {
    const doc = buildStayReceipt(base);
    const html = receiptToHtml(doc);
    expect(doc.title).toBe('RECIBO DE ESTADIA');
    expect(html).toContain('Matrícula: ABC-123-MC');
    expect(html).toContain('0,5 kg Peixe ao peso');
    expect(html).toContain('Obs: sem sal');
    expect(doc.totals.find((t) => t.left === 'TOTAL')?.right).toContain('1');
    expect(doc.totals.some((t) => t.left === 'Em falta')).toBe(false);
    expect(doc.totals.some((t) => t.left === 'Pagamento')).toBe(true);
  });

  it('conta provisória mostra o que falta pagar', () => {
    const doc = buildStayReceipt({ ...base, final: false, paid: 600, checkOut: null });
    expect(doc.title).toContain('provisória');
    expect(doc.totals.find((t) => t.left === 'A pagar')?.right).toContain('1');
    expect(doc.meta.some((m) => m.startsWith('Saída'))).toBe(false);
  });

  it('escapa HTML do nome do hotel (sem injeção)', () => {
    const html = receiptToHtml(buildStayReceipt(base));
    expect(html).toContain('Guest &lt;House&gt;');
    expect(html).not.toContain('<House>');
    expect(escapeHtml('<script>"x"</script>')).not.toContain('<script>');
  });

  it('senha de cozinha não tem preços e leva as observações', () => {
    const doc = buildKitchenTicket({
      hotel: 'H', roomName: 'Quarto 3', createdAt: new Date(),
      items: [{ quantity: 2, productName: 'Bife', notes: 'bem passado' }], notes: 'alergia a amendoim',
    });
    const html = receiptToHtml(doc);
    expect(html).toContain('OBS: bem passado');
    expect(html).toContain('NOTA: alergia a amendoim');
    expect(html).not.toContain(' MT');
  });
});

describe('recibo no check-in', () => {
  it('sem saída real, é "recibo de pagamento" com a saída prevista', () => {
    const doc = buildStayReceipt({
      hotel: 'H', roomName: 'Q1', checkIn: new Date('2026-11-14T10:00:00'),
      expectedCheckOut: new Date('2026-11-14T13:00:00'), stayLabel: '3h de estadia', stayAmount: 900,
      consumptions: [], total: 900, paid: 900, paymentMethod: 'Dinheiro', final: true,
    });
    expect(doc.title).toBe('RECIBO DE PAGAMENTO');
    expect(doc.meta.some((m) => m.startsWith('Saída prevista'))).toBe(true);
    expect(doc.totals.some((t) => t.left === 'Em falta')).toBe(false);
  });
});
