'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  ConciergeBell,
  BedDouble,
  Search,
  Plus,
  Edit2,
  Trash2,
  Tag,
  CheckCircle2,
  Clock,
  Shirt,
  ChevronRight,
  Receipt,
  Layers,
  ArrowRight,
  Filter,
  Gamepad2,
  Waves,
  Coins,
  Banknote,
  Ticket,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatCurrency, cn } from '@/lib/utils';
import { useRooms } from '@/context/rooms-context';
import { useInventory } from '@/context/inventory-context';
import { toast } from '@/hooks/use-toast';
import type { HospitalityService, Room, Stay } from '@/lib/types';
import {
  ServicesManagerDialog,
  SERVICE_CATEGORIES,
} from '@/components/rooms/services-manager-dialog';
import { buildServiceSaleReceipt, printReceipt } from '@/lib/thermal-receipt';

const PAYMENT_OPTIONS = [
  { id: 'Numerário', label: '💵 Numerário (Dinheiro em mão)' },
  { id: 'M-Pesa', label: '📱 M-Pesa (Vodacom)' },
  { id: 'e-Mola', label: '📱 e-Mola (Movitel)' },
  { id: 'POS / Cartão', label: '💳 POS / Cartão Bancário' },
  { id: 'Transferência', label: '🏦 Transferência Bancária' },
] as const;

function getCategoryConfig(category?: string) {
  const cat = category || 'Geral';
  if (cat.includes('Bilhar') || cat.includes('Jogo') || cat.includes('Diversõ')) {
    return {
      label: cat,
      icon: Gamepad2,
      badgeClass:
        'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/50',
    };
  }
  if (cat.includes('Piscina') || cat.includes('Lazer')) {
    return {
      label: cat,
      icon: Waves,
      badgeClass:
        'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border-cyan-200/70 dark:border-cyan-800/50',
    };
  }
  if (cat.includes('Lavandaria')) {
    return {
      label: cat,
      icon: Shirt,
      badgeClass:
        'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-800/50',
    };
  }
  return {
    label: cat,
    icon: Tag,
    badgeClass:
      'bg-blue-50 dark:bg-blue-950/60 text-[#007bb9] dark:text-sky-300 border-blue-200/60 dark:border-blue-800/40',
  };
}

