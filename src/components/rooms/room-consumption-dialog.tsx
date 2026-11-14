'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wine,
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Printer,
  ShoppingBag,
  ConciergeBell,
  Settings,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { buildStayReceipt, printReceipt } from '@/lib/thermal-receipt';
import { normalizeDate, calculateStayPricing, totalContractedHours } from '@/lib/hospitality-calc';
import type { Stay, Room, HospitalityService } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { useInventory } from '@/context/inventory-context';
import { toast } from '@/hooks/use-toast';
import { ServicesManagerDialog } from './services-manager-dialog';

interface RoomConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
  stay: Stay | null;
}

// Catálogo pré-configurado de bar/conveniência caso o utilizador ainda não tenha stock cadastrado
const DEFAULT_HOSPITALITY_ITEMS = [
  { name: 'Cerveja 2M (330ml)', category: 'Cervejas', price: 80 },
  { name: 'Laurentina Preta (330ml)', category: 'Cervejas', price: 90 },
  { name: 'Heineken (330ml)', category: 'Cervejas', price: 120 },
  { name: 'Água Mineral Namaacha (500ml)', category: 'Águas & Sumos', price: 40 },
  { name: 'Água com Gás (500ml)', category: 'Águas & Sumos', price: 50 },
  { name: 'Coca-Cola (330ml lata)', category: 'Refrigerantes', price: 60 },
  { name: 'Fanta Laranja (330ml lata)', category: 'Refrigerantes', price: 60 },
  { name: 'Red Bull Energy Drink (250ml)', category: 'Energéticos', price: 150 },
  { name: 'Whisky Jameson (Dose)', category: 'Espirituosas', price: 200 },
  { name: 'Gin Gordons (Dose)', category: 'Espirituosas', price: 180 },
  { name: 'Porção de Chamuças (4 un)', category: 'Petiscos', price: 150 },
  { name: 'Batata Frita com Asinhas', category: 'Petiscos', price: 350 },
  { name: 'Preservativos Prudence (Pack 3)', category: 'Conveniência', price: 100 },
  { name: 'Aluguer de Toalha Extra', category: 'Serviços', price: 50 },
  { name: 'Saco de Gelo (2 kg)', category: 'Bar', price: 60 },
];

