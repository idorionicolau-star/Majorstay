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
  const { user } = useInventory();
  const isManager = user?.role === 'Admin' || user?.role === 'Dono';

  // Estados de Filtro e Pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'price-asc' | 'price-desc' | 'name'>('recent');

  // Modais
  const [servicesManagerOpen, setServicesManagerOpen] = useState(false);
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
  const [selectedServiceToLaunch, setSelectedServiceToLaunch] = useState<HospitalityService | null>(null);

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

  // Abertura do modal de lançamento rápido
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
                  Serviços de Alojamento
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                >
                  Sem Limites no seu Plano
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                Catálogo de comodidades, lavandaria, massagens, transfers e pedidos adicionais na comanda dos quartos.
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

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#191E25] p-3 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-soft-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Pesquisar por nome de serviço, descrição ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 text-xs rounded-2xl bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="h-10 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="recent">Mais Recentes</option>
            <option value="price-asc">Menor Preço</option>
            <option value="price-desc">Maior Preço</option>
            <option value="name">Nome (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Pílulas de Categorias */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {categoryPills.map((cat) => {
          const active = selectedCategory === cat;
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
                'h-8 text-xs px-3.5 rounded-full shrink-0 font-bold transition-all flex items-center gap-1.5',
                active
                  ? 'bg-[#007bb9] text-white shadow-sm'
                  : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <span>{cat === 'all' ? 'Todos os Serviços' : cat}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-extrabold',
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grelha de Serviços */}
      {servicesLoading ? (
        <div className="py-20 text-center text-slate-400 text-xs font-semibold">
          A carregar serviços do alojamento...
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-[#191E25] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <ConciergeBell className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
            Nenhum serviço encontrado
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchTerm || selectedCategory !== 'all'
              ? 'Nenhum serviço corresponde aos filtros atuais. Tente ajustar a busca ou categoria.'
              : 'Cadastre os serviços oferecidos aos hóspedes (Lavandaria, Passadoria, Massagem, Transfers, Toalha extra, etc.).'}
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
          {filteredServices.map((service) => (
            <Card
              key={service.id}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#191E25] shadow-card hover:shadow-soft-hover transition-all flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#007bb9] dark:text-sky-300 border border-blue-200/50 dark:border-blue-800/40">
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
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-2">
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
                  className="h-8 text-xs font-bold rounded-xl border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 text-[#007bb9] dark:text-sky-300 hover:bg-blue-50 gap-1.5 shadow-2xs"
                >
                  <Receipt className="h-3 w-3" />
                  Lançar no Quarto
                </Button>

                {isManager && (
                  <div className="flex items-center gap-1">
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
          ))}
        </div>
      )}

      {/* Modal de Gestão Completa de Serviços */}
      <ServicesManagerDialog
        open={servicesManagerOpen}
        onOpenChange={setServicesManagerOpen}
      />

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
                  Nenhum quarto ocupado no momento. Os serviços só podem ser lançados em estadias abertas.
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
