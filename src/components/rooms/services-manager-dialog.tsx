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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ConciergeBell,
  Search,
  Plus,
  Edit2,
  Trash2,
  Tag,
  Check,
  X,
  Layers,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { HospitalityService } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { useInventory } from '@/context/inventory-context';
import { toast } from '@/hooks/use-toast';

interface ServicesManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SERVICE_CATEGORIES = [
  'Bilhares, Jogos & Diversões',
  'Lazer, Piscina & Bem-Estar',
  'Lavandaria & Roupa',
  'Bem-Estar & Spa',
  'Governança & Limpeza',
  'Transporte & Transfers',
  'Comodidades & Extras',
  'Restauração & Serviço de Quarto',
  'Outros Serviços',
] as const;

export function ServicesManagerDialog({ open, onOpenChange }: ServicesManagerDialogProps) {
  const { services, servicesLoading, addService, updateService, deleteService } = useRooms();
  const { user } = useInventory();
  const isManager = user?.role === 'Admin' || user?.role === 'Dono';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Campos do formulário
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(SERVICE_CATEGORIES[0]);
  const [price, setPrice] = useState<number>(150);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setCategory(SERVICE_CATEGORIES[0]);
    setPrice(150);
    setDescription('');
    setEditingServiceId(null);
    setShowAddForm(false);
  };

  const handleStartEdit = (service: HospitalityService) => {
    setName(service.name);
    setCategory(service.category || SERVICE_CATEGORIES[0]);
    setPrice(service.price);
    setDescription(service.description || '');
    setEditingServiceId(service.id);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Nome do serviço é obrigatório' });
      return;
    }
    if (price < 0 || isNaN(price)) {
      toast({ variant: 'destructive', title: 'Preço inválido' });
      return;
    }

    try {
      setSubmitting(true);
      if (editingServiceId) {
        await updateService(editingServiceId, {
          name: name.trim(),
          category: category.trim(),
          price: Number(price),
          description: description.trim(),
        });
      } else {
        await addService({
          name: name.trim(),
          category: category.trim(),
          price: Number(price),
          description: description.trim(),
          active: true,
        });
      }
      resetForm();
    } catch (err: any) {
      console.error('Erro ao guardar serviço:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao guardar serviço',
        description: err.message || 'Falha ao gravar.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (service: HospitalityService) => {
    if (!window.confirm(`Tem a certeza que deseja remover o serviço "${service.name}"?`)) {
      return;
    }
    try {
      await deleteService(service.id);
      toast({ title: 'Serviço removido' });
      if (editingServiceId === service.id) resetForm();
    } catch (err: any) {
      console.error('Erro ao remover serviço:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: err.message || 'Falha ao remover serviço.',
      });
    }
  };

  // Filtragem dos serviços
  const categoriesList = useMemo(() => {
    const set = new Set(services.map((s) => s.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
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
    });
  }, [services, selectedCategory, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[92dvh] w-full max-w-[calc(100vw-1.5rem)] sm:max-w-2xl overflow-hidden p-0 rounded-3xl border border-blue-100/90 dark:border-slate-800 bg-white dark:bg-[#191E25] text-slate-800 dark:text-slate-100 shadow-2xl">
        {/* Accent Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-[#0091da] via-[#38bdf8] to-[#fd761a] shrink-0" />

        <DialogHeader className="px-6 sm:px-7 pt-4 sm:pt-5 pb-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#cce5ff] via-[#e0f2fe] to-[#ffdbca] dark:from-blue-950 dark:via-sky-950 dark:to-orange-950 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-[#007bb9] dark:text-sky-300 shadow-sm shrink-0">
                <ConciergeBell className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  Serviços de Alojamento
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Ilimitados
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  {isManager
                    ? 'Adicione e personalize quantos serviços e preços desejar para a comanda dos quartos.'
                    : 'Catálogo de serviços disponíveis para lançamento nas contas das estadias.'}
                </p>
              </div>
            </div>

            {isManager && !showAddForm && (
              <Button
                size="sm"
                onClick={() => {
                  resetForm();
                  setShowAddForm(true);
                }}
                className="h-9 px-4 text-xs font-bold rounded-full bg-[#007bb9] hover:bg-[#006194] text-white shadow-sm gap-1.5 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Novo Serviço
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-4">
          {/* Formulário de Adicionar / Editar Serviço */}
          {showAddForm && (
            <div className="p-4 sm:p-5 rounded-2xl border-2 border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[#007bb9]" />
                  {editingServiceId ? 'Editar Serviço' : 'Registar Novo Serviço'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6 space-y-1">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nome do Serviço <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      placeholder="Ex: Lavandaria Completa, Massagem Relaxante..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-9 text-xs rounded-xl bg-white dark:bg-slate-900"
                      required
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Preço (MT) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Ex: 250"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="h-9 text-xs rounded-xl bg-white dark:bg-slate-900"
                      required
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Categoria
                    </Label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full h-9 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 font-medium text-slate-700 dark:text-slate-200"
                    >
                      {SERVICE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Descrição ou Regras (Opcional)
                  </Label>
                  <Input
                    placeholder="Ex: Por peça de roupa, entrega até 4 horas..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    className="h-8 text-xs font-medium rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting}
                    className="h-8 px-4 text-xs font-bold rounded-xl bg-[#007bb9] hover:bg-[#006194] text-white shadow-sm"
                  >
                    {submitting ? 'A gravar...' : editingServiceId ? 'Atualizar' : 'Guardar Serviço'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Filtros e Busca */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Pesquisar serviço (lavandaria, massagem, transfer, limpeza...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 text-xs rounded-2xl bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {categoriesList.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`h-7 text-xs px-3 rounded-full shrink-0 font-medium transition-all ${
                      active
                        ? 'bg-[#007bb9] text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat === 'all' ? 'Todos' : cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de Serviços */}
          {servicesLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium">
              A carregar serviços...
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <ConciergeBell className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-semibold">Nenhum serviço encontrado.</p>
              {isManager && (
                <p className="text-[11px] text-slate-400">
                  Clique em &quot;Novo Serviço&quot; acima para cadastrar os serviços do seu alojamento.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between gap-2.5 shadow-sm hover:border-blue-200 dark:hover:border-blue-800 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-[#007bb9] dark:text-sky-300 border border-blue-200/50 dark:border-blue-800/40 truncate">
                          {service.category || 'Geral'}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                        {service.name}
                      </h4>
                      {service.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {service.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-[#007bb9] dark:text-sky-300">
                        {formatCurrency(service.price)}
                      </p>
                    </div>
                  </div>

                  {isManager && (
                    <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(service)}
                        className="h-7 px-2.5 text-[11px] text-slate-600 dark:text-slate-300 hover:text-[#007bb9] rounded-lg gap-1"
                      >
                        <Edit2 className="h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(service)}
                        className="h-7 px-2.5 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 sm:px-7 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0 flex justify-end">
          <Button
            type="button"
            className="w-full sm:w-auto h-10 px-6 rounded-full font-bold bg-[#007bb9] hover:bg-[#006194] text-white shadow-sm"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
