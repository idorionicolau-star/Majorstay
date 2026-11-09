'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BedDouble,
  Clock,
  User,
  Phone,
  CreditCard,
  Banknote,
  Smartphone,
  Key,
  Printer,
  Check,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  FileText,
  Calendar,
  Tv,
  Wind,
  Coffee,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Room } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { useInventory } from '@/context/inventory-context';
import { toast } from '@/hooks/use-toast';
import { openWhatsApp } from '@/lib/whatsapp';

const DURATION_PRESETS = [
  { key: '1h', label: '1 Hora', hours: 1 },
  { key: '2h', label: '2 Horas', hours: 2 },
  { key: '3h', label: '3 Horas', hours: 3 },
  { key: '4h', label: '4 Horas', hours: 4 },
  { key: '6h', label: '6 Horas', hours: 6 },
  { key: '12h', label: '12 Horas (Noite)', hours: 12 },
  { key: '24h', label: '24 Horas / Pernoita', hours: 24 },
];

const PAYMENT_METHODS = [
  { id: 'M-Pesa / E-Mola', label: 'M-Pesa / E-Mola', icon: Smartphone },
  { id: 'Dinheiro', label: 'Dinheiro (Caixa)', icon: Banknote },
  { id: 'POS / Cartão', label: 'POS / Cartão', icon: CreditCard },
  { id: 'Pagar na Saída', label: 'Pagar na Saída', icon: Clock },
];

// Comodidades automáticas baseadas no tipo de quarto
function getRoomAmenities(room: Room): string[] {
  if (room.notes && room.notes.trim()) {
    const parts = room.notes.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts.slice(0, 3);
  }
  const type = (room.type || 'standard').toLowerCase();
  if (type.includes('luxo') || type.includes('presidencial')) {
    return ['King Size', 'A/C', 'Frigobar'];
  }
  if (type.includes('suite') || type.includes('executiv')) {
    return ['Cama Casal', 'A/C', 'TV Smart'];
  }
  if (type.includes('casal')) {
    return ['Cama Casal', 'Ventilador', 'TV'];
  }
  return ['Cama Casal', 'A/C'];
}

