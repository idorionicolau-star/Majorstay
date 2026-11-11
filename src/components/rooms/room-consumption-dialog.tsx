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
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Stay, Room } from '@/lib/types';
import { useRooms } from '@/context/rooms-context';
import { useInventory } from '@/context/inventory-context';
import { toast } from '@/hooks/use-toast';

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
  const { addStayConsumption, removeStayConsumption } = useRooms();
  const { products } = useInventory();

  const [activeTab, setActiveTab] = useState<'add' | 'tab'>('add');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);

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
      }));
    }
    return DEFAULT_HOSPITALITY_ITEMS.map((item, idx) => ({
      id: `default-${idx}`,
      name: item.name,
      category: item.category,
      price: item.price,
      stock: null,
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

  const getQuantity = (id: string) => quantities[id] || 1;
  const setQuantity = (id: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, qty) }));
  };

  const handleAddConsumption = async (item: { id?: string; name: string; price: number }) => {
    if (!stay) return;
    const qty = getQuantity(item.id || item.name);
    try {
      setLoading(true);
      await addStayConsumption(stay.id, {
        productId: item.id?.startsWith('default-') ? undefined : item.id,
        productName: item.name,
        quantity: qty,
        unitPrice: item.price,
      });
      // Reset da quantidade selecionada
      setQuantities((prev) => ({ ...prev, [item.id || item.name]: 1 }));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-3xl border border-blue-100/90 dark:border-slate-800 bg-white dark:bg-[#191E25] text-slate-800 dark:text-slate-100 shadow-2xl">
        {/* Top Fresh Pastel Accent Gradient */}
        <div className="h-2 w-full bg-gradient-to-r from-[#0091da] via-[#38bdf8] to-[#fd761a]" />

        <DialogHeader className="px-7 pt-5 pb-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
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

        <div className="flex-1 overflow-y-auto p-5 pt-3">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid grid-cols-2 mb-4 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl h-11">
              <TabsTrigger
                value="add"
                className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-[#191E25] data-[state=active]:text-[#007bb9] dark:data-[state=active]:text-sky-300 data-[state=active]:shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Lançar do Bar / Stock
              </TabsTrigger>
              <TabsTrigger
                value="tab"
                className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-[#191E25] data-[state=active]:text-[#007bb9] dark:data-[state=active]:text-sky-300 data-[state=active]:shadow-sm"
              >
                <Receipt className="h-3.5 w-3.5" />
                Comanda ({consumptions.length})
                {consumptionsTotal > 0 && (
                  <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-extrabold">
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
                  className="pl-10 h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#2C3440] bg-white dark:bg-[#111418] focus-visible:ring-[#C58A2C]"
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
                  const qty = getQuantity(item.id || item.name);
                  const itemTotal = qty * item.price;
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
                          {formatCurrency(item.price)}
                          {item.stock !== null && (
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
                            onClick={() => setQuantity(item.id || item.name, qty - 1)}
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
                            onClick={() => setQuantity(item.id || item.name, qty + 1)}
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
                  <Sparkles className="h-3.5 w-3.5 text-[#DF9E42]" />
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

            {/* ABA 2: COMANDA DO QUARTO */}
            <TabsContent value="tab" className="space-y-3 m-0">
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
                        <p className="font-bold text-[#251D18] dark:text-[#F5EFEB]">
                          {c.quantity}× {c.productName}
                        </p>
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

        <DialogFooter className="px-7 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
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
  );
}
