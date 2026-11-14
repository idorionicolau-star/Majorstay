'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Clock,
  Wifi,
  Phone,
  MessageCircle,
  Wine,
  CheckCircle2,
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
  Lock,
  Unlock,
  AlertCircle,
  Receipt,
  Hourglass,
  XCircle,
  Utensils,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';

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
  };
  pinRequired: boolean;
  barProducts: {
    id: string;
    name: string;
    price: number;
    category?: string;
    isDish?: boolean;
    soldByWeight?: boolean;
    unit?: string;
  }[];
}

interface StayConsumption {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addedAt: string | null;
  notes?: string;
  weightKg?: number;
}

interface RoomOrderItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface RoomOrder {
  id: string;
  status: 'pending' | 'confirmed' | 'rejected';
  items: RoomOrderItem[];
  total: number;
  createdAt: string;
  rejectReason?: string | null;
}

interface PricingSummary {
  roomTotal: number;
  consumptionsTotal: number;
  pendingOrdersTotal: number;
  totalDue: number;
  estimatedTotalWithPending: number;
  amountPaid?: number;
  balanceDue?: number;
  packageType?: 'pernoite' | 'diaria' | null;
}

interface StayUnlockedData {
  id: string;
  checkInAt: string;
  contractedHours: number;
  expectedCheckOut: string;
  ratePerHour: number;
  graceMinutes: number;
  consumptions?: StayConsumption[];
}

interface WifiData {
  ssid: string | null;
  password: string | null;
}

function QuartoPortalContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('c') || 'guest';
  const roomId = searchParams.get('r') || 'room-1';

  const [data, setData] = useState<RoomHubData | null>(null);
  const [stay, setStay] = useState<StayUnlockedData | null>(null);
  const [wifi, setWifi] = useState<WifiData | null>(null);
  const [orders, setOrders] = useState<RoomOrder[]>([]);
  const [pricing, setPricing] = useState<PricingSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  // Pedido do bar: confirmação antes de enviar + estado do pedido enviado (pendente até a receção confirmar)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendingOrder, setSendingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSent, setOrderSent] = useState<{ id: string; total: number; lines: { name: string; qty: number; price: number; kg?: boolean }[] } | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Estado de PIN & Desbloqueio seguro no servidor
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const pinStorageKey = `ms_room_pin_${companyId}_${roomId}`;

  // Atualização do relógio a cada 10 segundos
  useEffect(() => {
    const clockTimer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(clockTimer);
  }, []);

  // Função para validar PIN no servidor via POST /api/room-hub/unlock
  const unlockWithPin = useCallback(async (pinToTest: string): Promise<boolean> => {
    try {
      setIsSubmittingPin(true);
      const res = await fetch('/api/room-hub/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c: companyId, r: roomId, pin: pinToTest }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 200 && json.success) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(pinStorageKey, pinToTest);
        }
        setStay(json.stay);
        setWifi(json.wifi || null);
        setOrders(Array.isArray(json.orders) ? json.orders : []);
        setPricing(json.pricing || null);
        setIsUnlocked(true);
        setPinError(null);
        setIsLockedOut(false);
        return true;
      }

      if (res.status === 429) {
        setIsLockedOut(true);
        setPinError(json.error || 'Demasiadas tentativas incorretas. Acesso bloqueado por 15 minutos.');
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(pinStorageKey);
        }
        setIsUnlocked(false);
        setStay(null);
        setWifi(null);
        setOrders([]);
        setPricing(null);
        return false;
      }

      // 403 ou outros erros
      setPinError(json.error || 'PIN incorreto. Acesso não autorizado.');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(pinStorageKey);
      }
      setIsUnlocked(false);
      setStay(null);
      setWifi(null);
      setOrders([]);
      setPricing(null);
      return false;
    } catch (err: any) {
      setPinError('Erro ao comunicar com o servidor. Verifique a sua ligação.');
      return false;
    } finally {
      setIsSubmittingPin(false);
    }
  }, [companyId, roomId, pinStorageKey]);

  // Carregar dados públicos do quarto via GET /api/room-hub
  const fetchRoomData = useCallback(async () => {
    try {
      const res = await fetch(`/api/room-hub?c=${encodeURIComponent(companyId)}&r=${encodeURIComponent(roomId)}`);
      if (!res.ok) {
        throw new Error('Não foi possível carregar os dados deste quarto.');
      }
      const json: RoomHubData = await res.json();
      setData(json);
      setError(null);

      // Se o quarto estiver livre ou sem estadia aberta, limpar sessão
      if (!json.pinRequired) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(pinStorageKey);
        }
        setIsUnlocked(false);
        setStay(null);
        setWifi(null);
        setOrders([]);
        setPricing(null);
        setPinError(null);
        setIsLockedOut(false);
      } else {
        // Se houver estadia ativa e tivermos PIN guardado na sessão, revalidar no servidor
        if (typeof window !== 'undefined') {
          const savedPin = sessionStorage.getItem(pinStorageKey);
          if (savedPin) {
            await unlockWithPin(savedPin);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar quarto.');
    } finally {
      setLoading(false);
    }
  }, [companyId, roomId, pinStorageKey, unlockWithPin]);

  useEffect(() => {
    fetchRoomData();
    // Atualização em segundo plano a cada 25 segundos
    const pollTimer = setInterval(fetchRoomData, 25000);
    return () => clearInterval(pollTimer);
  }, [fetchRoomData]);

  // Submissão do formulário de PIN pelo hóspede
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim() || pinInput.trim().length < 4) return;
    await unlockWithPin(pinInput.trim());
  };

  // Gestão de ecrã inteiro
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
    if (wifi?.password) {
      navigator.clipboard.writeText(wifi.password);
      setCopiedWifi(true);
      setTimeout(() => setCopiedWifi(false), 2500);
    }
  };

  // Cálculos de tempo da estadia
  const stayMetrics = useMemo(() => {
    if (!stay) return null;
    const expMs = new Date(stay.expectedCheckOut).getTime();
    const checkInMs = new Date(stay.checkInAt).getTime();
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
  }, [stay, now]);

  // Gestão do Carrinho do Bar
  // Pratos vendidos ao peso: o valor no carrinho são quilos, de 0,5 em 0,5. Nos restantes, unidades.
  const cartStep = (productId: string) => (data?.barProducts.find((p) => p.id === productId)?.soldByWeight ? 0.5 : 1);

  const addToCart = (productId: string) => {
    const step = cartStep(productId);
    setCart((prev) => ({ ...prev, [productId]: Math.round(((prev[productId] || 0) + step) * 1000) / 1000 }));
  };

  const removeFromCart = (productId: string) => {
    const step = cartStep(productId);
    setCart((prev) => {
      const next = { ...prev };
      if (next[productId] > step) {
        next[productId] = Math.round((next[productId] - step) * 1000) / 1000;
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
      return sum + (prod ? Math.round(prod.price * qty * 100) / 100 : 0);
    }, 0);
  }, [cart, data?.barProducts]);

  const cartLines = useMemo(() => {
    if (!data?.barProducts) return [];
    return Object.entries(cart)
      .map(([id, qty]) => {
        const prod = data.barProducts.find((p) => p.id === id);
        return prod ? { id, name: prod.name, qty, price: prod.price, kg: Boolean(prod.soldByWeight) } : null;
      })
      .filter((l): l is { id: string; name: string; qty: number; price: number; kg: boolean } => l !== null);
  }, [cart, data?.barProducts]);

  const [orderNotes, setOrderNotes] = useState('');
  const [menuFilter, setMenuFilter] = useState<'all' | 'kitchen' | 'bar' | 'snacks'>('all');

  const filteredBarProducts = useMemo(() => {
    if (!data?.barProducts) return [];
    if (menuFilter === 'kitchen') {
      return data.barProducts.filter(p => p.isDish || ['cozinha', 'pratos', 'refeição', 'pratos principais', 'almoço', 'jantar'].some(c => (p.category || '').toLowerCase().includes(c)));
    }
    if (menuFilter === 'bar') {
      return data.barProducts.filter(p => !p.isDish && ['bebidas', 'bar', 'vinhos', 'cervejas', 'alcoólicas', 'refrigerantes', 'sucos'].some(c => (p.category || '').toLowerCase().includes(c)));
    }
    if (menuFilter === 'snacks') {
      return data.barProducts.filter(p => ['snacks', 'petiscos', 'aperitivos'].some(c => (p.category || '').toLowerCase().includes(c)));
    }
    return data.barProducts;
  }, [data?.barProducts, menuFilter]);

  const openBarWhatsApp = (lines: { name: string; qty: number; price: number; kg?: boolean }[], total: number, orderId?: string) => {
    if (!data) return;
    const items = lines.map((l) => `• ${l.qty}${l.kg ? ' kg de' : 'x'} ${l.name} (${Math.round(l.price * l.qty * 100) / 100} MT)`).join('\n');
    const ref = orderId ? `\nPedido nº ${orderId.slice(-5).toUpperCase()}` : '';
    const msg = `Olá receção, estou no *${data.room.name}* e gostaria de fazer o seguinte pedido de bar:\n\n${items}\n\n*Total a pagar: ${total} MT*${ref}\nPor favor confirmar e trazer ao quarto. Obrigado!`;
    const cleanWhatsapp = data.hotel.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Quarto sem estadia (sem PIN): continua a ser só uma mensagem de WhatsApp.
  const sendBarOrderWhatsApp = () => openBarWhatsApp(cartLines, cartTotal);

  // Estadia com PIN: o pedido fica registado como PENDENTE no sistema até a receção o confirmar.
  const submitOrder = async () => {
    if (!data || sendingOrder || cartLines.length === 0) return;
    const pin = typeof window !== 'undefined' ? sessionStorage.getItem(pinStorageKey) || '' : '';
    setSendingOrder(true);
    setOrderError(null);
    try {
      const res = await fetch('/api/room-hub/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          c: companyId,
          r: roomId,
          pin,
          items: cartLines.map((l) => {
            const weighed = data.barProducts.find((p) => p.id === l.id)?.soldByWeight;
            return weighed ? { productId: l.id, quantity: 1, weightKg: l.qty } : { productId: l.id, quantity: l.qty };
          }),
          notes: orderNotes.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        if (res.status === 403 || res.status === 429) {
          if (typeof window !== 'undefined') sessionStorage.removeItem(pinStorageKey);
          setIsUnlocked(false);
          setConfirmOpen(false);
          return;
        }
        setOrderError(json.error || 'Não foi possível enviar o pedido. Tente de novo.');
        return;
      }
      setOrderSent({
        id: String(json.orderId || ''),
        total: Number(json.total ?? cartTotal),
        lines: cartLines.map((l) => ({ name: l.name, qty: l.qty, price: l.price, kg: l.kg })),
      });
      setCart({});
      setOrderNotes('');
      setConfirmOpen(false);

      // Atualiza o extrato do quarto imediatamente para mostrar o pedido pendente
      if (typeof window !== 'undefined') {
        const savedPin = sessionStorage.getItem(pinStorageKey);
        if (savedPin) unlockWithPin(savedPin);
      }
    } catch {
      setOrderError('Sem ligação à internet. Verifique e tente de novo.');
    } finally {
      setSendingOrder(false);
    }
  };

  const sendExtensionWhatsApp = () => {
    if (!data) return;
    const msg = `Olá receção, estou no *${data.room.name}* e gostaria de solicitar a extensão da minha estadia por mais 1 hora (+${stay?.ratePerHour || data.room.ratePerHour} MT).`;
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
        <h2 className="font-bold text-base text-[#251D18] dark:text-[#F5EFEB]">Alojamento não acessível</h2>
        <p className="text-xs text-[#827568] dark:text-[#A0AEC0] mt-1 max-w-sm">
          {error || 'Não foi possível encontrar este quarto. Confirme o QR Code ou contacte a receção.'}
        </p>
        <Button
          onClick={fetchRoomData}
          variant="outline"
          className="mt-4 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440]"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  const { room, hotel, barProducts } = data;

  // CASO 1: Quarto com Estadia Ativa mas BLOQUEADO por PIN
  if (data.pinRequired && !isUnlocked) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#111418] text-[#251D18] dark:text-[#F5EFEB] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-md bg-white dark:bg-[#191E25] rounded-3xl border border-blue-100 dark:border-slate-800 shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#cce5ff] to-[#e0f2fe] dark:from-blue-950 dark:to-slate-900 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-[#007bb9] dark:text-sky-300 mx-auto shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#cce5ff] dark:bg-blue-950 text-[#006194] dark:text-sky-300 inline-block mb-2">
              {room.name}
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Acesso Privado do Hóspede
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Para sua total privacidade e confidencialidade, introduza o <b>PIN de 4 dígitos</b> do seu comprovativo de check-in.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                disabled={isLockedOut || isSubmittingPin}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(null);
                }}
                placeholder="• • • •"
                className="w-full text-center tracking-[1em] text-2xl font-black py-3.5 px-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-[#007bb9] disabled:opacity-50"
              />

              {pinError && (
                <div className="flex items-center justify-center gap-1.5 mt-2.5 text-xs text-rose-500 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={pinInput.trim().length < 4 || isLockedOut || isSubmittingPin}
              className="w-full h-12 rounded-2xl bg-[#007bb9] hover:bg-[#006194] text-white font-extrabold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Unlock className="w-4 h-4 mr-2" />
              {isSubmittingPin ? 'A Validar...' : 'Desbloquear Painel do Quarto'}
            </Button>
          </form>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            {hotel.name} · Sessão individual e confidencial
          </div>
        </div>
      </div>
    );
  }

  // CASO 2: Quarto Desbloqueado com Sucesso OU Quarto Livre
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
        {/* Bloco de Estado da Estadia (Se Desbloqueado e Ocupado) */}
        {data.pinRequired && isUnlocked && stayMetrics ? (
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
          /* Quando o Quarto Está Livre (QR mostra Quarto Livre sem dados nenhuns) */
          <Card className="rounded-3xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-800 dark:text-stone-100">
                {room.name} · Higienizado & Disponível
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Tarifa: {formatCurrency(room.ratePerHour)} por hora. Para iniciar a sua estadia, dirija-se à receção.
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

        {/* Card do Wi-Fi Seguro (Apenas visível com PIN Desbloqueado) */}
        {isUnlocked && wifi?.ssid && wifi?.password && (
          <Card className="rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#FDF6E8] dark:bg-[#2A2118] text-[#C58A2C] flex items-center justify-center shrink-0">
                <Wifi className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Wi-Fi do Quarto</span>
                <p className="text-xs font-bold truncate text-stone-800 dark:text-stone-200">{wifi.ssid}</p>
                <p className="text-[11px] font-mono text-stone-500 truncate">
                  Senha: <strong className="text-stone-700 dark:text-stone-300">{wifi.password}</strong>
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

        {/* Serviço de Apoio ao Hóspede via WhatsApp */}
        <Card className="rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Apoio ao Hóspede</span>
              <p className="text-xs font-bold text-stone-800 dark:text-stone-200">Serviço de Quarto</p>
              <p className="text-[11px] text-stone-500">Toalhas, comodidades ou dúvidas</p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="h-9 text-xs rounded-xl border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold shrink-0"
          >
            <a
              href={`https://wa.me/${hotel.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá receção, estou no ${room.name} e preciso de apoio:`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Falar no WhatsApp
            </a>
          </Button>
        </Card>

        {/* Extrato da Estadia & Pedidos Efetuados (Visível com PIN desbloqueado) */}
        {isUnlocked && stay && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#C58A2C]" />
                <h3 className="font-extrabold text-sm text-[#251D18] dark:text-[#F5EFEB]">
                  A Sua Conta & Pedidos
                </h3>
              </div>
              <span className="text-[11px] font-bold text-stone-500 font-mono">
                {pricing ? formatCurrency(pricing.estimatedTotalWithPending) : formatCurrency(stay.contractedHours * stay.ratePerHour)}
              </span>
            </div>

            {/* Resumo da Conta e Total Geral Previsto */}
            <Card className="rounded-3xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
                  <span>Acomodação (horas contratadas e tempo em uso)</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 font-mono">
                    {formatCurrency(pricing?.roomTotal ?? stay.contractedHours * stay.ratePerHour)}
                  </span>
                </div>

                {stay.consumptions && stay.consumptions.length > 0 && (
                  <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Consumos de Bar Confirmados
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                      {formatCurrency(pricing?.consumptionsTotal ?? 0)}
                    </span>
                  </div>
                )}

                {pricing && (pricing.amountPaid ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-stone-600 dark:text-stone-300">
                    <span>Já pago</span>
                    <span className="font-bold text-stone-900 dark:text-stone-100 font-mono">- {formatCurrency(pricing.amountPaid ?? 0)}</span>
                  </div>
                )}

                {pricing && pricing.pendingOrdersTotal > 0 && (
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200/80 dark:border-amber-900/60 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Hourglass className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                      Pedidos a aguardar receção (Pendentes)
                    </span>
                    <span className="font-black font-mono">
                      + {formatCurrency(pricing.pendingOrdersTotal)}
                    </span>
                  </div>
                )}
              </div>

              {/* Total Geral Final a Pagar */}
              <div className="pt-3 border-t border-[#F2ECE1] dark:border-[#2C3440] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
                    Falta pagar no Check-out
                  </span>
                  <span className="text-[11px] text-stone-500">
                    {pricing && pricing.pendingOrdersTotal > 0
                      ? '* Inclui pedidos pendentes em validação'
                      : 'Valor atualizado sem surpresas na saída'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-[#C58A2C] dark:text-[#E88C4A] font-mono tracking-tight">
                    {formatCurrency(pricing ? Math.max(0, pricing.estimatedTotalWithPending - (pricing.amountPaid ?? 0)) : stay.contractedHours * stay.ratePerHour)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Pedidos Pendentes Efetuados via QR Code */}
            {orders.filter((o) => o.status === 'pending').length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <Hourglass className="w-4 h-4 text-amber-600" />
                    Pedidos de Bar a Aguardar Confirmação ({orders.filter((o) => o.status === 'pending').length})
                  </span>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300 text-[10px] font-bold">
                    Pendente
                  </Badge>
                </div>
                <div className="space-y-2">
                  {orders
                    .filter((o) => o.status === 'pending')
                    .map((ord) => (
                      <div key={ord.id} className="bg-white/80 dark:bg-black/20 p-2.5 rounded-xl border border-amber-200/60 text-xs space-y-1">
                        <div className="flex items-center justify-between font-semibold text-stone-800 dark:text-stone-200">
                          <span className="font-mono text-[11px]">Pedido #{ord.id.slice(-5).toUpperCase()}</span>
                          <span className="font-black text-[#C58A2C] font-mono">{formatCurrency(ord.total)}</span>
                        </div>
                        <div className="text-[11px] text-stone-600 dark:text-stone-300 space-y-0.5">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{it.quantity}× {it.productName}</span>
                              <span className="font-mono">{formatCurrency(it.totalPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Consumos Confirmados na Conta */}
            {stay.consumptions && stay.consumptions.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Consumos Confirmados na Conta ({stay.consumptions.length})
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-300 text-[10px] font-bold">
                    Lançados na Fatura
                  </Badge>
                </div>
                <div className="bg-white/80 dark:bg-black/20 p-2.5 rounded-xl border border-emerald-200/60 text-xs space-y-1.5">
                  {stay.consumptions.map((c, idx) => (
                    <div key={c.id || idx} className="flex items-center justify-between text-[11px] text-stone-700 dark:text-stone-300">
                      <span>{c.quantity}× {c.productName}</span>
                      <span className="font-bold text-stone-900 dark:text-stone-100 font-mono">
                        {formatCurrency(c.totalPrice)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800 flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                    <span>Subtotal Consumos</span>
                    <span className="font-mono">{formatCurrency(pricing?.consumptionsTotal ?? 0)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Pedidos Recusados (Informativo, nada cobrado) */}
            {orders.filter((o) => o.status === 'rejected').length > 0 && (
              <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 text-xs space-y-1">
                <span className="flex items-center gap-1.5 font-bold text-stone-700 dark:text-stone-300">
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  Pedidos Não Atendidos (Nada Cobrado)
                </span>
                {orders
                  .filter((o) => o.status === 'rejected')
                  .map((ord) => (
                    <p key={ord.id} className="text-[11px] text-stone-500 dark:text-stone-400">
                      • Pedido Nº {ord.id.slice(-5).toUpperCase()}: {ord.rejectReason || 'Sem disponibilidade no stock da receção'}.
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Menu do Restaurante & Bar (Pedidos Rápidos) */}
        {barProducts && barProducts.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#C58A2C]" />
                <h3 className="font-bold text-sm text-[#251D18] dark:text-[#F5EFEB]">
                  Restaurante & Bar do Quarto
                </h3>
              </div>
              <span className="text-[11px] text-stone-500 font-medium">Serviço de quarto</span>
            </div>

            {/* Filtros de Categoria */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setMenuFilter('all')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all shrink-0",
                  menuFilter === 'all'
                    ? "bg-[#C58A2C] text-white shadow-xs"
                    : "bg-[#F4EFEA] dark:bg-[#25201B] text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                )}
              >
                Tudo
              </button>
              <button
                type="button"
                onClick={() => setMenuFilter('kitchen')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all shrink-0 flex items-center gap-1",
                  menuFilter === 'kitchen'
                    ? "bg-[#C58A2C] text-white shadow-xs"
                    : "bg-[#F4EFEA] dark:bg-[#25201B] text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                )}
              >
                🍽️ Pratos & Refeições
              </button>
              <button
                type="button"
                onClick={() => setMenuFilter('bar')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all shrink-0 flex items-center gap-1",
                  menuFilter === 'bar'
                    ? "bg-[#C58A2C] text-white shadow-xs"
                    : "bg-[#F4EFEA] dark:bg-[#25201B] text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                )}
              >
                🍷 Bebidas & Bar
              </button>
              <button
                type="button"
                onClick={() => setMenuFilter('snacks')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full transition-all shrink-0 flex items-center gap-1",
                  menuFilter === 'snacks'
                    ? "bg-[#C58A2C] text-white shadow-xs"
                    : "bg-[#F4EFEA] dark:bg-[#25201B] text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                )}
              >
                🍿 Petiscos & Snacks
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredBarProducts.map((p) => {
                const qty = cart[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-[#FFFDF9] dark:bg-[#191E25] flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="font-bold text-xs text-[#251D18] dark:text-[#F5EFEB] truncate">
                          {p.name}
                        </p>
                        {p.isDish && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shrink-0">
                            Cozinha
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-extrabold text-[#C58A2C] dark:text-[#E88C4A]">
                        {formatCurrency(p.price)}{p.soldByWeight ? ' / kg' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {qty > 0 && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeFromCart(p.id)}
                            className="h-7 w-7 rounded-lg text-stone-600 hover:bg-stone-100 dark:hover:bg-stone-800"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                          <span className="text-xs font-extrabold min-w-5 text-center">{p.soldByWeight ? `${String(qty).replace('.', ',')} kg` : qty}</span>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => addToCart(p.id)}
                        className="h-7 w-7 rounded-lg border-[#E5DFD6] dark:border-[#2C3440] text-stone-700 dark:text-stone-300 hover:bg-[#FDF6E8] dark:hover:bg-[#2A2118]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredBarProducts.length === 0 && (
              <p className="text-center py-6 text-xs text-stone-500 italic">
                Nenhum item nesta secção de momento.
              </p>
            )}
          </div>
        )}
      </main>

      {/* Barra Flutuante de Pedido do Bar (quando há itens no carrinho) */}
      {cartTotal > 0 && (
        <aside aria-label="Resumo do pedido" className="fixed bottom-4 left-0 right-0 max-w-md mx-auto px-4 z-40">
          <div className="bg-[#251D18] dark:bg-[#0A0D10] text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-[#44382F] animate-in slide-in-from-bottom-3">
            <div>
              <span className="text-[11px] text-stone-300 block">Total do Pedido:</span>
              <span className="text-lg font-black text-[#F6E0B5]">{formatCurrency(cartTotal)}</span>
            </div>
            <Button
              onClick={() => {
                if (data?.pinRequired) {
                  setOrderError(null);
                  setConfirmOpen(true);
                } else {
                  sendBarOrderWhatsApp();
                }
              }}
              className="h-10 text-xs font-bold rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20ba5a] hover:to-[#0f7569] text-white shadow-md flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {data?.pinRequired ? 'Rever pedido' : 'Pedir via WhatsApp'}
            </Button>
          </div>
        </aside>
      )}

      {/* Confirmação do pedido antes de enviar */}
      {confirmOpen && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar pedido" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-3xl bg-[#FFFDF9] dark:bg-[#191E25] border border-[#E5DFD6] dark:border-[#2C3440] shadow-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 shrink-0">
              <h3 className="font-extrabold text-base text-[#251D18] dark:text-[#F5EFEB]">Confirmar pedido</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                A receção vai levar o pedido ao quarto. O valor entra na conta da sua estadia depois de a receção o confirmar.
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-2 space-y-2">
              {cartLines.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-[#251D18] dark:text-[#F5EFEB]">{l.kg ? `${String(l.qty).replace('.', ',')} kg` : `${l.qty}×`} {l.name}</span>
                  <span className="shrink-0 font-bold text-[#C58A2C] dark:text-[#E88C4A]">{formatCurrency(Math.round(l.price * l.qty * 100) / 100)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#E5DFD6] dark:border-[#2C3440]">
                <span className="text-sm font-bold">Total</span>
                <span className="text-lg font-black text-[#251D18] dark:text-[#F5EFEB]">{formatCurrency(cartTotal)}</span>
              </div>
              <div className="pt-2">
                <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block mb-1">
                  Observações para a cozinha / bar (opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Bem passado, sem cebola, copos com gelo..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] text-[#251D18] dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#C58A2C]"
                />
              </div>
              {orderError && <p className="text-xs font-semibold text-rose-600">{orderError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 px-5 py-4 shrink-0 border-t border-[#E5DFD6] dark:border-[#2C3440]">
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={sendingOrder} className="h-11 rounded-xl text-sm font-semibold">
                Voltar
              </Button>
              <Button type="button" onClick={submitOrder} disabled={sendingOrder} className="h-11 rounded-xl text-sm font-bold bg-[#251D18] hover:bg-[#3A2D25] text-white">
                {sendingOrder ? 'A enviar...' : 'Confirmar e enviar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pedido enviado (pendente até a receção confirmar) */}
      {orderSent && (
        <div role="dialog" aria-modal="true" aria-label="Pedido enviado" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-md rounded-3xl bg-[#FFFDF9] dark:bg-[#191E25] border border-[#E5DFD6] dark:border-[#2C3440] shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-base text-[#251D18] dark:text-[#F5EFEB]">Pedido enviado à receção</h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Fica pendente até a receção o confirmar. Nº {orderSent.id.slice(-5).toUpperCase()} · {formatCurrency(orderSent.total)}.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button
                type="button"
                onClick={() => openBarWhatsApp(orderSent.lines, orderSent.total, orderSent.id)}
                className="h-11 rounded-xl text-sm font-bold bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Avisar também no WhatsApp
              </Button>
              <Button type="button" variant="outline" onClick={() => setOrderSent(null)} className="h-11 rounded-xl text-sm font-semibold">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé Discreto */}
      <footer className="mt-auto py-4 text-center text-[11px] text-stone-400 border-t border-[#E5DFD6] dark:border-[#2C3440]">
        Powered by MajorStay Hospitality · Painel Privado do Hóspede
      </footer>
    </div>
  );
}

export default function QuartoPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFFDF9] dark:bg-[#111418] flex items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FDF6E8] dark:bg-[#1F2630] border border-[#F6E0B5] dark:border-[#2C3440] flex items-center justify-center text-[#C58A2C] animate-pulse">
            <Hotel className="w-6 h-6" />
          </div>
        </div>
      }
    >
      <QuartoPortalContent />
    </Suspense>
  );
}