function getRoomTypeLabel(type?: string): string {
  if (!type) return 'Standard Clássico';
  const t = type.toLowerCase();
  if (t === 'suite') return 'Suite Simples';
  if (t === 'luxo') return 'Casal Luxo';
  if (t === 'executivo') return 'Executivo Superior';
  if (t === 'casal') return 'Quarto Casal';
  if (t === 'solteiro') return 'Quarto Solteiro';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function CheckInView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preselectedRoomId = searchParams.get('roomId') || '';
  const bookingId = searchParams.get('bookingId') || '';
  const initialGuestName = searchParams.get('name') || '';
  const initialGuestPhone = searchParams.get('phone') || '';
  const initialHours = Number(searchParams.get('hours')) || 2;

  const { rooms, checkInStay, updateBookingStatus, loading: roomsLoading } = useRooms();
  const { user } = useInventory();

  // Filtrar quartos disponíveis
  const freeRooms = useMemo(() => {
    return rooms.filter((r) => r.active && (r.status === 'free' || r.id === preselectedRoomId));
  }, [rooms, preselectedRoomId]);

  // Estados do formulário
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [stayMode, setStayMode] = useState<'horas' | 'diaria'>('horas');
  const [contractedHours, setContractedHours] = useState<number>(initialHours);
  const [guestName, setGuestName] = useState<string>(initialGuestName || 'Carlos Macamo');
  const [guestPhone, setGuestPhone] = useState<string>(initialGuestPhone || '+258 84 123 4567');
  const [occupantsCount, setOccupantsCount] = useState<number>(2);
  const [guestDoc, setGuestDoc] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('M-Pesa / E-Mola');
  const [specialNotes, setSpecialNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [nowTime, setNowTime] = useState<string>('');

  // Atualizar relógio em tempo real
  useEffect(() => {
    const updateNow = () => {
      const now = new Date();
      setNowTime(
        now.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateNow();
    const timer = setInterval(updateNow, 30000);
    return () => clearInterval(timer);
  }, []);

  // Selecionar o quarto inicial
  useEffect(() => {
    if (preselectedRoomId && rooms.some((r) => r.id === preselectedRoomId)) {
      setSelectedRoomId(preselectedRoomId);
      const room = rooms.find((r) => r.id === preselectedRoomId);
      if (room?.minimumHours && room.minimumHours > contractedHours) {
        setContractedHours(room.minimumHours);
      }
    } else if (freeRooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(freeRooms[0].id);
      if (freeRooms[0].minimumHours && freeRooms[0].minimumHours > contractedHours) {
        setContractedHours(freeRooms[0].minimumHours);
      }
    }
  }, [preselectedRoomId, freeRooms, rooms, selectedRoomId, contractedHours]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const ratePerHour = selectedRoom?.ratePerHour || 0;

  // Cálculo da duração efetiva
  const effectiveHours = stayMode === 'diaria' ? 24 : Math.max(1, contractedHours);
  const totalAmount = effectiveHours * ratePerHour;

  // Cálculo da hora prevista de saída
  const expectedCheckOutDate = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + effectiveHours);
    return d;
  }, [effectiveHours]);

  const expectedOutFormatted = useMemo(() => {
    const now = new Date();
    const isSameDay =
      expectedCheckOutDate.getDate() === now.getDate() &&
      expectedCheckOutDate.getMonth() === now.getMonth();

    const timeStr = expectedCheckOutDate.toLocaleTimeString('pt-MZ', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isSameDay) {
      return `Hoje às ${timeStr}`;
    }
    const dayName = expectedCheckOutDate.toLocaleDateString('pt-MZ', { weekday: 'short' });
    return `Amanhã (${dayName}) às ${timeStr}`;
  }, [expectedCheckOutDate]);

  const handleSelectRoom = (room: Room) => {
    setSelectedRoomId(room.id);
    if (room.minimumHours && contractedHours < room.minimumHours) {
      setContractedHours(room.minimumHours);
    }
  };

  const handleFillBalcao = () => {
    setGuestName('Hóspede Particular / Balcão');
  };

  const handleSubmitCheckIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedRoomId) {
      toast({
        variant: 'destructive',
        title: 'Selecione um quarto',
        description: 'É obrigatório escolher um quarto disponível.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const stayId = await checkInStay({
        roomId: selectedRoomId,
        roomName: selectedRoom?.name,
        clientName: guestName.trim() || 'Hóspede Particular',
        clientPhone: guestPhone.trim(),
        clientDoc: guestDoc.trim(),
        contractedHours: effectiveHours,
        ratePerHour,
        paymentMethod,
        notes: [
          occupantsCount > 1 ? `${occupantsCount} Ocupantes` : '1 Ocupante',
          specialNotes.trim(),
        ]
          .filter(Boolean)
          .join(' • '),
      });

      // Se veio de uma reserva antecipada, marcar como concluída
      if (bookingId && updateBookingStatus) {
        await updateBookingStatus(bookingId, 'checked_in');
      }

      toast({
        title: 'Check-in efetuado com sucesso!',
        description: `${selectedRoom?.name} ativado e chave entregue ao hóspede.`,
      });

      // Redirecionar para o quadro de quartos
      router.push('/rooms');
    } catch (err: any) {
      console.error('Erro ao efetuar check-in:', err);
      toast({
        variant: 'destructive',
        title: 'Erro no check-in',
        description: err.message || 'Ocorreu uma falha ao registar a entrada.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintSlip = () => {
    if (typeof window === 'undefined') return;
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      toast({
        variant: 'destructive',
        title: 'Pop-up bloqueado',
        description: 'Permita pop-ups no seu navegador para imprimir a ficha térmica.',
      });
      return;
    }

    const hotelName = 'MAJOR STAY';
    const hotelTagline = 'HOSPITALITY SUITE';
    const roomName = selectedRoom?.name || 'Quarto';
    const roomType = getRoomTypeLabel(selectedRoom?.type);
    const guest = guestName.trim() || 'Hóspede Particular';
    const todayStr = new Date().toLocaleDateString('pt-MZ');
    const timeStr = new Date().toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Ficha Balcão - ${roomName}</title>
          <style>
            @page { size: 80mm auto; margin: 3mm; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              color: #111;
              margin: 0;
              padding: 8px;
              line-height: 1.35;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #444; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .total-row { font-size: 15px; font-weight: bold; margin: 6px 0; }
            .badge { display: inline-block; padding: 2px 6px; border: 1px solid #222; border-radius: 4px; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 16px; letter-spacing: 1px;">${hotelName}</div>
          <div class="center" style="font-size: 9px; letter-spacing: 2px;">${hotelTagline}</div>
          <div class="center" style="margin-top: 4px;"><span class="badge">ENTRADA BALCÃO</span></div>
          <div class="line"></div>
          <div class="row"><span>Data / Hora:</span><span>${todayStr} ${timeStr}</span></div>
          <div class="row"><span>Atendente:</span><span>${user?.username || 'Recepção'}</span></div>
          <div class="row"><span>Acomodação:</span><span class="bold">${roomName}</span></div>
          <div class="row"><span>Categoria:</span><span>${roomType}</span></div>
          <div class="row"><span>Hóspede:</span><span class="bold">${guest}</span></div>
          ${guestPhone ? `<div class="row"><span>Telefone:</span><span>${guestPhone}</span></div>` : ''}
          ${guestDoc ? `<div class="row"><span>Documento:</span><span>${guestDoc}</span></div>` : ''}
          <div class="row"><span>Ocupantes:</span><span>${occupantsCount} ${occupantsCount > 1 ? 'Pessoas' : 'Pessoa'}</span></div>
          <div class="line"></div>
          <div class="row"><span>Permanência:</span><span class="bold">${effectiveHours} ${effectiveHours === 1 ? 'Hora' : 'Horas'}</span></div>
          <div class="row"><span>Saída Prevista:</span><span class="bold">${expectedOutFormatted}</span></div>
          <div class="row"><span>Tarifa Horária:</span><span>${formatCurrency(ratePerHour)}</span></div>
          <div class="line"></div>
          <div class="row total-row"><span>TOTAL PAGO:</span><span>${formatCurrency(totalAmount)}</span></div>
          <div class="row"><span>Liquidação:</span><span class="bold">${paymentMethod}</span></div>
          <div class="line"></div>
          <div class="center" style="font-size: 10px; margin-top: 10px;">
            Guarde esta ficha para conferência e devolução da chave na saída.<br/>
            Desejamos-lhe uma excelente estadia! ✨
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleSendWhatsAppConfirmation = () => {
    if (!guestPhone.trim()) {
      toast({
        variant: 'destructive',
        title: 'Número em falta',
        description: 'Insira o telemóvel do hóspede para enviar via WhatsApp.',
      });
      return;
    }

    const roomName = selectedRoom?.name || 'Quarto';
    const guest = guestName.trim() || 'Estimado(a) Hóspede';
    let msg = `🛎️ *CONFIRMAÇÃO DE ENTRADA — MAJOR STAY*\n\n`;
    msg += `Olá, *${guest}*! A sua entrada no *${roomName}* foi confirmada com sucesso:\n\n`;
    msg += `🛏️ *Alojamento:* ${roomName} (${getRoomTypeLabel(selectedRoom?.type)})\n`;
    msg += `⏱️ *Duração Contratada:* ${effectiveHours} ${effectiveHours === 1 ? 'hora' : 'horas'}\n`;
    msg += `🕒 *Entrada:* ${nowTime || 'Agora'}\n`;
    msg += `🚪 *Saída Prevista:* ${expectedOutFormatted}\n`;
    msg += `💵 *Total da Estadia:* ${formatCurrency(totalAmount)}\n`;
    msg += `💳 *Método:* ${paymentMethod}\n\n`;
    msg += `🔑 A sua chave física foi alocada. Caso necessite de serviço de bar ou atendimento, dirija-se à recepção.\n\n`;
    msg += `Desejamos-lhe uma ótima estadia! ✨\n`;
    msg += `_MajorStay Hospitality Suite_`;

    openWhatsApp(guestPhone, msg);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F9F8F6] dark:bg-[#120D0A] min-h-screen text-neutral-800 dark:text-[#EFEBE4] pb-20">
      {/* 1. CABEÇALHO ELEGANTE DA PÁGINA */}
      <header className="px-4 sm:px-8 py-5 border-b border-[#EEECE6] dark:border-[#2C211B] bg-white/70 dark:bg-[#18120E]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FAEDE2] dark:bg-[#341F14] text-[#BA5A1A] dark:text-[#F3B080] flex items-center justify-center shadow-xs">
                <Key className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 font-headline">
                Nova Entrada de Hóspede
              </h1>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-normal">
              Check-in rápido de balcão com alocação imediata de chave física e abertura de ficha
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {/* Badge Status de Turno */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-[#201915] border border-[#EEECE6] dark:border-[#382D26] rounded-full shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                Turno Atual <span className="text-neutral-300 dark:text-neutral-600">•</span> Caixa Operacional
              </span>
            </div>

            {/* Botão Voltar */}
            <Link
              href="/rooms"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#201915] hover:bg-neutral-50 dark:hover:bg-[#2A211C] border border-[#EEECE6] dark:border-[#382D26] text-neutral-700 dark:text-neutral-200 transition-colors text-xs font-semibold shadow-xs group"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-neutral-400 group-hover:-translate-x-0.5 transition-transform" />
              Voltar aos Quartos
            </Link>
          </div>
        </div>
      </header>

      {/* 2. ÁREA DE TRABALHO DE 2 COLUNAS (7 / 5) */}
      <main className="px-4 sm:px-8 py-7 max-w-[1440px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* COLUNA ESQUERDA: Formulário em 3 Passos (7 colunas) */}
          <div className="lg:col-span-7 space-y-6">
            {/* PASSO 1: Selecionar Quarto Livre */}
            <section className="bg-white dark:bg-[#1E1714] border border-[#EEECE6] dark:border-[#382D26] rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FDF3E7] dark:bg-[#341F14] text-[#BA5A1A] dark:text-[#F3B080] text-xs font-bold font-mono">
                    1
                  </span>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                    Selecionar Quarto Livre
                  </h2>
                </div>
                <span className="text-xs font-medium text-[#BA5A1A] dark:text-[#F3B080] bg-[#FDF3E7] dark:bg-[#341F14] border border-[#F0D5C0] dark:border-[#523321] px-2.5 py-0.5 rounded-full">
                  {freeRooms.length} {freeRooms.length === 1 ? 'Quarto Disponível' : 'Quartos Disponíveis'}
                </span>
              </div>

              {freeRooms.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-[#DDD6CC] dark:border-[#3D322C] bg-[#FAF8F5] dark:bg-[#18120F]">
                  <AlertCircle className="w-8 h-8 text-[#BA5A1A] mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    Nenhum quarto livre no momento
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Todos os quartos estão atualmente ocupados ou em processo de higienização.
                  </p>
                  <Link
                    href="/rooms"
                    className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-[#BA5A1A] text-white text-xs font-bold"
                  >
                    Ver Quadro Geral de Quartos
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {freeRooms.map((room) => {
                    const isSelected = room.id === selectedRoomId;
                    const amenities = getRoomAmenities(room);
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => handleSelectRoom(room)}
                        className={`text-left p-4 rounded-xl relative flex flex-col justify-between min-h-[135px] transition-all cursor-pointer shadow-xs ${
                          isSelected
                            ? 'border-2 border-[#BA5A1A] bg-[#FDF9F5] dark:bg-[#291B14] ring-2 ring-[#BA5A1A]/15'
                            : 'border border-[#EEECE6] dark:border-[#382D26] bg-white dark:bg-[#1E1714] hover:border-[#DDD6CC] dark:hover:border-[#4D3F36] hover:bg-[#FAF8F5] dark:hover:bg-[#251D18]'
                        }`}
                      >
                        <div className="flex items-start justify-between w-full">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md inline-block mb-1">
                              Disponível
                            </span>
                            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                              {room.name}
                            </h3>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-[#BA5A1A] text-white shadow-xs'
                                : 'border border-neutral-300 dark:border-neutral-600 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>

                        <div className="mt-2">
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                            {getRoomTypeLabel(room.type)}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {amenities.map((am, i) => (
                              <span
                                key={i}
                                className="text-[10px] text-neutral-500 dark:text-neutral-400 bg-white dark:bg-[#18120F] border border-[#E8E4DC] dark:border-[#382D26] px-1.5 py-0.5 rounded"
                              >
                                {am}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 text-xs font-bold text-[#BA5A1A] dark:text-[#F3B080] font-mono">
                            {formatCurrency(room.ratePerHour)}/h
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* PASSO 2: Modalidade & Duração */}
            <section className="bg-white dark:bg-[#1E1714] border border-[#EEECE6] dark:border-[#382D26] rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FDF3E7] dark:bg-[#341F14] text-[#BA5A1A] dark:text-[#F3B080] text-xs font-bold font-mono">
                    2
                  </span>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                    Modalidade &amp; Duração
                  </h2>
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 font-normal">
                  Entrada Imediata: <strong className="text-neutral-900 dark:text-neutral-100 font-mono">{nowTime || '20:15'}</strong>
                </div>
              </div>

              {/* Segmented Control Pill */}
              <div className="p-1 bg-[#F4F2EC] dark:bg-[#251D18] rounded-xl flex items-center gap-1 mb-5">
                <button
                  type="button"
                  onClick={() => setStayMode('horas')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                    stayMode === 'horas'
                      ? 'bg-white dark:bg-[#1E1714] text-neutral-900 dark:text-neutral-100 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  <Clock className="w-4 h-4 text-[#BA5A1A]" />
                  Por Horas / Rápida
                </button>
                <button
                  type="button"
                  onClick={() => setStayMode('diaria')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                    stayMode === 'diaria'
                      ? 'bg-white dark:bg-[#1E1714] text-neutral-900 dark:text-neutral-100 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  <BedDouble className="w-4 h-4 text-[#BA5A1A]" />
                  Diária Completa / Pernoite
                </button>
              </div>

              {/* Seleção de Horas */}
              {stayMode === 'horas' && (
                <div className="space-y-2.5 mb-5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Tempo de Permanência
                    </label>
                    <span className="text-[11px] text-neutral-400">Tolerância automática de 10 min</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {DURATION_PRESETS.slice(0, 4).map((preset) => {
                      const active = contractedHours === preset.hours;
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => setContractedHours(preset.hours)}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold text-center transition-all ${
                            active
                              ? 'border-2 border-[#BA5A1A] bg-[#FDF9F5] dark:bg-[#2A1B14] text-[#BA5A1A] dark:text-[#F3B080] shadow-xs'
                              : 'border border-[#EEECE6] dark:border-[#382D26] bg-[#FAF9F6] dark:bg-[#18120F] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    {DURATION_PRESETS.slice(4).map((preset) => {
                      const active = contractedHours === preset.hours;
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => setContractedHours(preset.hours)}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold text-center transition-all ${
                            active
                              ? 'border-2 border-[#BA5A1A] bg-[#FDF9F5] dark:bg-[#2A1B14] text-[#BA5A1A] dark:text-[#F3B080] shadow-xs'
                              : 'border border-[#EEECE6] dark:border-[#382D26] bg-[#FAF9F6] dark:bg-[#18120F] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/70'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Previsão de Saída */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF9F6] dark:bg-[#18120F] border border-[#F0EDE6] dark:border-[#382D26]">
                <div className="flex items-center gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                  <span className="w-7 h-7 rounded-lg bg-white dark:bg-[#201915] border border-[#EEECE6] dark:border-[#382D26] flex items-center justify-center text-[#BA5A1A]">
                    <Clock className="w-4 h-4" />
                  </span>
                  <span>Saída prevista do quarto:</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-sm font-bold text-[#BA5A1A] dark:text-[#F3B080]">
                    {expectedOutFormatted}
                  </span>
                </div>
              </div>
            </section>

            {/* PASSO 3: Identificação do Hóspede */}
            <section className="bg-white dark:bg-[#1E1714] border border-[#EEECE6] dark:border-[#382D26] rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FDF3E7] dark:bg-[#341F14] text-[#BA5A1A] dark:text-[#F3B080] text-xs font-bold font-mono">
                    3
                  </span>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                    Identificação do Hóspede
                  </h2>
                </div>
                {/* Botão Balcão / Anônimo */}
                <button
                  type="button"
                  onClick={handleFillBalcao}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#BA5A1A] dark:text-[#F3B080] bg-[#FDF3E7] dark:bg-[#341F14] hover:bg-[#FBE7D4] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  + Hóspede Balcão / Anônimo
                </button>
              </div>

              <div className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Nome Completo ou Referência *
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Ex: Carlos Macamo ou Balcão"
                      className="w-full bg-[#FAF9F6] dark:bg-[#18120F] border border-[#E8E4DC] dark:border-[#382D26] focus:border-[#BA5A1A] focus:bg-white dark:focus:bg-[#1E1714] rounded-xl pl-10 pr-4 py-2.5 text-xs text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:ring-1 focus:ring-[#BA5A1A] transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Telefone e Ocupantes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Telefone / M-Pesa (Moçambique)
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-neutral-400" />
                      <input
                        type="text"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+258 84/82/87..."
                        className="w-full bg-[#FAF9F6] dark:bg-[#18120F] border border-[#E8E4DC] dark:border-[#382D26] focus:border-[#BA5A1A] focus:bg-white dark:focus:bg-[#1E1714] rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:ring-1 focus:ring-[#BA5A1A] transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Ocupantes
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOccupantsCount(1)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                          occupantsCount === 1
                            ? 'border-2 border-[#BA5A1A] bg-[#FDF9F5] dark:bg-[#2A1B14] text-[#BA5A1A] dark:text-[#F3B080] font-bold shadow-xs'
                            : 'border border-[#EEECE6] dark:border-[#382D26] bg-[#FAF9F6] dark:bg-[#18120F] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        1 Pessoa
                      </button>
                      <button
                        type="button"
                        onClick={() => setOccupantsCount(2)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                          occupantsCount === 2
                            ? 'border-2 border-[#BA5A1A] bg-[#FDF9F5] dark:bg-[#2A1B14] text-[#BA5A1A] dark:text-[#F3B080] font-bold shadow-xs'
                            : 'border border-[#EEECE6] dark:border-[#382D26] bg-[#FAF9F6] dark:bg-[#18120F] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        2 Pessoas
                      </button>
                    </div>
                  </div>
                </div>

                {/* Documento Opcional */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Documento de Identificação
                    </label>
                    <span className="text-[11px] text-neutral-400">Opcional para curta estadia</span>
                  </div>
                  <div className="relative flex items-center">
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={guestDoc}
                      onChange={(e) => setGuestDoc(e.target.value)}
                      placeholder="Nº de BI, DIRE ou Passaporte"
                      className="w-full bg-[#FAF9F6] dark:bg-[#18120F] border border-[#E8E4DC] dark:border-[#382D26] focus:border-[#BA5A1A] focus:bg-white dark:focus:bg-[#1E1714] rounded-xl pl-10 pr-4 py-2.5 text-xs text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:ring-1 focus:ring-[#BA5A1A] transition-all outline-none"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* COLUNA DIREITA: Ficha Operacional de Balcão & Fecho (5 colunas, sticky) */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
            <div className="bg-white dark:bg-[#1E1714] border border-[#EEECE6] dark:border-[#382D26] rounded-2xl p-6 shadow-sm space-y-5">
              {/* Cabeçalho do Card */}
              <div className="flex items-start justify-between pb-4 border-b border-[#EEECE6] dark:border-[#2C211B]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Ficha Operacional de Balcão
                  </span>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5 font-headline">
                    Resumo da Estadia
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FDF3E7] dark:bg-[#341F14] text-[#BA5A1A] dark:text-[#F3B080] text-[11px] font-bold border border-[#F0D5C0] dark:border-[#523321]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#BA5A1A]"></span>
                  Entrada Imediata
                </span>
              </div>

              {/* Informações Estruturadas */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F6] dark:bg-[#18120F] border border-[#F0EDE6] dark:border-[#382D26] space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Acomodação:</span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {selectedRoom ? `${selectedRoom.name} (${getRoomTypeLabel(selectedRoom.type)})` : 'Nenhum selecionado'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Hóspede:</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {guestName.trim() || 'Hóspede Particular'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Horário:</span>
                  <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">
                    {nowTime || '20:15'} → {expectedCheckOutDate.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })} ({effectiveHours}h)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Ocupantes:</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {occupantsCount} {occupantsCount > 1 ? 'Pessoas' : 'Pessoa'}
                  </span>
                </div>
              </div>

              {/* Discriminação de Custos */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                  <span>Tarifa de Quarto ({effectiveHours} {effectiveHours === 1 ? 'Hora' : 'Horas'})</span>
                  <span className="font-mono text-neutral-800 dark:text-neutral-200 font-semibold">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                  <span>Caução de Chave (Reembolsável)</span>
                  <span className="font-mono text-neutral-800 dark:text-neutral-200 font-medium">0,00 MTn</span>
                </div>
                <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                  <span>Taxas Turísticas</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Incluído</span>
                </div>

                {/* Total */}
                <div className="pt-4 mt-3 border-t border-[#EEECE6] dark:border-[#2C211B] flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Total a Pagar Agora
                    </span>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Lança no Turno Atual
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 font-mono tracking-tight">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Métodos de Liquidação */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Método de Liquidação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const active = paymentMethod === method.id;
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`p-2.5 rounded-xl text-xs flex items-center gap-2 transition-all ${
                          active
                            ? 'border-2 border-[#BA5A1A] bg-[#FDF9F5] dark:bg-[#2A1B14] text-[#BA5A1A] dark:text-[#F3B080] font-bold'
                            : 'border border-[#EEECE6] dark:border-[#382D26] bg-[#FAF9F6] dark:bg-[#18120F] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#BA5A1A]' : 'text-neutral-400'}`} />
                        <span className="truncate">{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  disabled={submitting || !selectedRoom}
                  onClick={() => handleSubmitCheckIn()}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#834218] via-[#BA5A1A] to-[#D08F52] hover:brightness-105 active:scale-[0.99] text-white font-bold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Key className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Registando Entrada...'
                      : `Confirmar Entrada & Liberar ${selectedRoom?.name || 'Quarto'}`}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handlePrintSlip}
                    className="py-2.5 px-3 rounded-xl bg-white dark:bg-[#201915] hover:bg-neutral-50 dark:hover:bg-[#2A211C] border border-[#EEECE6] dark:border-[#382D26] text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Ficha Térmica</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendWhatsAppConfirmation}
                    className="py-2.5 px-3 rounded-xl bg-[#EDF7F1] dark:bg-[#182C20] hover:bg-[#E0F2E7] border border-[#CDE5D5] dark:border-[#2C4835] text-[#245D3B] dark:text-[#8CD9A9] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#245D3B] dark:text-[#8CD9A9]" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Nota de Sincronização */}
              <div className="pt-2 text-center text-[11px] text-neutral-400">
                <span>Atualiza em tempo real a grelha de quartos e caixa do turno</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
