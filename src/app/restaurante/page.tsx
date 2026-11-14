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
  Edit2,
  Sliders,
  MapPin,
  Layers,
  Save,
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
const unitOf = (p?: Pick<Product, 'unit'> | null): 'kg' | 'un' =>
  (p?.unit || 'kg').toLowerCase().startsWith('k') ? 'kg' : 'un';
const num = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

export default function RestaurantePage() {
  const {
    products = [],
    companyId,
    user,
    addProduct,
    updateProduct,
    deleteProduct,
    auditStock,
    companyData,
    canEdit,
  } = useContext(InventoryContext) || {
    products: [],
    canEdit: () => false,
    companyData: null,
    companyId: null,
    user: null,
    addProduct: async () => {},
    updateProduct: async () => {},
    deleteProduct: () => {},
    auditStock: async () => {},
  };
  const { stays } = useRooms();

  // Criar pratos/ingredientes e mexer no stock exige escrita no Inventário (a receção só vê)
  const canManageStock = Boolean(canEdit && canEdit('inventory'));

  const [activeTab, setActiveTab] = useState<'kds' | 'fridge' | 'menu'>('kds');
  const [orders, setOrders] = useState<RoomOrderDoc[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filtros de Pesquisa
  const [searchFridge, setSearchFridge] = useState('');
  const [searchMenu, setSearchMenu] = useState('');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('all');

  // Modais de Gestão de Kg (Entrada / Quebra)
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
  const [newDishCategory, setNewDishCategory] = useState('Pratos Principais');
  const [newDishPrice, setNewDishPrice] = useState(550);
  const [newDishRawId, setNewDishRawId] = useState('');
  const [newDishGrams, setNewDishGrams] = useState(300); // por dose: gramas (ingrediente em kg) ou unidades (ingrediente em un)
  const [newDishByWeight, setNewDishByWeight] = useState(false); // prato vendido ao peso (preço por kg)

  // ==============================================================
  // ESTADOS PARA EDIÇÃO DE PRATOS (ONDE ABATER OS STOCKS)
  // ==============================================================
  const [editDishOpen, setEditDishOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Product | null>(null);
  const [editDishName, setEditDishName] = useState('');
  const [editDishCategory, setEditDishCategory] = useState('Pratos Principais');
  const [editDishPrice, setEditDishPrice] = useState(550);
  const [editDishByWeight, setEditDishByWeight] = useState(false);
  const [editDishRawId, setEditDishRawId] = useState(''); // ONDE ABATER O STOCK
  const [editDishGrams, setEditDishGrams] = useState(300);
  const [savingDish, setSavingDish] = useState(false);

  // ==============================================================
  // ESTADOS PARA EDIÇÃO DE ALIMENTOS & AJUSTE DIRETO DE STOCKS
  // ==============================================================
  const [editIngOpen, setEditIngOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Product | null>(null);
  const [editIngName, setEditIngName] = useState('');
  const [editIngStock, setEditIngStock] = useState<number>(0);
  const [editIngUnit, setEditIngUnit] = useState<'kg' | 'un'>('kg');
  const [editIngCostPerUnit, setEditIngCostPerUnit] = useState<number>(0);
  const [editIngLocation, setEditIngLocation] = useState('Câmara Frigorífica');
  const [editIngLowStock, setEditIngLowStock] = useState<number>(3);
  const [savingIng, setSavingIng] = useState(false);

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

  // Alimentos Filtrados pela Pesquisa
  const filteredIngredients = useMemo(() => {
    if (!searchFridge.trim()) return rawIngredients;
    const q = searchFridge.toLowerCase();
    return rawIngredients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.category && r.category.toLowerCase().includes(q))
    );
  }, [rawIngredients, searchFridge]);

  // 3. Filtro de Pratos Confecionados
  const dishes = useMemo(() => {
    return products.filter((p) => p.isDish || (p.category || '').toLowerCase().includes('prato'));
  }, [products]);

  // Categorias de Pratos Únicas
  const dishCategories = useMemo(() => {
    const set = new Set(dishes.map((d) => d.category || 'Pratos Principais'));
    return ['all', ...Array.from(set)];
  }, [dishes]);

  // Pratos Filtrados por Categoria e Busca
  const filteredDishes = useMemo(() => {
    return dishes.filter((d) => {
      if (selectedMenuCategory !== 'all' && (d.category || 'Pratos Principais') !== selectedMenuCategory) {
        return false;
      }
      if (searchMenu.trim()) {
        const q = searchMenu.toLowerCase();
        return (
          d.name.toLowerCase().includes(q) ||
          (d.category && d.category.toLowerCase().includes(q)) ||
          (d.rawIngredientName && d.rawIngredientName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [dishes, selectedMenuCategory, searchMenu]);

  // Executar Entrada de Compra em Kg
  const handleConfirmEntry = async () => {
    if (!selectedIngredient || entryQtyKg <= 0) return;
    try {
      const current = selectedIngredient.stock || 0;
      const nextStock = Math.round((current + entryQtyKg) * 1000) / 1000;
      if (auditStock) {
        await auditStock(
          selectedIngredient,
          nextStock,
          `Entrada de compra de alimentos (+${entryQtyKg} ${unitOf(selectedIngredient)})`
        );
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
        await auditStock(
          selectedIngredient,
          nextStock,
          `Quebra / Desperdício alimentar (-${lossQtyKg} ${unitOf(selectedIngredient)}): ${lossReason}`
        );
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
        location: newIngLocation.trim() || 'Câmara Frigorífica',
        isKitchenIngredient: true,
      } as any);
      toast({
        title: 'Ingrediente cadastrado',
        description: `${newIngName} criado com ${newIngStockKg} ${newIngUnit} em ${newIngLocation}.`,
      });
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
      await addProduct({
        name: newDishName.trim(),
        category: newDishCategory.trim() || 'Pratos Principais',
        price: newDishPrice,
        cost: selectedIng ? Math.round(((selectedIng.cost || 0) * (newDishByWeight ? 1 : perPortion)) * 100) / 100 : 0,
        unit: newDishByWeight ? 'kg' : 'dose',
        location: 'Cozinha',
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
          : `"${newDishName}" abaterá ${ingUnit === 'kg' ? `${newDishGrams}g` : `${num(newDishGrams)} un`} de ${selectedIng?.name || 'alimento base'}.`,
      });
      setNewDishName('');
      setNewDishByWeight(false);
      setNewDishOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao criar prato' });
    }
  };

  // ==============================================================
  // AÇÕES DE EDIÇÃO DE PRATOS (ONDE ABATER OS STOCKS)
  // ==============================================================
  const handleStartEditDish = (dish: Product) => {
    setEditingDish(dish);
    setEditDishName(dish.name || '');
    setEditDishCategory(dish.category || 'Pratos Principais');
    setEditDishPrice(Number(dish.price) || 0);
    setEditDishByWeight(Boolean(dish.soldByWeight));
    setEditDishRawId(dish.rawIngredientId || '');

    const linkedIng = rawIngredients.find((r) => r.id === dish.rawIngredientId);
    const isKg = unitOf(linkedIng) === 'kg';
    if (dish.rawQuantityPerPortion !== undefined && dish.rawQuantityPerPortion !== null) {
      setEditDishGrams(isKg ? Math.round(Number(dish.rawQuantityPerPortion) * 1000) : Number(dish.rawQuantityPerPortion));
    } else {
      setEditDishGrams(isKg ? 300 : 1);
    }

    setEditDishOpen(true);
  };

  const handleSaveEditDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish || !editDishName.trim()) return;

    const selectedIng = rawIngredients.find((r) => r.id === editDishRawId);
    const ingUnit = unitOf(selectedIng);
    const perPortion = selectedIng
      ? ingUnit === 'kg'
        ? editDishGrams / 1000
        : editDishGrams
      : 0;

    try {
      setSavingDish(true);
      const updatedPayload: Partial<Product> = {
        name: editDishName.trim(),
        category: editDishCategory.trim() || 'Pratos Principais',
        price: editDishPrice,
        isDish: true,
        soldByWeight: editDishByWeight,
        pricePerKg: editDishByWeight ? editDishPrice : 0,
        // Configuração de onde abater o stock:
        rawIngredientId: selectedIng ? selectedIng.id : '',
        rawIngredientName: selectedIng ? selectedIng.name : '',
        rawQuantityPerPortion: selectedIng && !editDishByWeight ? perPortion : 0,
        cost: selectedIng
          ? Math.round(((selectedIng.cost || 0) * (editDishByWeight ? 1 : perPortion)) * 100) / 100
          : Number(editingDish.cost) || 0,
      };

      await updateProduct(editingDish.instanceId, updatedPayload);

      toast({
        title: 'Prato atualizado com sucesso!',
        description: selectedIng
          ? `"${editDishName}" abaterá stock de "${selectedIng.name}" (${editDishByWeight ? 'ao peso' : `${editDishGrams}${ingUnit === 'kg' ? 'g' : ' un'}`}).`
          : `"${editDishName}" atualizado (sem dedução de matéria-prima).`,
      });

      setEditDishOpen(false);
      setEditingDish(null);
    } catch (err: any) {
      console.error('Erro ao atualizar prato:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao guardar prato',
        description: err?.message || 'Falha ao atualizar dados do prato.',
      });
    } finally {
      setSavingDish(false);
    }
  };

  const handleDeleteDish = async (dish: Product) => {
    if (!window.confirm(`Tem a certeza que deseja eliminar o prato "${dish.name}" do cardápio?`)) return;
    try {
      if (deleteProduct) {
        await deleteProduct(dish.instanceId);
        toast({ title: 'Prato removido do cardápio', description: dish.name });
      }
    } catch (err: any) {
      console.error('Erro ao eliminar prato:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao eliminar',
        description: err?.message || 'Falha ao apagar prato.',
      });
    }
  };

  // ==============================================================
  // AÇÕES DE EDIÇÃO DE INGREDIENTES E AJUSTE DIRETO DE STOCK
  // ==============================================================
  const handleStartEditIngredient = (ing: Product) => {
    setEditingIngredient(ing);
    setEditIngName(ing.name || '');
    setEditIngStock(Number(ing.stock) || 0);
    setEditIngUnit(unitOf(ing));
    setEditIngCostPerUnit(Number(ing.cost) || 0);
    setEditIngLocation(ing.location || 'Câmara Frigorífica');
    setEditIngLowStock(Number(ing.lowStockThreshold) || 3);
    setEditIngOpen(true);
  };

  const handleSaveEditIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngredient || !editIngName.trim()) return;

    try {
      setSavingIng(true);
      const newStockVal = Math.max(0, Math.round(Number(editIngStock) * 1000) / 1000);
      const prevStock = Number(editingIngredient.stock) || 0;
      const stockChanged = Math.abs(newStockVal - prevStock) > 0.001;

      // Se o stock físico mudou, faz o ajuste auditado
      if (stockChanged && auditStock) {
        await auditStock(
          editingIngredient,
          newStockVal,
          `Ajuste direto de stock na Cozinha/Câmara: ${prevStock} → ${newStockVal} ${editIngUnit}`
        );
      }

      const updatedPayload: Partial<Product> = {
        name: editIngName.trim(),
        unit: editIngUnit,
        cost: Number(editIngCostPerUnit) || 0,
        location: editIngLocation.trim() || 'Câmara Frigorífica',
        lowStockThreshold: Number(editIngLowStock) || 3,
        isKitchenIngredient: true,
        ...(!auditStock ? { stock: newStockVal } : {}),
      };

      await updateProduct(editingIngredient.instanceId, updatedPayload);

      // Se o nome do ingrediente mudou, atualiza nos pratos vinculados para manter coerência
      if (editIngName.trim() !== editingIngredient.name) {
        const linkedDishes = dishes.filter((d) => d.rawIngredientId === editingIngredient.id);
        for (const d of linkedDishes) {
          await updateProduct(d.instanceId, { rawIngredientName: editIngName.trim() });
        }
      }

      toast({
        title: 'Alimento e stock atualizados!',
        description: `"${editIngName}" guardado com ${newStockVal} ${editIngUnit} em ${editIngLocation}.`,
      });

      setEditIngOpen(false);
      setEditingIngredient(null);
    } catch (err: any) {
      console.error('Erro ao atualizar ingrediente:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao guardar alimento',
        description: err?.message || 'Falha ao atualizar dados.',
      });
    } finally {
      setSavingIng(false);
    }
  };

  const handleDeleteIngredient = async (ing: Product) => {
    const linked = dishes.filter((d) => d.rawIngredientId === ing.id);
    const warn =
      linked.length > 0
        ? `ATENÇÃO: Existem ${linked.length} prato(s) confecionado(s) vinculados a este alimento (${linked.map((l) => l.name).join(', ')}).\n\nSe eliminar, esses pratos ficarão sem dedução de matéria-prima. Deseja continuar e eliminar "${ing.name}"?`
        : `Tem a certeza que deseja eliminar "${ing.name}" da câmara/arca de alimentos?`;

    if (!window.confirm(warn)) return;

    try {
      if (deleteProduct) {
        await deleteProduct(ing.instanceId);
        for (const d of linked) {
          await updateProduct(d.instanceId, { rawIngredientId: '', rawIngredientName: '' });
        }
        toast({ title: 'Alimento eliminado com sucesso', description: ing.name });
      }
    } catch (err: any) {
      console.error('Erro ao eliminar alimento:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao eliminar',
        description: err?.message || 'Falha ao eliminar alimento.',
      });
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
              Controlo de pedidos em tempo real, fichas técnicas, edição de pratos e gestão de stocks onde abater matéria-prima.
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

          {canManageStock && (
            <Button
              size="sm"
              onClick={() => setNewDishOpen(true)}
              className="rounded-xl h-9 text-xs font-bold bg-[#007bb9] hover:bg-[#006295] text-white shadow-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Prato
            </Button>
          )}
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
            Alimentos ({rawIngredients.length})
          </TabsTrigger>
          <TabsTrigger
            value="menu"
            className="text-xs font-bold gap-1.5 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-[#191E25] data-[state=active]:text-[#007bb9] dark:data-[state=active]:text-sky-300 data-[state=active]:shadow-xs"
          >
            <Utensils className="h-4 w-4" />
            Pratos & Menu ({dishes.length})
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
                Quando um hóspede pedir um prato através do QR Code do quarto ou da receção, o pedido surge aqui em tempo real.
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
                Controlo de carnes, peixes e alimentos medidos em Quilos (Kg). Edite stocks, entradas e perdas.
              </p>
            </div>
            {canManageStock && (
              <Button
                size="sm"
                onClick={() => setNewIngredientOpen(true)}
                className="rounded-xl h-9 text-xs font-bold bg-[#DF9E42] hover:bg-[#C58A2C] text-white shadow-xs gap-1.5"
              >
                <PackagePlus className="w-4 h-4" />
                Novo Alimento em Kg
              </Button>
            )}
          </div>

          {/* Barra de Pesquisa de Alimentos */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Pesquisar alimento por nome, câmara frigorífica ou tipo..."
                value={searchFridge}
                onChange={(e) => setSearchFridge(e.target.value)}
                className="h-10 text-xs pl-9.5 rounded-2xl bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          {filteredIngredients.length === 0 ? (
            <Card className="rounded-3xl border-dashed p-10 text-center">
              <Scale className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="font-extrabold text-base text-slate-700 dark:text-slate-200">
                {searchFridge ? 'Nenhum alimento corresponde à pesquisa' : 'Sem alimentos cadastrados na arca'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Adicione carnes (vaca, frango, porco), peixes ou camarão em "kg" para controlar o stock disponível e vincular aos pratos confecionados.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIngredients.map((ing) => {
                const stockKg = Number(ing.stock) || 0;
                const isCritical = stockKg <= (ing.criticalStockThreshold || 2);
                return (
                  <Card key={ing.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between">
                    <div>
                      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                            {ing.name}
                          </CardTitle>
                          <CardDescription className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {ing.location || 'Câmara Frigorífica'}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
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
                          {canManageStock && (
                            <div className="flex items-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEditIngredient(ing)}
                                className="h-7 w-7 text-slate-400 hover:text-[#007bb9] rounded-lg"
                                title="Editar alimento e ajustar stock"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteIngredient(ing)}
                                className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg"
                                title="Eliminar alimento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 pt-2 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Custo / {unitOf(ing)}:</span>
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
                      </CardContent>
                    </div>

                    <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedIngredient(ing);
                            setEntryModalOpen(true);
                          }}
                          className="h-8 text-[11px] font-bold rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 gap-1 flex-1"
                        >
                          <Plus className="w-3 h-3" />
                          Entrada
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedIngredient(ing);
                            setLossModalOpen(true);
                          }}
                          className="h-8 text-[11px] font-bold rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 gap-1 flex-1"
                        >
                          <Minus className="w-3 h-3" />
                          Quebra
                        </Button>
                      </div>

                      {canManageStock && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEditIngredient(ing)}
                          className="h-8 text-[11px] font-bold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 gap-1 shrink-0"
                          title="Ajustar quantidade em stock diretamente"
                        >
                          <Sliders className="w-3 h-3 text-[#007bb9]" />
                          Editar Stock
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* ABA 3: PRATOS & MENU DO RESTAURANTE (ONDE ABATER OS STOCKS)     */}
        {/* ============================================================== */}
        <TabsContent value="menu" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FDFBF7] dark:bg-[#1A1D23] p-4 rounded-3xl border border-amber-200/60 dark:border-slate-800">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-[#007bb9]" />
                Cardápio de Refeições & Dedução de Stock
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pratos servidos aos hóspedes. Configure livremente onde o stock de carne/peixe é abatido e a gramagem por dose.
              </p>
            </div>
            {canManageStock && (
              <Button
                size="sm"
                onClick={() => setNewDishOpen(true)}
                className="rounded-xl h-9 text-xs font-bold bg-[#007bb9] hover:bg-[#006295] text-white shadow-xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Novo Prato no Cardápio
              </Button>
            )}
          </div>

          {/* Barra de Filtros e Categorias de Pratos */}
          <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#191E25] space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Pesquisar prato, ingrediente abatido ou categoria..."
                  value={searchMenu}
                  onChange={(e) => setSearchMenu(e.target.value)}
                  className="h-10 text-xs pl-9.5 rounded-xl bg-slate-50 dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {dishCategories.map((cat) => {
                const isSelected = selectedMenuCategory === cat;
                const count =
                  cat === 'all'
                    ? dishes.length
                    : dishes.filter((d) => (d.category || 'Pratos Principais') === cat).length;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedMenuCategory(cat)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer',
                      isSelected
                        ? 'bg-[#007bb9] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    )}
                  >
                    {cat === 'all' ? 'Todos os Pratos' : cat}
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded-full font-black',
                        isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredDishes.length === 0 ? (
            <Card className="rounded-3xl border-dashed p-10 text-center">
              <ChefHat className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="font-extrabold text-base text-slate-700 dark:text-slate-200">
                {searchMenu || selectedMenuCategory !== 'all'
                  ? 'Nenhum prato encontrado para estes filtros'
                  : 'Nenhum prato cadastrado no cardápio'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Crie os pratos servidos pelo hotel e defina onde o stock é abatido (ex: Bife com 300g de Carne de Vaca).
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDishes.map((d) => {
                const linkedIng = rawIngredients.find((r) => r.id === d.rawIngredientId);
                const hasLinkedIng = Boolean(linkedIng);
                const ingStock = linkedIng ? Number(linkedIng.stock) || 0 : 0;
                const isOutOfStock = hasLinkedIng && ingStock <= 0;
                const isLowStock = hasLinkedIng && !isOutOfStock && ingStock <= (linkedIng?.criticalStockThreshold || 2);

                return (
                  <Card key={d.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 flex flex-col justify-between group">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">{d.name}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 inline-block mt-1">
                            {d.category || 'Pratos Principais'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-[#C58A2C] block">
                            {formatCurrency(d.price)}
                            {d.soldByWeight ? ' / kg' : ''}
                          </span>
                          {canManageStock && (
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEditDish(d)}
                                className="h-7 w-7 text-slate-400 hover:text-[#007bb9] rounded-lg"
                                title="Editar prato e onde abater o stock"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteDish(d)}
                                className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg"
                                title="Eliminar prato do cardápio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bloco: Onde Abater o Stock */}
                      <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-[11px]">
                            <Scale className="w-3.5 h-3.5 text-amber-600" />
                            Onde Abater o Stock:
                          </span>
                          {isOutOfStock ? (
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-rose-500 text-white">
                              Esgotado
                            </span>
                          ) : isLowStock ? (
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-amber-500 text-white">
                              Stock Baixo
                            </span>
                          ) : null}
                        </div>

                        {hasLinkedIng ? (
                          <div className="space-y-1 text-slate-700 dark:text-slate-300">
                            <p className="font-bold text-xs text-amber-900 dark:text-amber-100 flex items-center gap-1">
                              🥩 {linkedIng?.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {d.soldByWeight ? (
                                <span>Ao peso: abate exatamente os kg pesados no pedido.</span>
                              ) : (
                                <span>
                                  Dose abate{' '}
                                  <strong className="text-slate-800 dark:text-slate-100 font-bold">
                                    {unitOf(linkedIng) === 'kg'
                                      ? `${Math.round((d.rawQuantityPerPortion || 0.3) * 1000)}g`
                                      : `${num(d.rawQuantityPerPortion || 1)} un`}
                                  </strong>{' '}
                                  por prato servido.
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 pt-0.5">
                              <MapPin className="w-3 h-3 text-emerald-600" />
                              Local: {linkedIng?.location || 'Câmara Frigorífica'} (Restam {ingStock.toFixed(1)}{' '}
                              {unitOf(linkedIng)})
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                            Sem dedução de matéria-prima vinculada (stock independente).
                          </p>
                        )}
                      </div>
                    </div>

                    {canManageStock && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEditDish(d)}
                          className="w-full rounded-xl h-8 text-xs font-bold border-amber-300/80 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100/50 gap-1.5"
                        >
                          <Edit2 className="w-3 h-3 text-amber-600" />
                          Editar Prato & Onde Abater
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* DIÁLOGO: EDITAR PRATO & ONDE ABATER OS STOCKS                  */}
      {/* ============================================================== */}
      <Dialog open={editDishOpen} onOpenChange={setEditDishOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <form onSubmit={handleSaveEditDish}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-[#007bb9]" />
                Editar Prato & Ficha Técnica
              </DialogTitle>
              <DialogDescription className="text-xs">
                Edite os preços e defina onde e quanto stock é abatido na arca ao vender este prato.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Nome do Prato <span className="text-rose-500">*</span>:</label>
                <Input
                  value={editDishName}
                  onChange={(e) => setEditDishName(e.target.value)}
                  placeholder="Ex: Bife na Chapa com Batatas, Peixe Grelhado..."
                  className="rounded-xl h-10 font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Categoria:</label>
                <Input
                  value={editDishCategory}
                  onChange={(e) => setEditDishCategory(e.target.value)}
                  placeholder="Ex: Pratos Principais, Peixes, Carnes, Petiscos..."
                  className="rounded-xl h-10"
                />
              </div>

              <label className="flex items-center gap-2 font-bold cursor-pointer p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={editDishByWeight}
                  onChange={(e) => setEditDishByWeight(e.target.checked)}
                  className="h-4 w-4 rounded text-[#007bb9]"
                />
                <span>Vendido ao peso (preço por kg e peso indicado ao lançar)</span>
              </label>

              <div>
                <label className="font-bold block mb-1">
                  {editDishByWeight ? 'Preço por Kg (MT):' : 'Preço de Venda ao Hóspede (MT):'}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={editDishPrice}
                  onChange={(e) => setEditDishPrice(Number(e.target.value))}
                  className="rounded-xl h-10 font-bold"
                  required
                />
              </div>

              {/* ONDE ABATER OS STOCKS */}
              <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2">
                <label className="font-extrabold text-amber-950 dark:text-amber-200 block">
                  Onde abater os stocks (Alimento da Arca):
                </label>
                <select
                  value={editDishRawId}
                  onChange={(e) => {
                    setEditDishRawId(e.target.value);
                    const ing = rawIngredients.find((r) => r.id === e.target.value);
                    if (ing) {
                      setEditDishGrams(unitOf(ing) === 'kg' ? 300 : 1);
                    }
                  }}
                  className="w-full h-10 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100"
                >
                  <option value="">Nenhum (prato sem dedução de stock alimentar)</option>
                  {rawIngredients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {Number(r.stock).toFixed(1)} {unitOf(r)} ({r.location || 'Câmara Frigorífica'})
                    </option>
                  ))}
                </select>

                {editDishRawId && !editDishByWeight && (
                  <div className="pt-1.5 space-y-1">
                    <label className="font-bold block text-slate-700 dark:text-slate-300">
                      {unitOf(rawIngredients.find((r) => r.id === editDishRawId)) === 'kg'
                        ? 'Quantidade Abatida por Dose (gramas):'
                        : 'Quantidade Abatida por Dose (unidades):'}
                    </label>
                    <Input
                      type="number"
                      step={unitOf(rawIngredients.find((r) => r.id === editDishRawId)) === 'kg' ? '10' : '0.5'}
                      min={unitOf(rawIngredients.find((r) => r.id === editDishRawId)) === 'kg' ? '10' : '0.5'}
                      value={editDishGrams}
                      onChange={(e) => setEditDishGrams(Number(e.target.value))}
                      className="rounded-xl h-10 bg-white dark:bg-slate-900 font-bold"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Ao vender 1 prato, abaterá{' '}
                      {unitOf(rawIngredients.find((r) => r.id === editDishRawId)) === 'kg'
                        ? `${(editDishGrams / 1000).toFixed(3)} kg`
                        : `${num(editDishGrams)} un`}{' '}
                      da matéria-prima selecionada.
                    </p>
                  </div>
                )}

                {editDishRawId && editDishByWeight && (
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 italic pt-1">
                    Venda ao peso: abaterá exatamente a pesagem registada ao confirmar o pedido.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              {editingDish && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDishOpen(false);
                    handleDeleteDish(editingDish);
                  }}
                  className="rounded-xl text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 mr-auto"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Eliminar Prato
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setEditDishOpen(false)} className="rounded-xl text-xs">
                Cancelar
              </Button>
              <Button type="submit" disabled={savingDish} className="rounded-xl text-xs font-bold bg-[#007bb9] text-white">
                {savingDish ? 'A guardar...' : 'Guardar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* DIÁLOGO: EDITAR ALIMENTO & AJUSTAR STOCK DA CÂMARA             */}
      {/* ============================================================== */}
      <Dialog open={editIngOpen} onOpenChange={setEditIngOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <form onSubmit={handleSaveEditIngredient}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-600" />
                Editar Alimento & Ajustar Stock
              </DialogTitle>
              <DialogDescription className="text-xs">
                Edite a quantidade real em stock na câmara/arca, localização e preço de custo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Nome do Alimento <span className="text-rose-500">*</span>:</label>
                <Input
                  value={editIngName}
                  onChange={(e) => setEditIngName(e.target.value)}
                  placeholder="Ex: Carne de Vaca (Lombo), Camarão Tigre..."
                  className="rounded-xl h-10 font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Medido em:</label>
                <select
                  value={editIngUnit}
                  onChange={(e) => setEditIngUnit(e.target.value === 'un' ? 'un' : 'kg')}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold"
                >
                  <option value="kg">Quilos (kg) — Carnes, peixes, camarão</option>
                  <option value="un">Unidades (un) — Frangos inteiros, ovos</option>
                </select>
              </div>

              {/* EDIÇÃO DIRETA DO STOCK */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                <label className="font-extrabold text-emerald-950 dark:text-emerald-200 block">
                  Stock Atual na Arca ({editIngUnit}):
                </label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  value={editIngStock}
                  onChange={(e) => setEditIngStock(Number(e.target.value))}
                  className="rounded-xl h-10 bg-white dark:bg-slate-900 font-extrabold text-base text-emerald-700 dark:text-emerald-300"
                  required
                />
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  Insira o valor exato verificado na balança ou contagem física para acertar o stock do sistema.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Custo / {editIngUnit} (MT):</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={editIngCostPerUnit}
                    onChange={(e) => setEditIngCostPerUnit(Number(e.target.value))}
                    className="rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Alerta de Stock Mínimo ({editIngUnit}):</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editIngLowStock}
                    onChange={(e) => setEditIngLowStock(Number(e.target.value))}
                    className="rounded-xl h-10"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Localização de Armazenamento:</label>
                <Input
                  value={editIngLocation}
                  onChange={(e) => setEditIngLocation(e.target.value)}
                  placeholder="Ex: Câmara Frigorífica, Arca 01, Despensa..."
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              {editingIngredient && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditIngOpen(false);
                    handleDeleteIngredient(editingIngredient);
                  }}
                  className="rounded-xl text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 mr-auto"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Eliminar
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setEditIngOpen(false)} className="rounded-xl text-xs">
                Cancelar
              </Button>
              <Button type="submit" disabled={savingIng} className="rounded-xl text-xs font-bold bg-[#DF9E42] hover:bg-[#C58A2C] text-white">
                {savingIng ? 'A guardar...' : 'Guardar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                Crie um prato com preço de venda e configure onde o stock é abatido na câmara fria.
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
              <div>
                <label className="font-bold block mb-1">Categoria:</label>
                <Input
                  value={newDishCategory}
                  onChange={(e) => setNewDishCategory(e.target.value)}
                  placeholder="Ex: Pratos Principais, Peixes, Carnes..."
                  className="rounded-xl h-10"
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
                <label className="font-bold block mb-1">Onde Abater os Stocks (Ingrediente da Arca):</label>
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
                        {r.name} (disp: {Number(r.stock).toFixed(1)} {unitOf(r)} em {r.location || 'Câmara'})
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