export function RoomConsumptionDialog({
  open,
  onOpenChange,
  room,
  stay,
}: RoomConsumptionDialogProps) {
  const { addStayConsumption, removeStayConsumption, services = [], servicesLoading } = useRooms();
  const { products, companyData, user } = useInventory();
  const isManager = user?.role === 'Admin' || user?.role === 'Dono';

  const [activeTab, setActiveTab] = useState<'add' | 'services' | 'tab'>('add');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Gestão de Serviços
  const [servicesManagerOpen, setServicesManagerOpen] = useState(false);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>('all');
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  const [serviceNotes, setServiceNotes] = useState<Record<string, string>>({});

  // Formulário personalizado
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState<number>(100);
  const [customQuantity, setCustomQuantity] = useState<number>(1);

  // Quantidades temporárias para cada produto
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Unir produtos cadastrados no inventário com itens típicos de bar
  const availableItems = useMemo(() => {
    if (products && products.length > 0) {
      return products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category || 'Geral',
        price: p.price || 0,
        stock: p.stock ?? null,
        soldByWeight: Boolean(p.soldByWeight),
      }));
    }
    return DEFAULT_HOSPITALITY_ITEMS.map((item, idx) => ({
      id: `default-${idx}`,
      name: item.name,
      category: item.category,
      price: item.price,
      stock: null,
      soldByWeight: false,
    }));
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set(availableItems.map((i) => i.category));
    return ['all', ...Array.from(set)];
  }, [availableItems]);

  const filteredItems = useMemo(() => {
    return availableItems.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [availableItems, selectedCategory, searchTerm]);

  const consumptions = stay?.consumptions || [];
  const consumptionsTotal = consumptions.reduce((sum, c) => sum + (Number(c.totalPrice) || 0), 0);

  // Pratos vendidos ao peso: a "quantidade" são quilos (passos de 0,5). Nos restantes, unidades.
  const getQuantity = (id: string, weighed = false) => quantities[id] || (weighed ? 0.5 : 1);
  const setQuantity = (id: string, qty: number, weighed = false) => {
    const min = weighed ? 0.5 : 1;
    setQuantities((prev) => ({ ...prev, [id]: Math.max(min, Math.round(qty * 1000) / 1000) }));
  };

  const handleAddConsumption = async (item: { id?: string; name: string; price: number; soldByWeight?: boolean }) => {
    if (!stay) return;
    const weighed = Boolean(item.soldByWeight);
    const qty = getQuantity(item.id || item.name, weighed);
    try {
      setLoading(true);
      await addStayConsumption(stay.id, {
        productId: item.id?.startsWith('default-') ? undefined : item.id,
        productName: item.name,
        quantity: weighed ? 1 : qty,
        unitPrice: item.price,
        ...(weighed ? { weightKg: qty } : {}),
      });
      // Reset da quantidade selecionada
      setQuantities((prev) => ({ ...prev, [item.id || item.name]: weighed ? 0.5 : 1 }));
    } catch (err: any) {
      console.error('Erro ao adicionar consumo:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao registar consumo',
        description: err.message || 'Falha ao lançar na conta do quarto.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Quantidades e notas para Serviços
  const getServiceQuantity = (id: string) => serviceQuantities[id] || 1;
  const setServiceQuantity = (id: string, qty: number) => {
    setServiceQuantities((prev) => ({ ...prev, [id]: Math.max(1, Math.round(qty)) }));
  };

  const serviceCategories = useMemo(() => {
    const set = new Set(services.map((s) => s.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (selectedServiceCategory !== 'all' && s.category !== selectedServiceCategory) return false;
      if (serviceSearchTerm.trim()) {
        const q = serviceSearchTerm.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.category && s.category.toLowerCase().includes(q)) ||
          (s.description && s.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [services, selectedServiceCategory, serviceSearchTerm]);

  const handleAddServiceConsumption = async (service: HospitalityService) => {
    if (!stay) return;
    const qty = getServiceQuantity(service.id);
    const notes = serviceNotes[service.id];
    try {
      setLoading(true);
      await addStayConsumption(stay.id, {
        serviceId: service.id,
        isService: true,
        productName: service.name,
        quantity: qty,
        unitPrice: service.price,
        notes: notes?.trim() || undefined,
      });
      setServiceQuantities((prev) => ({ ...prev, [service.id]: 1 }));
      setServiceNotes((prev) => {
        const next = { ...prev };
        delete next[service.id];
        return next;
      });
    } catch (err: any) {
      console.error('Erro ao adicionar serviço:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao registar serviço',
        description: err.message || 'Falha ao lançar na conta do quarto.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Conta provisória (sem valor de recibo) para o hóspede conferir antes de pagar
  const handlePrintTab = () => {
    if (!stay) return;
    const rate = stay.ratePerHourApplied || room?.ratePerHour || 0;
    const now = new Date();
    const pricing = calculateStayPricing({
      checkInAt: normalizeDate(stay.checkInAt),
      checkOutAt: now,
      contractedHours: totalContractedHours(stay),
      ratePerHour: rate,
      graceMinutes: 10,
      consumptions: stay.consumptions || [],
      packagePrice: stay.packagePrice,
      packageHours: stay.packageHours,
    });
    const ok = printReceipt(
      buildStayReceipt({
        hotel: companyData?.name || 'Alojamento',
        roomName: stay.roomName || room?.name || 'Quarto',
        clientName: stay.clientName,
        vehiclePlate: stay.vehiclePlate,
        vehicleBrand: stay.vehicleBrand,
        vehicleModel: stay.vehicleModel,
        vehicleColor: stay.vehicleColor,
        checkIn: normalizeDate(stay.checkInAt),
        stayLabel: stay.packagePrice ? `Pacote ${stay.packageHours || pricing.billedHours}h` : `${pricing.billedHours}h de estadia`,
        stayAmount: pricing.stayAmountDue,
        consumptions: stay.consumptions || [],
        total: pricing.totalAmountDue,
        paid: Number(stay.totalAmountPaid) || 0,
        final: false,
        operator: user?.username,
      })
    );
    if (!ok) toast({ variant: 'destructive', title: 'Não foi possível imprimir' });
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stay) return;
    if (!customName.trim()) {
      toast({ variant: 'destructive', title: 'Indique a descrição do item' });
      return;
    }
    if (customPrice <= 0) {
      toast({ variant: 'destructive', title: 'O valor deve ser superior a zero' });
      return;
    }

    try {
      setLoading(true);
      await addStayConsumption(stay.id, {
        productName: customName.trim(),
        quantity: Math.max(1, customQuantity),
        unitPrice: customPrice,
      });
      setCustomName('');
      setCustomQuantity(1);
    } catch (err: any) {
      console.error('Erro ao lançar consumo personalizado:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (consumptionId: string) => {
    if (!stay) return;
    const reason = window.prompt('Motivo da remoção do consumo (obrigatório para auditoria):');
    if (!reason || !reason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Motivo obrigatório',
        description: 'É necessário indicar o motivo para remover um item da comanda.',
      });
      return;
    }
    try {
      setLoading(true);
      await removeStayConsumption(stay.id, consumptionId, reason.trim());
    } catch (err: unknown) {
      console.error('Erro ao remover consumo:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover consumo',
        description: err instanceof Error ? err.message : 'Falha ao remover item da comanda.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!stay) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] sm:max-w-xl overflow-hidden p-0 rounded-3xl border border-blue-100/90 dark:border-slate-800 bg-white dark:bg-[#191E25] text-slate-800 dark:text-slate-100 shadow-2xl">
        {/* Top Fresh Pastel Accent Gradient */}
        <div className="h-2 w-full bg-gradient-to-r from-[#0091da] via-[#38bdf8] to-[#fd761a] shrink-0" />

        <DialogHeader className="px-6 sm:px-7 pt-4 sm:pt-5 pb-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#cce5ff] via-[#e0f2fe] to-[#ffdbca] dark:from-blue-950 dark:via-sky-950 dark:to-orange-950 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-[#007bb9] dark:text-sky-300 shadow-sm shrink-0">
                <Wine className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Bar & Consumos
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  {stay.roomName || room?.name} • Bebidas, petiscos e comodidades
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#007bb9] dark:text-sky-300 border border-blue-200/60 dark:border-blue-800/50 shrink-0">
              {stay.clientName || 'Hóspede Particular'}
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid grid-cols-3 mb-4 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl h-11">
              <TabsTrigger
                value="add"
                className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-[#191E25] data-[state=active]:text-[#007bb9] dark:data-[state=active]:text-sky-300 data-[state=active]:shadow-sm"
              >
                <Wine className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bar &amp; Stock</span>
                <span className="sm:hidden">Bar</span>
              </TabsTrigger>
              <TabsTrigger
                value="services"
                className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-[#191E25] data-[state=active]:text-[#007bb9] dark:data-[state=active]:text-sky-300 data-[state=active]:shadow-sm"
              >
                <ConciergeBell className="h-3.5 w-3.5 text-amber-500" />
                <span>Serviços</span>
                {services.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold ml-0.5">
                    {services.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="tab"
                className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-[#191E25] data-[state=active]:text-[#007bb9] dark:data-[state=active]:text-sky-300 data-[state=active]:shadow-sm"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Comanda</span>
                <span>({consumptions.length})</span>
                {consumptionsTotal > 0 && (
                  <span className="ml-0.5 text-emerald-600 dark:text-emerald-400 font-extrabold hidden md:inline">
                    ({formatCurrency(consumptionsTotal)})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: ADICIONAR PRODUTOS */}
            <TabsContent value="add" className="space-y-3.5 m-0">
              {/* Barra de pesquisa */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#827568] pointer-events-none" />
                <Input
                  placeholder="Pesquisar bebidas, petiscos, água..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 text-base sm:text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
                />
              </div>

              {/* Categorias */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`h-7 text-xs px-3 rounded-full shrink-0 font-medium transition-all ${
                        active
                          ? 'bg-[#C58A2C] text-white shadow-sm'
                          : 'border border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] text-[#5C5346] dark:text-[#D4C8B8] hover:bg-[#F2ECE1] dark:hover:bg-[#2A211B]'
                      }`}
                    >
                      {cat === 'all' ? 'Todos' : cat}
                    </button>
                  );
                })}
              </div>

              {/* Lista de Produtos do Bar */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredItems.map((item) => {
                  const weighed = item.soldByWeight;
                  const step = weighed ? 0.5 : 1;
                  const qty = getQuantity(item.id || item.name, weighed);
                  const itemTotal = Math.round(qty * item.price * 100) / 100;
                  return (
                    <div
                      key={item.id || item.name}
                      className="p-3 rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] flex items-center justify-between gap-3 hover:border-[#C58A2C]/40 transition-colors shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-xs text-[#251D18] dark:text-[#F5EFEB] truncate">
                            {item.name}
                          </p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F2ECE1] dark:bg-[#2A211B] text-[#5C5346] dark:text-[#D4C8B8] font-medium shrink-0">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs font-extrabold text-[#C58A2C] dark:text-[#E88C4A] mt-0.5">
                          {formatCurrency(item.price)}{weighed ? ' / kg' : ''}
                          {(item as any).isDish ? (
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 ml-1.5 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              🍽️ Prato {(item as any).rawQuantityPerPortion ? (() => {
                                const ing = products?.find((x) => x.id === (item as any).rawIngredientId);
                                const q = (item as any).rawQuantityPerPortion as number;
                                const asKg = !ing || (ing.unit || 'kg').toLowerCase().startsWith('k');
                                return `(${asKg ? `${Math.round(q * 1000)}g` : `${q} un`} ${(item as any).rawIngredientName || 'alimento'})`;
                              })() : ''}
                            </span>
                          ) : item.stock !== null && (
                            <span className="text-[10px] font-normal text-[#827568] dark:text-[#B0A294] ml-1.5">
                              (disp: {item.stock})
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Seletor de Quantidade e Botão Adicionar */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-[#E5DFD6] dark:border-[#2C3440] rounded-xl overflow-hidden bg-[#FAF7F2] dark:bg-[#261E1A]">
                          <button
                            type="button"
                            className="p-1.5 px-2 hover:bg-[#F2ECE1] dark:hover:bg-[#34241B] text-[#5C5346] dark:text-[#D4C8B8] transition-colors"
                            onClick={() => setQuantity(item.id || item.name, qty - step, weighed)}
                            disabled={qty <= step}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold px-2.5 text-[#251D18] dark:text-[#F5EFEB]">
                            {weighed ? `${String(qty).replace('.', ',')} kg` : qty}
                          </span>
                          <button
                            type="button"
                            className="p-1.5 px-2 hover:bg-[#F2ECE1] dark:hover:bg-[#34241B] text-[#5C5346] dark:text-[#D4C8B8] transition-colors"
                            onClick={() => setQuantity(item.id || item.name, qty + step, weighed)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <Button
                          size="sm"
                          className="h-9 px-3 text-xs font-bold rounded-xl bg-gradient-to-r from-[#C58A2C] to-[#C86A2B] hover:from-[#A87019] hover:to-[#B55E22] text-white shadow-sm gap-1"
                          onClick={() => handleAddConsumption(item)}
                          disabled={loading}
                        >
                          <Plus className="h-3 w-3" />
                          Lançar ({formatCurrency(itemTotal)})
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lançamento Rápido Personalizado */}
              <div className="p-3.5 bg-[#F8F5EE] dark:bg-[#261E1A] rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] space-y-2">
                <p className="text-xs font-bold text-[#251D18] dark:text-[#F5EFEB] flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-[#DF9E42]" />
                  Outro Item / Lançamento Manual na Conta
                </p>
                <form onSubmit={handleAddCustom} className="grid grid-cols-12 gap-2">
                  <Input
                    placeholder="Descrição (ex: Porção Batata, Gelo...)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="col-span-5 h-9 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(Number(e.target.value))}
                    className="col-span-2 h-9 text-xs text-center rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Valor MT"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(Number(e.target.value))}
                    className="col-span-3 h-9 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="col-span-2 h-9 text-xs font-bold rounded-xl bg-[#251D18] dark:bg-[#F5EFEB] text-white dark:text-[#251D18] hover:bg-[#3D2E25]"
                    disabled={loading || !customName.trim()}
                  >
                    Adicionar
                  </Button>
                </form>
              </div>
            </TabsContent>

            {/* ABA 2: SERVIÇOS DO ALOJAMENTO */}
            <TabsContent value="services" className="space-y-3.5 m-0">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#827568] pointer-events-none" />
                  <Input
                    placeholder="Pesquisar serviços (lavandaria, massagem, transfer, etc.)..."
                    value={serviceSearchTerm}
                    onChange={(e) => setServiceSearchTerm(e.target.value)}
                    className="pl-10 h-10 text-base sm:text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#007bb9]"
                  />
                </div>
                {isManager && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setServicesManagerOpen(true)}
                    className="h-10 text-xs font-bold rounded-xl border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 text-[#007bb9] dark:text-sky-300 hover:bg-blue-100 gap-1.5 shrink-0"
                    title="Adicionar ou editar catálogo de serviços"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Gerir</span> Serviços
                  </Button>
                )}
              </div>

              {/* Categorias de Serviços */}
              {serviceCategories.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  {serviceCategories.map((cat) => {
                    const active = selectedServiceCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedServiceCategory(cat)}
                        className={`h-7 text-xs px-3 rounded-full shrink-0 font-medium transition-all ${
                          active
                            ? 'bg-[#007bb9] text-white shadow-sm'
                            : 'border border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] text-[#5C5346] dark:text-[#D4C8B8] hover:bg-[#F2ECE1] dark:hover:bg-[#2A211B]'
                        }`}
                      >
                        {cat === 'all' ? 'Todos' : cat}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Lista de Serviços */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {servicesLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    A carregar catálogo de serviços...
                  </div>
                ) : filteredServices.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                    <ConciergeBell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Nenhum serviço disponível com estes filtros.
                    </p>
                    {isManager && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setServicesManagerOpen(true)}
                        className="h-8 text-xs font-bold rounded-xl bg-[#007bb9] text-white"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Cadastrar Serviços
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredServices.map((service) => {
                    const qty = getServiceQuantity(service.id);
                    const itemTotal = qty * service.price;
                    const notes = serviceNotes[service.id] || '';
                    return (
                      <div
                        key={service.id}
                        className="p-3 rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] flex flex-col gap-2 hover:border-[#007bb9]/40 transition-colors shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-xs text-[#251D18] dark:text-[#F5EFEB] truncate">
                                {service.name}
                              </p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#007bb9] dark:text-sky-300 font-bold shrink-0 border border-blue-100 dark:border-blue-900">
                                {service.category || 'Geral'}
                              </span>
                            </div>
                            <p className="text-xs font-extrabold text-[#007bb9] dark:text-sky-300 mt-0.5">
                              {formatCurrency(service.price)}
                              {service.description && (
                                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 ml-2">
                                  • {service.description}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Seletor de Quantidade e Botão Lançar */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center border border-[#E5DFD6] dark:border-[#2C3440] rounded-xl overflow-hidden bg-[#FAF7F2] dark:bg-[#261E1A]">
                              <button
                                type="button"
                                className="p-1.5 px-2 hover:bg-[#F2ECE1] dark:hover:bg-[#34241B] text-[#5C5346] dark:text-[#D4C8B8] transition-colors"
                                onClick={() => setServiceQuantity(service.id, qty - 1)}
                                disabled={qty <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-xs font-bold px-2.5 text-[#251D18] dark:text-[#F5EFEB]">
                                {qty}
                              </span>
                              <button
                                type="button"
                                className="p-1.5 px-2 hover:bg-[#F2ECE1] dark:hover:bg-[#34241B] text-[#5C5346] dark:text-[#D4C8B8] transition-colors"
                                onClick={() => setServiceQuantity(service.id, qty + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            <Button
                              size="sm"
                              className="h-9 px-3 text-xs font-bold rounded-xl bg-gradient-to-r from-[#007bb9] to-[#0091da] hover:from-[#006194] hover:to-[#007bb9] text-white shadow-sm gap-1"
                              onClick={() => handleAddServiceConsumption(service)}
                              disabled={loading}
                            >
                              <Plus className="h-3 w-3" />
                              Lançar ({formatCurrency(itemTotal)})
                            </Button>
                          </div>
                        </div>

                        {/* Campo de Notas Opcional */}
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                          <Input
                            placeholder="Nota opcional para este serviço (ex: 2 camisas azuis, massagem às 16h)..."
                            value={notes}
                            onChange={(e) =>
                              setServiceNotes((prev) => ({
                                ...prev,
                                [service.id]: e.target.value,
                              }))
                            }
                            className="h-7 text-[11px] rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* ABA 3: COMANDA DO QUARTO */}
            <TabsContent value="tab" className="space-y-3 m-0">
              <Button type="button" variant="outline" size="sm" onClick={handlePrintTab} className="w-full h-10 rounded-xl text-xs font-bold gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                Imprimir conta (térmica)
              </Button>
              {consumptions.length === 0 ? (
                <div className="text-center py-10 text-[#827568] dark:text-[#B0A294] text-xs">
                  <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30 text-[#C58A2C]" />
                  <p className="font-semibold">Nenhum consumo ou produto lançado nesta estadia ainda.</p>
                  <p className="text-[11px] mt-1 text-[#A69B93]">Use a aba "Lançar do Bar" para adicionar itens à conta do hóspede.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {consumptions.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-2xl border border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] flex items-center justify-between text-xs shadow-sm"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-[#251D18] dark:text-[#F5EFEB]">
                            {c.weightKg ? `${String(c.weightKg).replace('.', ',')} kg de` : `${c.quantity}×`} {c.productName}
                          </p>
                          {(c.isService || c.serviceId) && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#007bb9] dark:text-sky-300 border border-blue-200 dark:border-blue-800">
                              🛎️ Serviço
                            </span>
                          )}
                        </div>
                        {c.notes && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium italic mt-0.5">
                            Nota: {c.notes}
                          </p>
                        )}
                        {c.rawDeduction && (
                          <p className="text-[10px] text-sky-700 dark:text-sky-400 font-medium mt-0.5">
                            🍽️ Matéria-prima: -{c.rawDeduction.quantityDeducted} {c.rawDeduction.unit} de {c.rawDeduction.ingredientName}
                          </p>
                        )}
                        <p className="text-[11px] text-[#827568] dark:text-[#B0A294] mt-0.5">
                          {formatCurrency(c.unitPrice)} cada • Lançado por {c.addedByName || 'Recepção'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-sm text-[#C58A2C] dark:text-[#E88C4A]">
                          {formatCurrency(c.totalPrice)}
                        </span>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-[#C53030] hover:bg-[#FDF0EE] dark:hover:bg-[#3A1E1E] transition-colors"
                          onClick={() => handleRemove(c.id)}
                          disabled={loading}
                          title="Remover item da comanda"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totalizador da Comanda */}
              <div className="p-4 bg-[#FDF6E8]/80 dark:bg-[#1E242D] rounded-2xl border border-[#F6E0B5] dark:border-[#4A382C] space-y-1">
                <div className="flex justify-between items-center text-xs text-[#827568] dark:text-[#B0A294]">
                  <span>Subtotal Consumos do Bar ({consumptions.length} {consumptions.length === 1 ? 'item' : 'itens'}):</span>
                  <span className="font-extrabold text-base text-[#C58A2C] dark:text-[#E88C4A]">
                    {formatCurrency(consumptionsTotal)}
                  </span>
                </div>
                <p className="text-[11px] text-[#827568] dark:text-[#B0A294]">
                  Este valor será somado automaticamente ao tempo da estadia no momento do Check-out.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 sm:px-7 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0 flex justify-end">
          <Button
            type="button"
            className="w-full sm:w-auto h-11 px-7 rounded-full font-extrabold bg-[#007bb9] hover:bg-[#006194] text-white shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            onClick={() => onOpenChange(false)}
          >
            Concluir Lançamentos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ServicesManagerDialog
      open={servicesManagerOpen}
      onOpenChange={setServicesManagerOpen}
    />
    </>
  );
}
