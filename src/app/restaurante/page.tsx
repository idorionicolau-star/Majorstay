"use client";

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { InventoryContext } from '@/context/inventory-context';
import { useRooms } from '@/context/rooms-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Utensils,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  RefreshCw,
  Scale,
  ChefHat,
  Search,
  PackagePlus,
  Trash2,
  Flame,
  Printer,
  Info,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';
import type { Product } from '@/lib/types';
import { buildKitchenTicket, printReceipt } from '@/lib/thermal-receipt';

interface RoomOrderDoc {
  id: string;
  stayId: string;
  roomId: string;
  roomName: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    weightKg?: number;
  }[];
  notes?: string;
  total: number;
  status: 'pending' | 'preparing' | 'confirmed' | 'rejected';
  source: 'guest' | 'reception' | 'pos';
  createdAt: string;
  preparingAt?: string;
  preparingByName?: string;
}

/** Unidade de um ingrediente: 'kg' (ao peso) ou 'un' (unidades, ex.: frango inteiro). */
const unitOf = (p?: Pick<Product, 'unit'> | null): 'kg' | 'un' => ((p?.unit || 'kg').toLowerCase().startsWith('k') ? 'kg' : 'un');
const num = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

export default function RestaurantePage() {
  const { products, companyId, user, addProduct, updateProduct, auditStock, companyData, canEdit } = useContext(InventoryContext) || {
    products: [],
    canEdit: () => false,
    companyData: null,
    companyId: null,
    user: null,
    addProduct: async () => {},
    updateProduct: async () => {},
    auditStock: async () => {},
  };
  const { stays } = useRooms();
  // Criar pratos/ingredientes e mexer no stock exige escrita no Inventário (a receção só vê)
  const canManageStock = Boolean(canEdit && canEdit('inventory'));

  const [activeTab, setActiveTab] = useState<'kds' | 'fridge' | 'menu'>('kds');
  const [orders, setOrders] = useState<RoomOrderDoc[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modais de Gestão de Kg
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Product | null>(null);
  const [entryQtyKg, setEntryQtyKg] = useState<number>(5);
  const [entryCostTotal, setEntryCostTotal] = useState<number>(0);

  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [lossQtyKg, setLossQtyKg] = useState<number>(0.5);
  const [lossReason, setLossReason] = useState<string>('Aparas / Limpeza da Carne');

  // Modal Novo Ingrediente Alimentar
  const [newIngredientOpen, setNewIngredientOpen] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngStockKg, setNewIngStockKg] = useState(10);
  const [newIngCostPerKg, setNewIngCostPerKg] = useState(350);
  const [newIngLocation, setNewIngLocation] = useState('Câmara Frigorífica');
  const [newIngUnit, setNewIngUnit] = useState<'kg' | 'un'>('kg');

  // Modal Novo Prato Confecionado
  const [newDishOpen, setNewDishOpen] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishPrice, setNewDishPrice] = useState(550);
  const [newDishRawId, setNewDishRawId] = useState('');
  const [newDishGrams, setNewDishGrams] = useState(300); // por dose: gramas (ingrediente em kg) ou unidades (ingrediente em un)
  const [newDishByWeight, setNewDishByWeight] = useState(false); // prato vendido ao peso (preço por kg)

  // 1. Carregar Pedidos Ativos da Cozinha (Pendentes e A Preparar)
  const fetchOrders = async () => {
    if (!companyId) return;
    try {
      setLoadingOrders(true);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const [resPending, resPrep] = await Promise.all([
        fetch(`/api/room-orders?companyId=${companyId}&status=pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/room-orders?companyId=${companyId}&status=preparing`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const dataPending = await resPending.json();
      const dataPrep = await resPrep.json();

      const combined = [...(dataPending.orders || []), ...(dataPrep.orders || [])].sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );

      setOrders(combined);
    } catch (e) {
      console.error('Erro ao carregar pedidos da cozinha:', e);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000); // Atualiza a cada 15 segundos
    return () => clearInterval(interval);
  }, [companyId]);

  const handlePrintTicket = (ord: RoomOrderDoc) => {
    const ok = printReceipt(
      buildKitchenTicket({
        hotel: companyData?.name || 'Cozinha',
        roomName: ord.roomName,
        createdAt: new Date(ord.createdAt),
        items: ord.items,
        notes: ord.notes,
        source: ord.source === 'guest' ? 'Hóspede (QR)' : 'Receção',
      })
    );
    if (!ok) toast({ variant: 'destructive', title: 'Não foi possível imprimir' });
  };

  // Ações de Pedidos (KDS)
  const handleStartPreparing = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/room-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId,
          orderId,
          action: 'preparing',
        }),
      });
      if (res.ok) {
        toast({ title: 'Pedido em confeção', description: 'O cozinheiro assumiu o preparo do pedido.' });
        fetchOrders();
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao iniciar preparo' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmAndDeliver = async (order: RoomOrderDoc) => {
    try {
      setActionLoading(order.id);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/stays/consumption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId,
          stayId: order.stayId,
          action: 'add',
          orderId: order.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Prato entregue com sucesso!',
          description: `Valor de ${formatCurrency(order.total)} lançado na conta do ${order.roomName}. Alimentos abatidos na arca.`,
        });
        fetchOrders();
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao confirmar pedido',
          description: data.error || 'Falha ao lançar consumo na conta do quarto.',
        });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao finalizar pedido' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const reason = window.prompt('Motivo da recusa (ex: Ingredientes esgotados):');
    if (!reason || !reason.trim()) return;

    try {
      setActionLoading(orderId);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/room-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId,
          orderId,
          action: 'reject',
          reason: reason.trim(),
        }),
      });
      if (res.ok) {
        toast({ title: 'Pedido recusado', description: 'O quarto foi notificado.' });
        fetchOrders();
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao recusar pedido' });
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Filtro de Alimentos e Matérias-Primas da Cozinha (Kg / Câmara fria)
  const rawIngredients = useMemo(() => {
    return products.filter((p) => {
      const u = (p.unit || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return (
        p.isKitchenIngredient ||
        u === 'kg' ||
        u === 'quilo' ||
        u === 'quilograma' ||
        cat.includes('cozinha') ||
        cat.includes('alimento') ||
        cat.includes('carne') ||
        cat.includes('peixe') ||
        cat.includes('frios')
      );
    });
  }, [products]);

  // 3. Filtro de Pratos Confecionados
  const dishes = useMemo(() => {
    return products.filter((p) => p.isDish || (p.category || '').toLowerCase().includes('prato'));
  }, [products]);

  // Executar Entrada de Compra em Kg
  const handleConfirmEntry = async () => {
    if (!selectedIngredient || entryQtyKg <= 0) return;
    try {
      const current = selectedIngredient.stock || 0;
      const nextStock = Math.round((current + entryQtyKg) * 1000) / 1000;
      if (auditStock) {
        await auditStock(selectedIngredient, nextStock, `Entrada de compra de alimentos (+${entryQtyKg} ${unitOf(selectedIngredient)})`);
      } else {
        await updateProduct(selectedIngredient.instanceId, { stock: nextStock });
      }
      toast({
        title: 'Entrada de compra registada',
        description: `Adicionados +${entryQtyKg} ${unitOf(selectedIngredient)} a "${selectedIngredient.name}".`,
      });
      setEntryModalOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao registar entrada' });
    }
  };

  // Executar Quebra/Desperdício em Kg
  const handleConfirmLoss = async () => {
    if (!selectedIngredient || lossQtyKg <= 0) return;
    try {
      const current = selectedIngredient.stock || 0;
      const nextStock = Math.max(0, Math.round((current - lossQtyKg) * 1000) / 1000);
      if (auditStock) {
        await auditStock(selectedIngredient, nextStock, `Quebra / Desperdício alimentar (-${lossQtyKg} ${unitOf(selectedIngredient)}): ${lossReason}`);
      } else {
        await updateProduct(selectedIngredient.instanceId, { stock: nextStock });
      }
      toast({
        title: 'Quebra registada com sucesso',
        description: `Abatidos -${lossQtyKg} ${unitOf(selectedIngredient)} de "${selectedIngredient.name}" por ${lossReason}.`,
      });
      setLossModalOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao registar quebra' });
    }
  };

  // Criar Novo Ingrediente Alimentar
  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName.trim()) return;
    try {
      await addProduct({
        name: newIngName.trim(),
        category: 'Cozinha / Alimentos',
        stock: newIngStockKg,
        price: 0,
        cost: newIngCostPerKg,
        unit: newIngUnit,
        lowStockThreshold: 3,
        criticalStockThreshold: 1,
        location: 'Principal',
        isKitchenIngredient: true,
      } as any);
      toast({ title: 'Ingrediente cadastrado', description: `${newIngName} criado com ${newIngStockKg} ${newIngUnit}.` });
      setNewIngName('');
      setNewIngredientOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao criar ingrediente' });
    }
  };

  // Criar Novo Prato Confecionado
  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName.trim()) return;
    const selectedIng = rawIngredients.find((r) => r.id === newDishRawId);
    const ingUnit = unitOf(selectedIng);
    // Por dose: gramas -> kg (ingrediente em kg) ou unidades (ingrediente em un). Ao peso: abate o peso servido.
    const perPortion = ingUnit === 'kg' ? newDishGrams / 1000 : newDishGrams;
    try {
      // O Firestore rejeita campos `undefined`: só se incluem os campos do ingrediente quando existe um.
      await addProduct({
        name: newDishName.trim(),
        category: 'Pratos Principais',
        price: newDishPrice,
        cost: selectedIng ? Math.round(((selectedIng.cost || 0) * (newDishByWeight ? 1 : perPortion)) * 100) / 100 : 0,
        unit: newDishByWeight ? 'kg' : 'dose',
        location: 'Principal',
        stock: 999, // Pratos confecionados não têm stock fixo na prateleira; consomem a carne
        lowStockThreshold: 0,
        criticalStockThreshold: 0,
        isDish: true,
        ...(newDishByWeight ? { soldByWeight: true, pricePerKg: newDishPrice } : {}),
        ...(selectedIng
          ? {
              rawIngredientId: selectedIng.id,
              rawIngredientName: selectedIng.name,
              ...(newDishByWeight ? {} : { rawQuantityPerPortion: perPortion }),
            }
          : {}),
      } as any);
      toast({
        title: 'Prato criado com sucesso',
        description: newDishByWeight
          ? `"${newDishName}" vende-se ao peso (${formatCurrency(newDishPrice)}/kg).`
          : `"${newDishName}" consome ${ingUnit === 'kg' ? `${newDishGrams}g` : `${num(newDishGrams)} un`} de ${selectedIng?.name || 'ingrediente'}.`,
      });
      setNewDishName('');
      setNewDishByWeight(false);
      setNewDishOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao criar prato' });
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-12 main-content max-w-7xl mx-auto w-full px-2 sm:px-4">
      {/* Cabeçalho Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#DF9E42]/20 via-amber-100 to-orange-100 dark:from-amber-950 dark:to-stone-900 border border-amber-200/80 dark:border-amber-800/40 flex items-center justify-center text-[#DF9E42] shadow-xs shrink-0">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Cozinha & Restaurante
              <Badge variant="outline" className="text-[10px] font-bold border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                MajorStay Kitchen
              </Badge>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Controlo de pedidos em tempo real, fichas técnicas e stock de alimentos em Quilos (Kg).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchOrders}
            disabled={loadingOrders}
            className="rounded-xl h-9 text-xs font-semibold gap-1.5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loadingOrders && 'animate-spin')} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={() => setNewDishOpen(true)}
            style={canManageStock ? undefined : { display: 'none' }}
            className="rounded-xl h-9 text-xs font-bold bg-[#007bb9] hover:bg-[#006295] text-white shadow-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Prato
          </Button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid grid-cols-3 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl h-12 max-w-lg">
          <TabsTrigger
            value="kds"
            className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-[#191E25] data-[state=active]:text-[#007bb9] dark:data-[state=active]:text-sky-300 data-[state=active]:shadow-xs"
          >
            <ChefHat className="h-4 w-4" />
            Pedidos ({orders.length})
          </TabsTrigger>
          <TabsTrigger
            value="fridge"
            className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-[#191E25] data-[state=active]:text-[#007bb9] dark:data-[state=active]:text-sky-300 data-[state=active]:shadow-xs"
          >
            <Scale className="h-4 w-4" />
            Alimentos (Kg)
          </TabsTrigger>
          <TabsTrigger
            value="menu"
            className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-[#191E25] data-[state=active]:text-[#007bb9] dark:data-[state=active]:text-sky-300 data-[state=active]:shadow-xs"
          >
            <Utensils className="h-4 w-4" />
            Pratos & Menu
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* ABA 1: ECRÃ DE PEDIDOS (KDS)                                  */}
        {/* ============================================================== */}
        <TabsContent value="kds" className="space-y-4 mt-4">
          {orders.length === 0 ? (
            <Card className="rounded-3xl border-dashed p-10 text-center">
              <ChefHat className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="font-extrabold text-base text-slate-700 dark:text-slate-200">Sem pedidos pendentes na cozinha</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Quando um hóspede pedir um prato ou bebida através do QR Code do quarto ou da receção, o pedido surge aqui em tempo real.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((ord) => {
                const isPrep = ord.status === 'preparing';
                return (
                  <Card
                    key={ord.id}
                    className={cn(
                      'rounded-3xl border transition-all shadow-sm overflow-hidden flex flex-col',
                      isPrep
                        ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#191E25]'
                    )}
                  >
                    <div className={cn('p-3.5 border-b flex items-center justify-between', isPrep ? 'bg-amber-100/60 dark:bg-amber-900/40' : 'bg-slate-50 dark:bg-slate-900/50')}>
                      <div>
                        <span className="font-black text-sm text-slate-900 dark:text-white block">
                          {ord.roomName}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(ord.createdAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <Badge
                        className={cn(
                          'text-[10px] font-black uppercase px-2 py-0.5',
                          isPrep
                            ? 'bg-amber-500 text-white'
                            : 'bg-sky-500 text-white animate-pulse'
                        )}
                      >
                        {isPrep ? 'A Preparar' : 'Pendente'}
                      </Badge>
                    </div>

                    <CardContent className="p-4 flex-1 space-y-3">
                      <div className="space-y-2">
                        {ord.items.map((it, idx) => (
                          <div key={idx} className="border-b border-slate-100 dark:border-slate-800 pb-2 last:border-none last:pb-0">
                            <div className="flex justify-between items-start text-xs">
                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                {it.quantity}× {it.productName}
                              </span>
                              <span className="font-extrabold text-[#C58A2C]">
                                {formatCurrency(it.totalPrice)}
                              </span>
                            </div>
                            {it.notes && (
                              <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium italic mt-0.5 bg-amber-100/60 dark:bg-amber-950/60 p-1 rounded-lg">
                                Obs: {it.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {ord.notes && (
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-300">
                          <strong className="block text-slate-900 dark:text-white font-bold">Nota Geral do Quarto:</strong>
                          {ord.notes}
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold">Total a Cobrar:</span>
                        <span className="text-base font-black text-slate-900 dark:text-white">
                          {formatCurrency(ord.total)}
                        </span>
                      </div>
                    </CardContent>

                    <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                      {!isPrep && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartPreparing(ord.id)}
                          disabled={actionLoading === ord.id}
                          className="flex-1 rounded-xl text-xs font-bold border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100/50"
                        >
                          <Flame className="w-3.5 h-3.5 mr-1 text-amber-500" />
                          Confeccionar
                        </Button>
                      )}

                      <Button
                        size="sm"
                        onClick={() => handleConfirmAndDeliver(ord)}
                        disabled={actionLoading === ord.id}
                        className="flex-1 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Pronto / Lançar
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePrintTicket(ord)}
                        className="h-9 w-9 p-0 rounded-xl shrink-0"
                        title="Imprimir senha da cozinha"
                      >
                        <Printer className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRejectOrder(ord.id)}
                        disabled={actionLoading === ord.id}
                        className="h-9 w-9 p-0 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 shrink-0"
                        title="Recusar pedido"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* ABA 2: BALANÇO DE ALIMENTOS EM QUILOS (Kg)                     */}
        {/* ============================================================== */}
        <TabsContent value="fridge" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FDFBF7] dark:bg-[#1A1D23] p-4 rounded-3xl border border-amber-200/60 dark:border-slate-800">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                Câmara Frigorífica & Despensa
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Controlo rigoroso de carnes, peixes e alimentos nobres medidos em Quilos (Kg).
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setNewIngredientOpen(true)}
            style={canManageStock ? undefined : { display: 'none' }}
              className="rounded-xl h-9 text-xs font-bold bg-[#DF9E42] hover:bg-[#C58A2C] text-white shadow-xs gap-1.5"
            >
              <PackagePlus className="w-4 h-4" />
              Novo Alimento / Carne em Kg
            </Button>
          </div>

          {rawIngredients.length === 0 ? (
            <Card className="rounded-3xl border-dashed p-10 text-center">
              <Scale className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="font-extrabold text-base text-slate-700 dark:text-slate-200">Sem alimentos em Kg cadastrados</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Adicione carnes (vaca, frango, porco), peixes ou camarão com unidade em "kg" para controlar as entradas de compras e saídas para os pratos.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rawIngredients.map((ing) => {
                const stockKg = Number(ing.stock) || 0;
                const isCritical = stockKg <= (ing.criticalStockThreshold || 2);
                return (
                  <Card key={ing.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                    <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {ing.name}
                        </CardTitle>
                        <CardDescription className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {ing.location || 'Câmara Frigorífica'}
                        </CardDescription>
                      </div>
                      <Badge
                        className={cn(
                          'text-xs font-black px-2.5 py-0.5',
                          isCritical
                            ? 'bg-rose-500 text-white'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        )}
                      >
                        {stockKg.toFixed(2)} {unitOf(ing)}
                      </Badge>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Custo Médio / {unitOf(ing)}:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {formatCurrency(ing.cost || 0)}/{unitOf(ing)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Valor na Arca:</span>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency((ing.cost || 0) * stockKg)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1" style={canManageStock ? undefined : { display: 'none' }}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedIngredient(ing);
                            setEntryModalOpen(true);
                          }}
                          className="rounded-xl h-9 text-xs font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Entrada ({unitOf(ing)})
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedIngredient(ing);
                            setLossModalOpen(true);
                          }}
                          className="rounded-xl h-9 text-xs font-bold border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 gap-1"
                        >
                          <Minus className="w-3.5 h-3.5" />
                          Quebra ({unitOf(ing)})
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* ABA 3: PRATOS & MENU DO RESTAURANTE                            */}
        {/* ============================================================== */}
        <TabsContent value="menu" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FDFBF7] dark:bg-[#1A1D23] p-4 rounded-3xl border border-amber-200/60 dark:border-slate-800">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-[#007bb9]" />
                Cardápio de Refeições do Hotel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pratos servidos aos hóspedes com ligação automática à dedução de carne/peixe em gramas/quilos.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setNewDishOpen(true)}
            style={canManageStock ? undefined : { display: 'none' }}
              className="rounded-xl h-9 text-xs font-bold bg-[#007bb9] hover:bg-[#006295] text-white shadow-xs gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Novo Prato no Cardápio
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dishes.map((d) => (
              <Card key={d.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white">{d.name}</h4>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{d.category || 'Pratos Principais'}</span>
                  </div>
                  <span className="text-sm font-black text-[#C58A2C]">
                    {formatCurrency(d.price)}{d.soldByWeight ? ' / kg' : ''}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Scale className="w-3.5 h-3.5 text-amber-600" />
                    <span>Dedução por Dose:</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    {d.soldByWeight
                      ? `Ao peso: abate o peso servido${d.rawIngredientName ? ` de ${d.rawIngredientName}` : ''}`
                      : d.rawQuantityPerPortion
                        ? unitOf(products.find((p) => p.id === d.rawIngredientId)) === 'kg'
                          ? `${Math.round(d.rawQuantityPerPortion * 1000)}g de ${d.rawIngredientName || 'Alimento Base'}`
                          : `${num(d.rawQuantityPerPortion)} un de ${d.rawIngredientName || 'Alimento Base'}`
                        : 'Sem dedução de carne vinculada'}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO: ENTRADA DE COMPRA EM KG */}
      <Dialog open={entryModalOpen} onOpenChange={setEntryModalOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-emerald-600" />
              Entrada de Compra: {selectedIngredient?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adicione os quilos comprados no fornecedor para reforçar o stock da cozinha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold block mb-1">Quantidade Comprada ({unitOf(selectedIngredient)}):</label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={entryQtyKg}
                onChange={(e) => setEntryQtyKg(Number(e.target.value))}
                className="rounded-xl h-10"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Custo Total da Compra (MT) - Opcional:</label>
              <Input
                type="number"
                min="0"
                value={entryCostTotal}
                onChange={(e) => setEntryCostTotal(Number(e.target.value))}
                className="rounded-xl h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryModalOpen(false)} className="rounded-xl text-xs">
              Cancelar
            </Button>
            <Button onClick={handleConfirmEntry} className="rounded-xl text-xs font-bold bg-emerald-600 text-white">
              Confirmar Entrada (+{entryQtyKg} {unitOf(selectedIngredient)})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: QUEBRA / DESPERDÍCIO EM KG */}
      <Dialog open={lossModalOpen} onOpenChange={setLossModalOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-600">
              <Minus className="w-5 h-5" />
              Registar Quebra: {selectedIngredient?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registe aparas, ossos descartados ou quebras de descongelamento para manter a balança exata.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold block mb-1">Quantidade Descartada / Perdida ({unitOf(selectedIngredient)}):</label>
              <Input
                type="number"
                step="0.05"
                min="0.05"
                value={lossQtyKg}
                onChange={(e) => setLossQtyKg(Number(e.target.value))}
                className="rounded-xl h-10"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Motivo do Descarte:</label>
              <Input
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                placeholder="Ex: Aparas de gordura, osso descartado..."
                className="rounded-xl h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossModalOpen(false)} className="rounded-xl text-xs">
              Cancelar
            </Button>
            <Button onClick={handleConfirmLoss} className="rounded-xl text-xs font-bold bg-rose-600 text-white">
              Abater Quebra (-{lossQtyKg} {unitOf(selectedIngredient)})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: NOVO ALIMENTO / INGREDIENTE EM KG */}
      <Dialog open={newIngredientOpen} onOpenChange={setNewIngredientOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <form onSubmit={handleCreateIngredient}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                Cadastrar Alimento em Kg
              </DialogTitle>
              <DialogDescription className="text-xs">
                Cadastre carnes, peixes ou ingredientes da arca para vincular aos pratos confecionados.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Nome do Alimento:</label>
                <Input
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  placeholder="Ex: Carne de Vaca (Lombo), Peixe Serra..."
                  className="rounded-xl h-10"
                  required
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Medido em:</label>
                <select
                  value={newIngUnit}
                  onChange={(e) => setNewIngUnit(e.target.value === 'un' ? 'un' : 'kg')}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium"
                >
                  <option value="kg">Quilos (kg), ex.: carne, peixe, camarão</option>
                  <option value="un">Unidades, ex.: frango inteiro, ovos</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">Stock Inicial ({newIngUnit}):</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newIngStockKg}
                    onChange={(e) => setNewIngStockKg(Number(e.target.value))}
                    className="rounded-xl h-10"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Custo Estimado / {newIngUnit} (MT):</label>
                  <Input
                    type="number"
                    min="0"
                    value={newIngCostPerKg}
                    onChange={(e) => setNewIngCostPerKg(Number(e.target.value))}
                    className="rounded-xl h-10"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold block mb-1">Localização:</label>
                <Input
                  value={newIngLocation}
                  onChange={(e) => setNewIngLocation(e.target.value)}
                  placeholder="Ex: Câmara Frigorífica, Arca 01..."
                  className="rounded-xl h-10"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewIngredientOpen(false)} className="rounded-xl text-xs">
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl text-xs font-bold bg-[#DF9E42] text-white">
                Guardar Alimento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: NOVO PRATO CONFECIONADO */}
      <Dialog open={newDishOpen} onOpenChange={setNewDishOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <form onSubmit={handleCreateDish}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-[#007bb9]" />
                Criar Prato no Cardápio
              </DialogTitle>
              <DialogDescription className="text-xs">
                Crie um prato com preço de venda e vincule-o ao alimento que ele consome em gramas.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Nome do Prato:</label>
                <Input
                  value={newDishName}
                  onChange={(e) => setNewDishName(e.target.value)}
                  placeholder="Ex: Bife na Chapa com Batata, Peixe Grelhado..."
                  className="rounded-xl h-10"
                  required
                />
              </div>
              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={newDishByWeight}
                  onChange={(e) => {
                    setNewDishByWeight(e.target.checked);
                    setNewDishRawId('');
                  }}
                  className="h-4 w-4"
                />
                Vendido ao peso (o preço é por kg e o peso é indicado em cada pedido)
              </label>
              <div>
                <label className="font-bold block mb-1">{newDishByWeight ? 'Preço por Kg (MT):' : 'Preço de Venda ao Hóspede (MT):'}</label>
                <Input
                  type="number"
                  min="0"
                  value={newDishPrice}
                  onChange={(e) => setNewDishPrice(Number(e.target.value))}
                  className="rounded-xl h-10"
                  required
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Ingrediente Principal da Arca (o stock é abatido por dose):</label>
                <select
                  value={newDishRawId}
                  onChange={(e) => {
                    setNewDishRawId(e.target.value);
                    const ing = rawIngredients.find((r) => r.id === e.target.value);
                    setNewDishGrams(unitOf(ing) === 'kg' ? 300 : 1);
                  }}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium"
                >
                  <option value="">Nenhum (prato sem dedução de stock em kg)</option>
                  {rawIngredients
                    .filter((r) => !newDishByWeight || unitOf(r) === 'kg')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (disp: {Number(r.stock).toFixed(1)} {unitOf(r)})
                      </option>
                    ))}
                </select>
              </div>
              {newDishRawId && !newDishByWeight && (
                <div>
                  <label className="font-bold block mb-1">
                    {unitOf(rawIngredients.find((r) => r.id === newDishRawId)) === 'kg'
                      ? 'Quantidade Abatida por Dose (gramas):'
                      : 'Quantidade Abatida por Dose (unidades, ex.: 0,5 = meio frango):'}
                  </label>
                  <Input
                    type="number"
                    step={unitOf(rawIngredients.find((r) => r.id === newDishRawId)) === 'kg' ? '10' : '0.5'}
                    min={unitOf(rawIngredients.find((r) => r.id === newDishRawId)) === 'kg' ? '10' : '0.5'}
                    value={newDishGrams}
                    onChange={(e) => setNewDishGrams(Number(e.target.value))}
                    placeholder="300"
                    className="rounded-xl h-10"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Cada prato vendido abaterá automaticamente{' '}
                    {unitOf(rawIngredients.find((r) => r.id === newDishRawId)) === 'kg' ? `${(newDishGrams / 1000).toFixed(3)} kg` : `${num(newDishGrams)} un`} do stock.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewDishOpen(false)} className="rounded-xl text-xs">
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl text-xs font-bold bg-[#007bb9] text-white">
                Criar Prato no Menu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
