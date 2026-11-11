import { formatCurrency } from '@/lib/utils';
import type { Booking, Stay, Room } from '@/lib/types';
import { normalizeDate, formatStayDuration } from '@/lib/hospitality-calc';

/**
 * Normaliza um número de telemóvel para o formato internacional de Moçambique (+258).
 * Suporta formatos: "841234567", "+258 84 123 4567", "258841234567", etc.
 */
export function normalizeMozPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';

  // Se já tem indicativo 258 e 12 dígitos
  if (digits.startsWith('258') && digits.length >= 12) {
    return digits;
  }

  // Se é número moçambicano padrão (9 dígitos: 82, 83, 84, 85, 86, 87)
  if (digits.length === 9) {
    return `258${digits}`;
  }

  return digits;
}

/**
 * Cria a URL universal do WhatsApp (abre no WhatsApp Web ou App nativo no telemóvel)
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = normalizeMozPhone(phone);
  const encodedText = encodeURIComponent(message);
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
}

/**
 * Abre a janela de conversa do WhatsApp diretamente no navegador/app
 */
export function openWhatsApp(phone: string, message: string): void {
  const url = buildWhatsAppUrl(phone, message);
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Mensagem elegante para Confirmação de Reserva Antecipada
 */
export function buildBookingWhatsAppMessage(booking: Booking, hotelName?: string): string {
  const brand = hotelName?.trim() || 'Alojamento Turístico';
  const checkInDateObj = normalizeDate(booking.checkInDate);
  const formattedDate = checkInDateObj.toLocaleDateString('pt-MZ', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = checkInDateObj.toLocaleTimeString('pt-MZ', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const durationText = booking.isOvernight
    ? 'Pernoita'
    : `${booking.durationHours} ${booking.durationHours === 1 ? 'hora' : 'horas'}`;

  const roomText = booking.roomName || 'Alojamento Reservado';

  let msg = `🛎️ *CONFIRMAÇÃO DE RESERVA — ${brand}*\n\n`;
  msg += `Olá, *${booking.clientName || 'Estimado(a) Hóspede'}*! A sua reserva antecipada foi registada com sucesso:\n\n`;
  msg += `🛏️ *Alojamento:* ${roomText}\n`;
  msg += `📅 *Data de Entrada:* ${formattedDate} às ${formattedTime}\n`;
  msg += `⏱️ *Permanência Prevista:* ${durationText}\n`;

  if (booking.depositAmount && booking.depositAmount > 0) {
    msg += `💰 *Sinal / Depósito Pago:* ${formatCurrency(booking.depositAmount)}\n`;
  }

  if (booking.totalEstimated && booking.totalEstimated > 0) {
    msg += `💵 *Tarifa Estimada:* ${formatCurrency(booking.totalEstimated)}\n`;
  }

  if (booking.notes?.trim()) {
    msg += `📝 *Observações:* ${booking.notes.trim()}\n`;
  }

  msg += `\n📍 *Receção:* Por favor, informe-nos com antecedência se houver algum atraso ou alteração no seu horário de chegada.\n\n`;
  msg += `Aguardamos por si com o máximo conforto e discrição! ✨\n`;
  msg += `_A Equipa do ${brand}_`;

  return msg;
}

/**
 * Mensagem detalhada para Recibo de Check-out e Comanda do Quarto
 */
export function buildStayReceiptWhatsAppMessage(
  stay: Stay,
  room?: Room | null,
  hotelName?: string
): string {
  const brand = hotelName?.trim() || 'Alojamento Turístico';
  const roomName = stay.roomName || room?.name || 'Quarto';
  const client = stay.clientName || 'Hóspede Particular';

  const checkIn = normalizeDate(stay.checkInAt);
  const checkOut = stay.checkOutAt ? normalizeDate(stay.checkOutAt) : new Date();

  const formattedIn = checkIn.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
  const formattedOut = checkOut.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
  const dateStr = checkIn.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const hoursStay = stay.billedHours || stay.contractedHours || 1;
  const staySubtotal = (stay.ratePerHourApplied || room?.ratePerHour || 300) * hoursStay;

  let msg = `🏨 *RECIBO DE ESTADIA — ${brand}*\n\n`;
  msg += `Prezado(a) *${client}*, agradecemos a sua visita e preferência!\n\n`;
  msg += `📋 *RESUMO DA ESTADIA:*\n`;
  msg += `🛏️ *Quarto:* ${roomName}\n`;
  msg += `📅 *Data:* ${dateStr}\n`;
  msg += `🕒 *Entrada:* ${formattedIn}  |  🏁 *Saída:* ${formattedOut}\n`;
  msg += `⏱️ *Horas Cobradas:* ${hoursStay}h  (${formatCurrency(staySubtotal)})\n`;

  // Consumos de bar
  if (stay.consumptions && stay.consumptions.length > 0) {
    const barTotal = stay.consumptions.reduce((sum, c) => sum + (Number(c.totalPrice) || 0), 0);
    msg += `\n🍷 *BAR & CONSUMOS (${stay.consumptions.length}):*\n`;
    stay.consumptions.forEach((item) => {
      msg += ` • ${item.quantity}× ${item.productName} — ${formatCurrency(item.totalPrice)}\n`;
    });
    msg += `*Subtotal Bar:* ${formatCurrency(barTotal)}\n`;
  }

  const totalPaid = stay.totalAmountPaid || stay.totalAmountDue || staySubtotal;
  const method = stay.paymentMethod ? ` (${stay.paymentMethod})` : '';

  msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💳 *TOTAL PAGO:* *${formatCurrency(totalPaid)}*${method}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `Esperamos vê-lo(a) novamente em breve! Tenha um excelente dia. ✨\n`;
  msg += `_A Equipa do ${brand}_`;

  return msg;
}