function ServicesPageContent() {
  const router = useRouter();
  const {
    services = [],
    servicesLoading,
    rooms = [],
    openStays = [],
    addStayConsumption,
    deleteService,
  } = useRooms();
  const { user, companyData, addSale } = useInventory();
  const isManager = user?.role === 'Admin' || user?.role === 'Dono';

  // Estados de Filtro e Pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'price-asc' | 'price-desc' | 'name'>('recent');

  // Modais
  const [servicesManagerOpen, setServicesManagerOpen] = useState(false);
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
  const [selectedServiceToLaunch, setSelectedServiceToLaunch] = useState<HospitalityService | null>(null);

  // Modal de Venda Direta / Balcão
  const [directSaleDialogOpen, setDirectSaleDialogOpen] = useState(false);
  const [selectedServiceForDirectSale, setSelectedServiceForDirectSale] = useState<HospitalityService | null>(null);
  const [directSaleQuantity, setDirectSaleQuantity] = useState<number>(1);
  const [directSalePaymentMethod, setDirectSalePaymentMethod] = useState<string>('Numerário');
  const [directSaleClientName, setDirectSaleClientName] = useState<string>('');
  const [directSaleNotes, setDirectSaleNotes] = useState<string>('');
  const [printTicketOnSale, setPrintTicketOnSale] = useState<boolean>(true);
  const [submittingDirectSale, setSubmittingDirectSale] = useState(false);

  // Formulário de Lançamento no Quarto
  const [targetStayId, setTargetStayId] = useState<string>('');
  const [launchQuantity, setLaunchQuantity] = useState<number>(1);
  const [launchNotes, setLaunchNotes] = useState<string>('');
  const [submittingLaunch, setSubmittingLaunch] = useState(false);

  // Quartos com estadia aberta
  const occupiedStays = useMemo(() => {
    return openStays.filter((s) => s.status === 'open' && s.roomId);
  }, [openStays]);

  // Categorias disponíveis
  const categoryPills = useMemo(() => {
    const set = new Set(services.map((s) => s.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [services]);

  // Filtragem e Ordenação
  const filteredServices = useMemo(() => {
    return services
      .filter((s) => {
        if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          return (
            s.name.toLowerCase().includes(q) ||
            (s.category && s.category.toLowerCase().includes(q)) ||
            (s.description && s.description.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0; // recent (default)
      });
  }, [services, selectedCategory, searchTerm, sortBy]);

  // Estatísticas
  const averagePrice = useMemo(() => {
    if (services.length === 0) return 0;
    const sum = services.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    return Math.round(sum / services.length);
  }, [services]);

  // Abertura do modal de lançamento no quarto
  const handleOpenLaunch = (service?: HospitalityService) => {
    if (service) {
      setSelectedServiceToLaunch(service);
    } else if (services.length > 0) {
      setSelectedServiceToLaunch(services[0]);
    }
    setLaunchQuantity(1);
    setLaunchNotes('');
    if (occupiedStays.length > 0 && !targetStayId) {
      setTargetStayId(occupiedStays[0].id);
    }
    setLaunchDialogOpen(true);
  };

  // Abertura do modal de cobrança direta no balcão
  const handleOpenDirectSale = (service?: HospitalityService) => {
    if (service) {
      setSelectedServiceForDirectSale(service);
    } else if (services.length > 0) {
      setSelectedServiceForDirectSale(services[0]);
    }
    setDirectSaleQuantity(1);
    setDirectSalePaymentMethod('Numerário');
    setDirectSaleClientName('');
    setDirectSaleNotes('');
    setPrintTicketOnSale(true);
    setDirectSaleDialogOpen(true);
  };

  const handleConfirmLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceToLaunch) {
      toast({ variant: 'destructive', title: 'Selecione um serviço' });
      return;
    }
    if (!targetStayId) {
      toast({
        variant: 'destructive',
        title: 'Selecione um quarto ocupado',
        description: 'É necessário escolher o quarto para lançar o serviço na conta.',
      });
      return;
    }

    const targetStay = openStays.find((s) => s.id === targetStayId);
    if (!targetStay) {
      toast({ variant: 'destructive', title: 'Estadia não encontrada' });
      return;
    }

    try {
      setSubmittingLaunch(true);
      await addStayConsumption(targetStay.id, {
        serviceId: selectedServiceToLaunch.id,
        isService: true,
        productName: selectedServiceToLaunch.name,
        quantity: Math.max(1, launchQuantity),
        unitPrice: selectedServiceToLaunch.price,
        notes: launchNotes.trim() || undefined,
      });

      toast({
        title: 'Serviço lançado na conta!',
        description: `${launchQuantity}× ${selectedServiceToLaunch.name} para o ${targetStay.roomName || 'Quarto'} (${formatCurrency(launchQuantity * selectedServiceToLaunch.price)})`,
      });
      setLaunchDialogOpen(false);
    } catch (err: any) {
      console.error('Erro ao lançar serviço:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao lançar serviço',
        description: err.message || 'Falha ao lançar na conta.',
      });
    } finally {
      setSubmittingLaunch(false);
    }
  };

  const handleConfirmDirectSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceForDirectSale) {
      toast({ variant: 'destructive', title: 'Selecione um serviço para cobrar' });
      return;
    }
    const qty = Math.max(1, Number(directSaleQuantity) || 1);
    const unitPrice = Number(selectedServiceForDirectSale.price) || 0;
    const total = qty * unitPrice;
    const client = directSaleClientName.trim() || 'Cliente Balcão / Lounge';

    try {
      setSubmittingDirectSale(true);

      const salePayload: any = {
        date: new Date().toISOString(),
        productId: selectedServiceForDirectSale.id,
        productName: selectedServiceForDirectSale.name,
        quantity: qty,
        unit: 'un',
        unitPrice: unitPrice,
        unitCost: 0,
        subtotal: total,
        totalValue: total,
        amountPaid: total,
        soldBy: user?.username || 'Recepção / Balcão',
        status: 'Pago' as const,
        documentType: 'Venda a Dinheiro' as const,
        clientName: client,
        paymentMethod: directSalePaymentMethod,
        notes: directSaleNotes.trim()
          ? `[Serviço/Diversão] ${directSaleNotes.trim()}`
          : `[Serviço/Diversão] Cat: ${selectedServiceForDirectSale.category || 'Geral'}`,
      };

      // reserveStock = false para não tentar debitar inventário de produtos físicos
      await addSale(salePayload, false);

      if (printTicketOnSale) {
        try {
          printReceipt(
            buildServiceSaleReceipt({
              hotel: companyData?.name || 'MajorStay Hospitality',
              serviceName: selectedServiceForDirectSale.name,
              category: selectedServiceForDirectSale.category,
              quantity: qty,
              unitPrice: unitPrice,
              totalPrice: total,
              paymentMethod: directSalePaymentMethod,
              clientName: client,
              date: new Date(),
              operator: user?.username || 'Operador',
              notes: directSaleNotes.trim() || undefined,
            })
          );
        } catch (printErr) {
          console.warn('Falha na impressão automática do talão:', printErr);
        }
      }

      toast({
        title: 'Cobrança registada com sucesso!',
        description: `${qty}× ${selectedServiceForDirectSale.name} — ${formatCurrency(total)} recebidos por ${directSalePaymentMethod}.`,
      });

      setDirectSaleDialogOpen(false);
    } catch (err: any) {
      console.error('Erro ao registar cobrança avulsa:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao registar cobrança',
        description: err?.message || 'Falha ao processar pagamento.',
      });
    } finally {
      setSubmittingDirectSale(false);
    }
  };

  const handleDeleteService = async (service: HospitalityService) => {
    if (!window.confirm(`Tem a certeza que deseja eliminar o serviço "${service.name}"?`)) {
      return;
    }
    try {
      await deleteService(service.id);
      toast({ title: 'Serviço eliminado com sucesso' });
    } catch (err: any) {
      console.error('Erro ao eliminar serviço:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao eliminar',
        description: err.message || 'Falha ao apagar serviço.',
      });
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      {/* Cabeçalho Responsivo da Página */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#cce5ff] via-[#e0f2fe] to-[#ffdbca] dark:from-blue-950 dark:via-sky-950 dark:to-orange-950 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-[#007bb9] dark:text-sky-300 shadow-sm shrink-0">
              <ConciergeBell className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                  Serviços, Bilhares & Diversões
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                >
                  Sem Limites no seu Plano
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                Catálogo de bilhares, fichas de jogos, piscina, lavandaria, massagens e extras. Lance no quarto ou cobre direto no balcão.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/rooms')}
            className="h-10 text-xs gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold px-4 shadow-xs active:scale-95 transition-all"
          >
            <BedDouble className="h-3.5 w-3.5 text-[#007bb9]" />
            Quadro de Quartos
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenDirectSale()}
            className="h-10 text-xs gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 shadow-sm active:scale-95 transition-all"
          >
            <Coins className="h-3.5 w-3.5" />
            Cobrar no Balcão (Avulso)
          </Button>

          {occupiedStays.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenLaunch()}
              className="h-10 text-xs gap-1.5 rounded-full border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 text-[#007bb9] dark:text-sky-300 hover:bg-blue-100 font-bold px-4 shadow-xs active:scale-95 transition-all"
            >
              <Receipt className="h-3.5 w-3.5 text-[#007bb9]" />
              Lançar num Quarto
            </Button>
          )}

          {isManager && (
            <Button
              size="sm"
              onClick={() => setServicesManagerOpen(true)}
              className="h-10 text-xs gap-2 bg-[#007bb9] hover:bg-[#006194] text-white font-extrabold rounded-full px-5 shadow-sm active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              Novo Serviço
            </Button>
          )}
        </div>
      </div>

      {/* Cartões de Indicadores / Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] shadow-card min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#007bb9] dark:text-sky-300 border border-blue-200/60 dark:border-blue-800/50 flex items-center justify-center shrink-0">
              <ConciergeBell className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">
                Serviços Ativos
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {services.length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] shadow-card min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">
                Categorias
              </p>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {Math.max(1, categoryPills.length - 1)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] shadow-card min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50 flex items-center justify-center shrink-0">
              <BedDouble className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">
                Quartos Ocupados
              </p>
              <p className="text-2xl font-black text-amber-700 dark:text-amber-300">
                {occupiedStays.length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] shadow-card min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/50 flex items-center justify-center shrink-0">
              <Tag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">
                Preço Médio
              </p>
              <p className="text-2xl font-black text-purple-700 dark:text-purple-300 truncate">
                {formatCurrency(averagePrice)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div className="p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] shadow-card space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Pesquisar por nome, bilhar, ficha, preço ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9.5 h-10 text-xs rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus-visible:ring-[#007bb9]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-10 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="recent">Mais Recentes</option>
              <option value="name">Nome (A - Z)</option>
              <option value="price-asc">Menor Preço</option>
              <option value="price-desc">Maior Preço</option>
            </select>
          </div>
        </div>

        {/* Pílulas de Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categoryPills.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count =
              cat === 'all'
                ? services.length
                : services.filter((s) => s.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer',
                  isSelected
                    ? 'bg-[#007bb9] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                )}
              >
                {cat === 'all' ? 'Todas as Categorias' : cat}
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-black',
                    isSelected
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Serviços em Grelha */}
      {servicesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#191E25] animate-pulse p-5 space-y-3"
            >
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-24" />
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-full w-3/4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-[#191E25]/50 space-y-3">
          <div className="w-14 h-14 rounded-3xl bg-blue-50 dark:bg-blue-950 text-[#007bb9] flex items-center justify-center mx-auto">
            <ConciergeBell className="h-7 w-7" />
          </div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            Nenhum serviço encontrado
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchTerm || selectedCategory !== 'all'
              ? 'Nenhum serviço corresponde aos filtros atuais. Tente ajustar a busca ou categoria.'
              : 'Cadastre os serviços e diversões oferecidos (Fichas de bilhar, jogos, piscina, lavandaria, massagem, transfers, etc.).'}
          </p>
          {isManager && (
            <Button
              size="sm"
              onClick={() => setServicesManagerOpen(true)}
              className="h-10 text-xs font-bold rounded-full bg-[#007bb9] text-white px-5 mt-2 shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Adicionar Primeiro Serviço
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => {
            const catConfig = getCategoryConfig(service.category);
            const CatIcon = catConfig.icon;

            return (
              <Card
                key={service.id}
                className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] shadow-card hover:shadow-soft-hover transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 shrink-0',
                        catConfig.badgeClass
                      )}
                    >
                      <CatIcon className="h-3 w-3" />
                      {service.category || 'Geral'}
                    </span>
                    <p className="text-base font-black text-[#007bb9] dark:text-sky-300">
                      {formatCurrency(service.price)}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-[#007bb9] transition-colors">
                      {service.name}
                    </h3>
                    {service.description ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {service.description}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-1">Sem descrição adicional.</p>
                    )}
                  </div>
                </div>

                {/* Rodapé do Cartão */}
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleOpenDirectSale(service)}
                      className="h-8 text-[11px] font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-2xs"
                      title="Cobrar este serviço diretamente ao cliente no balcão/lounge (sem necessidade de quarto)"
                    >
                      <Coins className="h-3 w-3" />
                      Cobrar no Balcão
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenLaunch(service)}
                      disabled={occupiedStays.length === 0}
                      title={
                        occupiedStays.length === 0
                          ? 'Nenhum quarto ocupado no momento'
                          : 'Lançar este serviço na conta de um quarto'
                      }
                      className="h-8 text-[11px] font-bold rounded-xl border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 text-[#007bb9] dark:text-sky-300 hover:bg-blue-50 gap-1 shadow-2xs"
                    >
                      <Receipt className="h-3 w-3" />
                      No Quarto
                    </Button>
                  </div>

                  {isManager && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setServicesManagerOpen(true)}
                        className="h-8 w-8 text-slate-400 hover:text-[#007bb9] rounded-xl"
                        title="Editar catálogo"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteService(service)}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                        title="Eliminar serviço"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Gestão Completa de Serviços */}
      <ServicesManagerDialog
        open={servicesManagerOpen}
        onOpenChange={setServicesManagerOpen}
      />

      {/* Modal de Cobrança no Balcão / Venda Avulsa (Sem Quarto) */}
      <Dialog open={directSaleDialogOpen} onOpenChange={setDirectSaleDialogOpen}>
        <DialogContent className="flex flex-col max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] sm:max-w-md overflow-hidden p-0 rounded-3xl border border-emerald-100/90 dark:border-slate-800 bg-white dark:bg-[#191E25] text-slate-800 dark:text-slate-100 shadow-2xl">
          <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#0091da] shrink-0" />

          <DialogHeader className="px-6 sm:px-7 pt-4 sm:pt-5 pb-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">
                  Cobrar no Balcão (Venda Avulsa)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Para clientes avulsos, bilhar, diversões e visitantes sem quarto
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleConfirmDirectSale} className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
            {/* Seleção do Serviço */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Serviço / Diversão a Cobrar
              </Label>
              <select
                value={selectedServiceForDirectSale?.id || ''}
                onChange={(e) => {
                  const s = services.find((x) => x.id === e.target.value);
                  if (s) setSelectedServiceForDirectSale(s);
                }}
                className="w-full h-10 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 font-semibold text-slate-800 dark:text-slate-100"
              >
                {services.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name} — {formatCurrency(srv.price)} ({srv.category || 'Geral'})
                  </option>
                ))}
              </select>
            </div>

            {/* Quantidade e Valor Unitário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Quantidade / Fichas
                </Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setDirectSaleQuantity((q) => Math.max(1, q - 1))}
                    className="h-10 w-10 rounded-xl"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={directSaleQuantity}
                    onChange={(e) => setDirectSaleQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-10 text-xs text-center font-bold rounded-xl"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setDirectSaleQuantity((q) => q + 1)}
                    className="h-10 w-10 rounded-xl"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Preço Unitário
                </Label>
                <div className="h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center font-black text-slate-900 dark:text-white text-xs">
                  {formatCurrency(selectedServiceForDirectSale?.price || 0)}
                </div>
              </div>
            </div>

            {/* Total a Receber */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Total a Receber no Balcão
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {directSaleQuantity} × {formatCurrency(selectedServiceForDirectSale?.price || 0)}
                </p>
              </div>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                {formatCurrency((selectedServiceForDirectSale?.price || 0) * directSaleQuantity)}
              </p>
            </div>

            {/* Método de Pagamento */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Forma de Pagamento <span className="text-rose-500">*</span>
              </Label>
              <select
                value={directSalePaymentMethod}
                onChange={(e) => setDirectSalePaymentMethod(e.target.value)}
                className="w-full h-10 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 font-semibold text-slate-800 dark:text-slate-100"
                required
              >
                {PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Nome do Cliente (Opcional) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nome do Cliente / Identificação (Opcional)
              </Label>
              <Input
                placeholder="Ex: João (Mesa 2), Visitante Piscina..."
                value={directSaleClientName}
                onChange={(e) => setDirectSaleClientName(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Observações (Opcional)
              </Label>
              <Input
                placeholder="Ex: Salão de jogos, taco extra, ficha entregue..."
                value={directSaleNotes}
                onChange={(e) => setDirectSaleNotes(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            {/* Checkbox Impressão de Talão Térmico */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="printTicketCheck"
                checked={printTicketOnSale}
                onChange={(e) => setPrintTicketOnSale(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <Label htmlFor="printTicketCheck" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer flex items-center gap-1.5">
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                Imprimir comprovativo / talão térmico automaticamente
              </Label>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDirectSaleDialogOpen(false)}
                disabled={submittingDirectSale}
                className="h-10 text-xs rounded-full font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingDirectSale || !selectedServiceForDirectSale}
                className="h-10 text-xs font-extrabold rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-5 gap-1.5 shadow-sm"
              >
                {submittingDirectSale ? (
                  'A registar...'
                ) : (
                  <>
                    <Coins className="h-4 w-4" />
                    Confirmar Cobrança ({formatCurrency((selectedServiceForDirectSale?.price || 0) * directSaleQuantity)})
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Lançamento no Quarto */}
      <Dialog open={launchDialogOpen} onOpenChange={setLaunchDialogOpen}>
        <DialogContent className="flex flex-col max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] sm:max-w-md overflow-hidden p-0 rounded-3xl border border-blue-100/90 dark:border-slate-800 bg-white dark:bg-[#191E25] text-slate-800 dark:text-slate-100 shadow-2xl">
          <div className="h-2 w-full bg-gradient-to-r from-[#0091da] via-[#38bdf8] to-[#fd761a] shrink-0" />

          <DialogHeader className="px-6 sm:px-7 pt-4 sm:pt-5 pb-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950 text-[#007bb9] border border-blue-200/60 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-white">
                  Lançar Serviço na Comanda
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Adicione o serviço diretamente à conta do quarto ocupado
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleConfirmLaunch} className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
            {/* Serviço Selecionado */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Serviço de Alojamento
              </Label>
              <select
                value={selectedServiceToLaunch?.id || ''}
                onChange={(e) => {
                  const s = services.find((x) => x.id === e.target.value);
                  if (s) setSelectedServiceToLaunch(s);
                }}
                className="w-full h-10 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 font-semibold text-slate-800 dark:text-slate-100"
              >
                {services.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name} — {formatCurrency(srv.price)} ({srv.category || 'Geral'})
                  </option>
                ))}
              </select>
            </div>

            {/* Quarto Alvo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Quarto com Estadia Aberta <span className="text-rose-500">*</span>
              </Label>
              {occupiedStays.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                  Nenhum quarto ocupado no momento. Use o botão <strong>&quot;Cobrar no Balcão&quot;</strong> para clientes avulsos ou diversões.
                </div>
              ) : (
                <select
                  value={targetStayId}
                  onChange={(e) => setTargetStayId(e.target.value)}
                  className="w-full h-10 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 font-semibold text-slate-800 dark:text-slate-100"
                  required
                >
                  {occupiedStays.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.roomName || 'Quarto'} • {s.clientName || 'Hóspede Particular'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Quantidade e Valor Unitário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Quantidade
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={launchQuantity}
                  onChange={(e) => setLaunchQuantity(Math.max(1, Number(e.target.value)))}
                  className="h-10 text-xs text-center font-bold rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Total a Cobrar
                </Label>
                <div className="h-10 px-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-center font-extrabold text-sm text-[#007bb9] dark:text-sky-300">
                  {formatCurrency((selectedServiceToLaunch?.price || 0) * launchQuantity)}
                </div>
              </div>
            </div>

            {/* Notas Opcionais */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Observações / Detalhes (Opcional)
              </Label>
              <Input
                placeholder="Ex: 2 camisas azuis e 1 calça preta, entregar às 18h..."
                value={launchNotes}
                onChange={(e) => setLaunchNotes(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLaunchDialogOpen(false)}
                className="h-10 text-xs rounded-full font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingLaunch || occupiedStays.length === 0}
                className="h-10 px-6 text-xs font-extrabold rounded-full bg-[#007bb9] hover:bg-[#006194] text-white shadow-sm"
              >
                {submittingLaunch ? 'A lançar...' : 'Confirmar Lançamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <ServicesPageContent />
    </Suspense>
  );
}
