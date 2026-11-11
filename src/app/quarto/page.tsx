'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Clock,
  Wifi,
  Phone,
  MessageCircle,
  Wine,
  Sparkles,
  Maximize2,
  Minimize2,
  RefreshCw,
  Copy,
  Check,
  Plus,
  Minus,
  Send,
  Hotel,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';
import { normalizeDate } from '@/lib/hospitality-calc';

interface RoomHubData {
  room: {
    id: string;
    name: string;
    type?: string;
    status: string;
    ratePerHour: number;
    notes?: string;
  };
  hotel: {
    name: string;
    phone: string;
    whatsapp: string;
    wifiSsid?: string | null;
    wifiPassword?: string | null;
  };
  stay: {
    id: string;
    checkInAt: string;
    contractedHours: number;
    expectedCheckOut: string;
    ratePerHour: number;
    graceMinutes: number;
  } | null;
  barProducts: {
    id: string;
    name: string;
    price: number;
    category?: string;
  }[];
}

function QuartoPortalContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('c') || 'guest';
  const roomId = searchParams.get('r') || 'room-1';

  const [data, setData] = useState<RoomHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [now, setNow] = useState<number>(Date.now());

  // Atualização do relógio a cada 10 segundos
  useEffect(() => {
    const clockTimer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(clockTimer);
  }, []);

  // Carregar dados do quarto
  const fetchRoomData = useCallback(async () => {
    try {
      const res = await fetch(`/api/room-hub?c=${encodeURIComponent(companyId)}&r=${encodeURIComponent(roomId)}`);
      if (!res.ok) {
        throw new Error('Não foi possível carregar os dados deste quarto.');
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar quarto.');
    } finally {
      setLoading(false);
    }
  }, [companyId, roomId]);

  useEffect(() => {
    fetchRoomData();
    // Atualização em segundo plano a cada 25 segundos
    const pollTimer = setInterval(fetchRoomData, 25000);
    return () => clearInterval(pollTimer);
  }, [fetchRoomData]);

  // Gestão de ecrã inteiro (ideal para tablets/telemóveis na parede)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const copyWifiPassword = () => {
    if (data?.hotel.wifiPassword) {
      navigator.clipboard.writeText(data.hotel.wifiPassword);
      setCopiedWifi(true);
      setTimeout(() => setCopiedWifi(false), 2500);
    }
  };

  // Cálculos de tempo da estadia (sereno, sem tremer)
  const stayMetrics = useMemo(() => {
    if (!data?.stay) return null;
    const expMs = new Date(data.stay.expectedCheckOut).getTime();
    const checkInMs = new Date(data.stay.checkInAt).getTime();
    const diffMs = expMs - now;
    const diffMinutes = Math.round(diffMs / 60000);

    const checkInTimeStr = new Date(checkInMs).toLocaleTimeString('pt-MZ', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const checkOutTimeStr = new Date(expMs).toLocaleTimeString('pt-MZ', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isEndingSoon = diffMinutes <= 15 && diffMinutes > 0;
    const isGracePeriod = diffMinutes <= 0 && diffMinutes >= -10;
    const isOvertime = diffMinutes < -10;

    let timeLabel = '';
    if (diffMinutes > 60) {
      const h = Math.floor(diffMinutes / 60);
      const m = diffMinutes % 60;
      timeLabel = `${h}h ${m > 0 ? `${m}m` : ''} restantes`;
    } else if (diffMinutes > 0) {
      timeLabel = `${diffMinutes} minutos restantes`;
    } else if (isGracePeriod) {
      timeLabel = `Período de cortesia (${10 + diffMinutes} min)`;
    } else {
      timeLabel = `Tempo excedido há ${Math.abs(diffMinutes)} min`;
    }

    return {
      checkInTimeStr,
      checkOutTimeStr,
      diffMinutes,
      isEndingSoon,
      isGracePeriod,
      isOvertime,
      timeLabel,
    };
  }, [data?.stay, now]);

  // Gestão do Carrinho do Bar
  const addToCart = (productId: string) => {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      if (next[productId] > 1) {
        next[productId] -= 1;
      } else {
        delete next[productId];
      }
      return next;
    });
  };

  const cartTotal = useMemo(() => {
    if (!data?.barProducts) return 0;
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const prod = data.barProducts.find((p) => p.id === id);
      return sum + (prod ? prod.price * qty : 0);
    }, 0);
  }, [cart, data?.barProducts]);

  const sendBarOrderWhatsApp = () => {
    if (!data) return;
    const items = Object.entries(cart)
      .map(([id, qty]) => {
        const prod = data.barProducts.find((p) => p.id === id);
        return prod ? `• ${qty}x ${prod.name} (${prod.price * qty} MT)` : '';
      })
      .filter(Boolean)
      .join('\n');

    const msg = `Olá receção, estou no *${data.room.name}* e gostaria de fazer o seguinte pedido de bar:\n\n${items}\n\n*Total a pagar: ${cartTotal} MT*\nPor favor confirmar e trazer ao quarto. Obrigado!`;
    const cleanWhatsapp = data.hotel.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendExtensionWhatsApp = () => {
    if (!data) return;
    const msg = `Olá receção, estou no *${data.room.name}* e gostaria de solicitar a extensão da minha estadia por mais 1 hora (+${data.stay?.ratePerHour || data.room.ratePerHour} MT).`;
    const cleanWhatsapp = data.hotel.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendCheckOutWhatsApp = () => {
    if (!data) return;
    const msg = `Olá receção, estou no *${data.room.name}* e pretendo realizar o check-out. Podem preparar a minha fatura? Obrigado!`;
    const cleanWhatsapp = data.hotel.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] dark:bg-[#111418] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#FDF6E8] dark:bg-[#1F2630] border border-[#F6E0B5] dark:border-[#2C3440] flex items-center justify-center text-[#C58A2C] animate-pulse">
          <Hotel className="w-7 h-7" />
        </div>
        <h2 className="mt-4 font-bold text-base text-[#251D18] dark:text-[#F5EFEB]">A ligar ao quarto...</h2>
        <p className="text-xs text-[#827568] dark:text-[#A0AEC0] mt-1">Carregando informações do MajorStay</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] dark:bg-[#111418] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 mb-4">
          <Info className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">Quarto Indisponível</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mt-1">{error || 'Dados inválidos'}</p>
        <Button onClick={fetchRoomData} variant="outline" className="mt-4 text-xs rounded-xl">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  const { room, hotel, stay, barProducts } = data;
  const isOccupied = room.status === 'occupied' || room.status === 'overtime' || Boolean(stay);

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#111418] text-[#251D18] dark:text-[#F5EFEB] flex flex-col font-sans selection:bg-[#C58A2C]/20">
      {/* Topo Nobre com Branding e Controles */}
      <header className="sticky top-0 z-30 bg-[#FFFDF9]/90 dark:bg-[#191E25]/90 backdrop-blur-md border-b border-[#E5DFD6] dark:border-[#2C3440] px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C58A2C] to-[#C86A2B] text-white flex items-center justify-center shadow-xs">
            <Hotel className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#251D18] dark:text-[#F5EFEB] leading-tight">
              {hotel.name}
            </h1>
            <p className="text-[11px] font-medium text-[#C58A2C] flex items-center gap-1">
              <span>{room.name}</span>
              {room.type && (
                <span className="text-[10px] text-stone-500 uppercase">({room.type})</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchRoomData}
            title="Atualizar dados"
            className="h-8 w-8 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair do Ecrã Inteiro' : 'Ecrã Inteiro'}
            className="h-8 w-8 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-4 pb-28">
        {/* Bloco de Estado da Estadia (Se Ocupado) */}
        {isOccupied && stayMetrics ? (
          <div className="space-y-3">
            {/* Cartão Principal do Período */}
            <Card className="rounded-3xl border border-[#F6E0B5] dark:border-[#382D26] bg-gradient-to-b from-[#FFFDF9] to-[#FDF9F0] dark:from-[#191E25] dark:to-[#171B20] p-5 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-28 h-28 bg-[#C58A2C]/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between pb-3 border-b border-[#F2ECE1] dark:border-[#2C3440]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                    Estadia em Curso
                  </span>
                </div>
                <Badge className="bg-[#FDF6E8] text-[#C58A2C] dark:bg-[#2A2118] dark:text-[#E8BF72] border border-[#F6E0B5] dark:border-[#4A382C] text-xs font-semibold px-2.5 py-0.5 shadow-none">
                  {stayMetrics.timeLabel}
                </Badge>
              </div>

              {/* Horários: Entrada e Saída Prevista */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">Entrada Registada</span>
                  <p className="text-lg font-bold text-stone-700 dark:text-stone-200 font-mono">
                    {stayMetrics.checkInTimeStr}
                  </p>
                </div>
                <div className="space-y-0.5 text-right">
                  <span className="text-[11px] text-[#C58A2C] font-semibold">Saída Prevista</span>
                  <p className="text-2xl font-black text-[#C58A2C] font-mono tracking-tight">
                    {stayMetrics.checkOutTimeStr}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[#F2ECE1] dark:border-[#2C3440] flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                <span>Período: {stay?.contractedHours}h contratadas</span>
                <span>Tolerância de cortesia: 10 min</span>
              </div>
            </Card>

            {/* Alerta Suave e Amigável nos últimos 15 min ou na cortesia */}
            {(stayMetrics.isEndingSoon || stayMetrics.isGracePeriod || stayMetrics.isOvertime) && (
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  stayMetrics.isOvertime
                    ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                    : 'bg-[#FDF6E8] dark:bg-[#261E16] border-[#F6E0B5] dark:border-[#4E3917] text-[#975A16] dark:text-[#ECC94B]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-black/20 flex items-center justify-center shrink-0 mt-0.5 text-inherit">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-bold text-xs sm:text-sm leading-tight">
                      {stayMetrics.isOvertime
                        ? 'O seu período terminou'
                        : stayMetrics.isGracePeriod
                        ? 'Período de tolerância em curso'
                        : 'A sua estadia termina em breve'}
                    </h4>
                    <p className="text-xs opacity-90 leading-relaxed">
                      {stayMetrics.isOvertime
                        ? 'Poderá estender a sua estadia ou solicitar o encerramento da conta à receção.'
                        : 'Deseja continuar por mais 1 hora ou prefere que a receção prepare a sua saída?'}
                    </p>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={sendExtensionWhatsApp}
                        className="h-8 text-xs font-bold rounded-xl bg-[#C58A2C] hover:bg-[#A87019] text-white shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Prolongar +1 Hora
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={sendCheckOutWhatsApp}
                        className="h-8 text-xs font-semibold rounded-xl border-current text-inherit hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        Solicitar Fecho
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Quando o Quarto Está Livre */
          <Card className="rounded-3xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-800 dark:text-stone-100">
                {room.name} · Higienizado & Disponível
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Tarifa: {formatCurrency(room.ratePerHour)} por hora. Para iniciar a estadia, contacte o balcão.
              </p>
            </div>
            <div className="pt-2">
              <Button
                asChild
                className="h-10 text-xs font-bold rounded-xl bg-gradient-to-r from-[#C58A2C] to-[#C86A2B] text-white"
              >
                <a href={`tel:${hotel.phone || ''}`}>
                  <Phone className="w-3.5 h-3.5 mr-1.5" />
                  Contactar Receção ({hotel.phone || 'Balcão'})
                </a>
              </Button>
            </div>
          </Card>
        )}

        {/* Card do Wi-Fi & Serviços Rápidos */}
        <div className={cn("grid gap-3", (hotel.wifiSsid && hotel.wifiPassword) ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
          {hotel.wifiSsid && hotel.wifiPassword && (
            <Card className="rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FDF6E8] dark:bg-[#2A2118] text-[#C58A2C] flex items-center justify-center shrink-0">
                  <Wifi className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Wi-Fi do Quarto</span>
                  <p className="text-xs font-bold truncate text-stone-800 dark:text-stone-200">{hotel.wifiSsid}</p>
                  <p className="text-[11px] font-mono text-stone-500 truncate">
                    Senha: <strong className="text-stone-700 dark:text-stone-300">{hotel.wifiPassword}</strong>
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={copyWifiPassword}
                className="h-9 w-9 rounded-xl border-[#E5DFD6] dark:border-[#2C3440] shrink-0 text-stone-600 dark:text-stone-300"
                title="Copiar senha"
              >
                {copiedWifi ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </Card>
          )}

          <Card className="rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Apoio ao Hóspede</span>
                <p className="text-xs font-bold text-stone-800 dark:text-stone-200">Serviço de Quarto</p>
                <p className="text-[11px] text-stone-500">Toalhas, bebidas ou dúvidas</p>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              className="h-9 rounded-xl text-xs font-bold bg-[#245D3B] hover:bg-[#1B482E] text-white shrink-0"
            >
              <a
                href={`https://wa.me/${hotel.whatsapp}?text=${encodeURIComponent(
                  `Olá receção, estou no *${room.name}* e necessito de apoio.`
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Falar
              </a>
            </Button>
          </Card>
        </div>

        {/* Cardápio do Bar & Bebidas */}
        {barProducts && barProducts.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wine className="w-4 h-4 text-[#C58A2C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  Cardápio do Bar & Snacks
                </h3>
              </div>
              <span className="text-[11px] text-stone-500">Entregue no quarto</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {barProducts.map((p) => {
                const qty = cart[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">{p.name}</p>
                      <p className="text-[11px] font-semibold text-[#C58A2C] mt-0.5">{formatCurrency(p.price)}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {qty > 0 && (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => removeFromCart(p.id)}
                            className="h-7 w-7 rounded-lg border-[#E5DFD6] dark:border-[#2C3440] text-stone-600 dark:text-stone-300"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-5 text-center text-xs font-bold font-mono">{qty}</span>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant={qty > 0 ? 'default' : 'outline'}
                        onClick={() => addToCart(p.id)}
                        className={`h-7 w-7 rounded-lg ${
                          qty > 0
                            ? 'bg-[#C58A2C] hover:bg-[#A87019] text-white'
                            : 'border-[#E5DFD6] dark:border-[#2C3440] text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rodapé Discreto de Garantia de Privacidade */}
        <div className="pt-4 text-center text-[11px] text-stone-400 dark:text-stone-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>MajorStay Hospitality · Privacidade e discrição garantidas</span>
        </div>
      </main>

      {/* Barra Flutuante de Fecho de Pedido do Bar (Apenas se tiver itens no carrinho) */}
      {cartTotal > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-[#FFFDF9]/95 dark:bg-[#191E25]/95 backdrop-blur-md border-t border-[#E5DFD6] dark:border-[#2C3440] shadow-lg">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-stone-400">Total do Pedido</span>
              <p className="text-base font-black text-[#C58A2C]">{formatCurrency(cartTotal)}</p>
            </div>
            <Button
              onClick={sendBarOrderWhatsApp}
              className="h-11 px-5 rounded-xl font-bold bg-[#245D3B] hover:bg-[#1C462C] text-white shadow-md flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Pedir via WhatsApp</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuartoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFFDF9] dark:bg-[#111418] flex items-center justify-center">
          <p className="text-xs text-stone-500">A carregar quarto...</p>
        </div>
      }
    >
      <QuartoPortalContent />
    </Suspense>
  );
}
