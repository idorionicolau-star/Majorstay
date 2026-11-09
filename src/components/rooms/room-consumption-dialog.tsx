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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wine,
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  ShoppingCart,
  Sparkles,
  Check,
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
    try {
      setLoading(true);
      await removeStayConsumption(stay.id, consumptionId);
    } catch (err: any) {
      console.error('Erro ao remover consumo:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!stay) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Wine className="h-6 w-6 text-primary" />
              Bar & Consumos — {stay.roomName || room?.name}
            </DialogTitle>
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
              {stay.clientName || 'Hóspede Particular'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="add" className="text-xs font-semibold gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Lançar do Bar / Stock
              </TabsTrigger>
              <TabsTrigger value="tab" className="text-xs font-semibold gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                Comanda do Quarto ({consumptions.length})
                {consumptionsTotal > 0 && (
                  <span className="ml-1 text-emerald-600 font-bold">
                    ({formatCurrency(consumptionsTotal)})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: ADICIONAR PRODUTOS */}
            <TabsContent value="add" className="space-y-4 m-0">
              {/* Barra de pesquisa */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Pesquisar bebidas, petiscos, água..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Categorias */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    size="sm"
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    className="h-7 text-xs px-2.5 rounded-full shrink-0 font-medium"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === 'all' ? 'Todos' : cat}
                  </Button>
                ))}
              </div>

              {/* Lista de Produtos do Bar */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredItems.map((item) => {
                  const qty = getQuantity(item.id || item.name);
                  const itemTotal = qty * item.price;
                  return (
                    <div
                      key={item.id || item.name}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {item.name}
                          </p>
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                            {item.category}
                          </Badge>
                        </div>
                        <p className="text-xs font-bold text-primary mt-0.5">
                          {formatCurrency(item.price)}
                          {item.stock !== null && (
                            <span className="text-[10px] font-normal text-slate-400 ml-1.5">
                              (disp: {item.stock})
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Seletor de Quantidade e Botão Adicionar */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800">
                          <button
                            type="button"
                            className="p-1 px-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                            onClick={() => setQuantity(item.id || item.name, qty - 1)}
                            disabled={qty <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold px-2 text-slate-800 dark:text-slate-200">
                            {qty}
                          </span>
                          <button
                            type="button"
                            className="p-1 px-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                            onClick={() => setQuantity(item.id || item.name, qty + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <Button
                          size="sm"
                          className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
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
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Outro Item / Lançamento Manual:
                </p>
                <form onSubmit={handleAddCustom} className="grid grid-cols-12 gap-2">
                  <Input
                    placeholder="Descrição (ex: Porção Batata, Gelo...)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="col-span-5 h-8 text-xs"
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(Number(e.target.value))}
                    className="col-span-2 h-8 text-xs text-center"
                  />
                  <Input
                    type="number"
                    min="1"
                    step="10"
                    placeholder="Valor MT"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(Number(e.target.value))}
                    className="col-span-3 h-8 text-xs"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="col-span-2 h-8 text-xs font-semibold"
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
                <div className="text-center py-8 text-slate-400 text-xs">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhum consumo ou produto lançado nesta estadia ainda.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {consumptions.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">
                          {c.quantity}× {c.productName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatCurrency(c.unitPrice)} cada • Lançado por {c.addedByName || 'Recepção'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {formatCurrency(c.totalPrice)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleRemove(c.id)}
                          disabled={loading}
                          title="Remover item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totalizador da Comanda */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                  <span>Subtotal Consumos do Bar ({consumptions.length} itens):</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {formatCurrency(consumptionsTotal)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Este valor será somado automaticamente ao tempo da estadia no momento do Check-out.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
