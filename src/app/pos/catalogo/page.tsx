"use client";
import { haul } from '@/lib/haul';
import { getAfterSale } from '@/lib/after-sale';
import { AfterSaleDialog, printSale, type DoneSale } from '@/components/pos/after-sale-dialog';
import { LocationSelectItems } from '@/components/ui/location-select-items';
import { habitualLocation, recordLocation } from "@/lib/habitual-location";
import { ProductPhoto } from "@/components/ui/product-photo";
import { isSameDay } from "date-fns";

import React, { useState, useContext, useMemo, useCallback, useEffect } from 'react';
import { InventoryContext } from '@/context/inventory-context';
import { useCRM } from '@/context/crm-context';
import type { CartItem, Product, Sale, Location } from '@/lib/types';
import { formatCurrency, normalizeString } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useFuse } from '@/hooks/use-fuse';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MathInput } from '@/components/ui/math-input';

import {
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    Search,
    Package,
    Receipt,
    X,
    CreditCard,
    AlertTriangle
} from 'lucide-react';

import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { PosCart } from '@/components/pos/pos-cart';
import Link from 'next/link';
import { setSellMode } from '@/lib/sell-mode';
import { holdCart, resumeCart, parseHeld, type HeldCart } from '@/lib/held-carts';
import { Clock, Keyboard } from 'lucide-react';
import { AiSuggestions } from '@/components/pos/ai-suggestions';

type CatalogProduct = Omit<Product, 'stock' | 'instanceId' | 'reservedStock' | 'location' | 'lastUpdated'>;

const CART_STORAGE_PREFIX = 'majorstockx-pos-cart-';
const HELD_STORAGE_PREFIX = 'majorstockx-pos-held-';

function loadCartFromStorage(companyId: string | null): CartItem[] {
    if (typeof window === 'undefined' || !companyId) return [];
    try {
        const saved = localStorage.getItem(`${CART_STORAGE_PREFIX}${companyId}`);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

function saveCartToStorage(cart: CartItem[], companyId: string | null) {
    if (typeof window === 'undefined' || !companyId) return;
    localStorage.setItem(`${CART_STORAGE_PREFIX}${companyId}`, JSON.stringify(cart));
}

export default function POSPage() {
    const inventoryContext = useContext(InventoryContext);
    const {
        products,
        catalogProducts,
        catalogCategories,
        loading,
        user,
        companyId,
        locations,
        isMultiLocation,
        addBulkSale,
        canView,
        canEdit,
        companyData,
    } = inventoryContext || {
        products: [], catalogProducts: [], catalogCategories: [], loading: true,
        user: null, companyId: null, locations: [], isMultiLocation: false,
        addBulkSale: async () => { }, canView: () => false, canEdit: () => false, companyData: null,
    };
    const { customers, addCustomer } = useCRM();
    const { toast } = useToast();

    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    // Checkout form state
    const [checkoutClientName, setCheckoutClientName] = useState('');
    const [checkoutCustomerId, setCheckoutCustomerId] = useState('new');
    const [checkoutDocType, setCheckoutDocType] = useState<'Venda a Dinheiro' | 'Factura Proforma' | 'Guia de Remessa' | 'Factura' | 'Recibo'>('Venda a Dinheiro');
    const [checkoutNotes, setCheckoutNotes] = useState('');
    const [checkoutApplyVat, setCheckoutApplyVat] = useState(false);
    const [checkoutVatPercentage, setCheckoutVatPercentage] = useState(17);
    const [checkoutDiscountType, setCheckoutDiscountType] = useState<'fixed' | 'percentage'>('fixed');
    const [checkoutDiscountValue, setCheckoutDiscountValue] = useState(0);
    const [checkoutPendingPickup, setCheckoutPendingPickup] = useState(false);
    const [checkoutDate, setCheckoutDate] = useState<Date>(new Date());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [cartCompanyId, setCartCompanyId] = useState<string | null>(null);
    // carrinhos retidos (o cliente foi buscar dinheiro) e o resumo da última venda (para enviar o recibo)
    const [held, setHeld] = useState<HeldCart[]>([]);
    const [heldOpen, setHeldOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [done, setDone] = useState<DoneSale | null>(null);

    // quem vende por toque passa a abrir aqui ao tocar em "Venda Rápida"
    useEffect(() => { setSellMode('toque'); }, []);

    useEffect(() => {
        if (!companyId) { setHeld([]); return; }
        try { setHeld(parseHeld(localStorage.getItem(`${HELD_STORAGE_PREFIX}${companyId}`))); } catch { setHeld([]); }
    }, [companyId]);
    const saveHeld = useCallback((list: HeldCart[]) => {
        setHeld(list);
        if (companyId) try { localStorage.setItem(`${HELD_STORAGE_PREFIX}${companyId}`, JSON.stringify(list)); } catch { /* ignore */ }
    }, [companyId]);

    // Load cart from localStorage when companyId changes safely
    useEffect(() => {
        if (companyId && companyId !== cartCompanyId) {
            setCart(loadCartFromStorage(companyId));
            setCartCompanyId(companyId);
        } else if (!companyId) {
            setCart([]);
            setCartCompanyId(null);
        }
    }, [companyId, cartCompanyId]);

    // Set default location
    useEffect(() => {
        if (isMultiLocation && locations.length > 0 && !selectedLocation) {
            const saved = habitualLocation(locations.map(l => l.id));
            setSelectedLocation(saved && locations.some(l => l.id === saved) ? saved : locations[0].id);
        }
    }, [isMultiLocation, locations, selectedLocation]);

    // Save cart to localStorage on change, ONLY for the correct company
    useEffect(() => {
        if (companyId && cartCompanyId === companyId) {
            saveCartToStorage(cart, companyId);
        }
    }, [cart, companyId, cartCompanyId]);

    // Auto-set client name when customer is selected
    useEffect(() => {
        if (checkoutCustomerId && checkoutCustomerId !== 'new') {
            const customer = customers.find(c => c.id === checkoutCustomerId);
            if (customer) setCheckoutClientName(customer.name);
        }
    }, [checkoutCustomerId, customers]);

    // Products available for sale at current location
    const availableProducts = useMemo(() => {
        if (!products || !catalogProducts) return [];

        const productsForLocation = isMultiLocation && selectedLocation
            ? products.filter(p => p.location === selectedLocation)
            : products;

        const inStock = productsForLocation.filter(p => (p.stock - p.reservedStock) > 0);
        const inStockMap = new Map<string, Product>();
        inStock.forEach(p => { if (!inStockMap.has(p.name)) inStockMap.set(p.name, p); });

        return catalogProducts
            .filter(cp => inStockMap.has(cp.name))
            .map(cp => {
                const inventoryProduct = inStockMap.get(cp.name)!;
                return {
                    ...cp,
                    imageUrl: cp.imageUrl || inventoryProduct.imageUrl,
                    stockInstance: inventoryProduct,
                    availableStock: (inventoryProduct.stock || 0) - (inventoryProduct.reservedStock || 0),
                };
            });
    }, [products, catalogProducts, selectedLocation, isMultiLocation]);

    // Filtered products based on category
    const categoryFilteredProducts = useMemo(() => {
        if (!selectedCategory || selectedCategory === 'all') return availableProducts;

        const normalizedCategory = normalizeString(selectedCategory);
        return availableProducts.filter(p => {
            if (!p.category) return false;
            return normalizeString(p.category) === normalizedCategory;
        });
    }, [availableProducts, selectedCategory]);

    // Search filtering using Fuse for 85% approx match
    const filteredProducts = useFuse(categoryFilteredProducts, searchQuery, {
        keys: ['name', 'category'],
        threshold: 0.15
    });

    // Unique categories
    const categories = useMemo(() => {
        const cats = new Set(availableProducts.map(p => p.category).filter(Boolean));
        return ['all', ...Array.from(cats)];
    }, [availableProducts]);

    // Cart calculations
    const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);

    const discountAmount = useMemo(() => {
        if (checkoutDiscountType === 'percentage') {
            return cartSubtotal * (checkoutDiscountValue / 100);
        }
        return checkoutDiscountValue;
    }, [checkoutDiscountType, checkoutDiscountValue, cartSubtotal]);

    const totalAfterDiscount = Math.max(0, cartSubtotal - discountAmount);
    const vatAmount = checkoutApplyVat ? totalAfterDiscount * (checkoutVatPercentage / 100) : 0;
    const cartTotal = totalAfterDiscount + vatAmount;

    // Projected Profit Calculations (Admin/Owner only)
    const isAdminOrOwner = user?.role === 'Admin' || user?.role === 'Dono';
    const cartTotalCost = useMemo(() => {
        return cart.reduce((sum, item) => sum + ((item.originalCost || 0) * item.quantity), 0);
    }, [cart]);

    const projectedProfit = totalAfterDiscount - cartTotalCost;
    const projectedMargin = totalAfterDiscount > 0 ? (projectedProfit / totalAfterDiscount) * 100 : 0;

    // Cart actions
    const addToCart = useCallback((product: typeof availableProducts[0]) => {
        setCart(prev => {
            const existing = prev.find(item => item.productName === product.name);
            if (existing) {
                // Check stock limit
                const newQty = existing.quantity + 1;
                if (newQty > product.availableStock) {
                    toast({ variant: 'destructive', title: 'Stock Insuficiente', description: `Apenas ${product.availableStock} ${product.unit || 'un'} disponíveis.` });
                    return prev;
                }
                return prev.map(item =>
                    item.productName === product.name
                        ? { ...item, quantity: newQty, subtotal: newQty * item.unitPrice }
                        : item
                );
            }
            return [...prev, {
                productId: product.stockInstance.id || product.id || '',
                productName: product.name,
                quantity: 1,
                unitPrice: product.price || 0,
                originalCost: product.cost || 0,
                unit: product.unit || 'un',
                location: selectedLocation || undefined,
                subtotal: product.price || 0,
            }];
        });
    }, [selectedLocation, toast, availableProducts]);

    const updateCartQuantity = useCallback((productName: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            setCart(prev => prev.filter(item => item.productName !== productName));
            return;
        }
        const product = availableProducts.find(p => p.name === productName);
        if (product && newQuantity > product.availableStock) {
            toast({ variant: 'destructive', title: 'Stock Insuficiente', description: `Apenas ${product.availableStock} ${product.unit || 'un'} disponíveis.` });
            return;
        }
        setCart(prev => prev.map(item =>
            item.productName === productName
                ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.unitPrice }
                : item
        ));
    }, [availableProducts, toast]);

    const updateCartPrice = useCallback((productName: string, newPrice: number) => {
        setCart(prev => prev.map(item =>
            item.productName === productName
                ? { ...item, unitPrice: newPrice, subtotal: item.quantity * newPrice }
                : item
        ));
    }, []);

    const removeFromCart = useCallback((productName: string) => {
        setCart(prev => prev.filter(item => item.productName !== productName));
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
        if (companyId) {
            localStorage.removeItem(`${CART_STORAGE_PREFIX}${companyId}`);
        }
    }, [companyId]);

    // Checkout
    const handleCheckout = async () => {
        if (!addBulkSale || !user || cart.length === 0) return;
        setIsSubmitting(true);

        try {
            // a barra puxada pelo carrinho enquanto grava
            const { finalCustomerId, created } = await haul('sale', 'A registar a venda…', 'Venda registada', async () => {
                // Resolve customer
                let finalCustomerId: string | undefined = checkoutCustomerId === 'new' ? undefined : checkoutCustomerId;

                if (checkoutClientName && !finalCustomerId) {
                    const normalizedName = checkoutClientName.trim();
                    const existing = customers.find(c => c.name.toLowerCase() === normalizedName.toLowerCase());
                    if (existing) {
                        finalCustomerId = existing.id;
                    } else {
                        try {
                            const newId = await addCustomer({ name: normalizedName });
                            if (newId) finalCustomerId = newId;
                        } catch (e) { console.error("Failed to auto-create customer:", e); }
                    }
                }

                const created = await addBulkSale(cart, {
                    customerId: finalCustomerId,
                    clientName: checkoutClientName || '',
                    documentType: checkoutDocType,
                    notes: checkoutNotes || '',
                    discount: { type: checkoutDiscountType, value: checkoutDiscountValue },
                    applyVat: checkoutApplyVat,
                    vatPercentage: checkoutVatPercentage,
                    isPickedUp: !checkoutPendingPickup,
                    // A data escolhida no formulário era ignorada (ficava sempre hoje).
                    date: isSameDay(checkoutDate, new Date()) ? new Date().toISOString() : new Date(checkoutDate.getFullYear(), checkoutDate.getMonth(), checkoutDate.getDate(), 12).toISOString(),
                });
                return { finalCustomerId, created: created || [] };
            });

            // "E agora?": enviar, imprimir, PDF, ver a venda ou vender outra vez — ou imprime logo, se este aparelho foi marcado assim
            const doneSale: DoneSale = { sales: created, items: cart, total: cartTotal, client: checkoutClientName.trim(), phone: customers.find(c => c.id === finalCustomerId)?.phone };
            if (created.length > 0) {
                if (getAfterSale() === 'print') printSale(doneSale, companyData);
                else setDone(doneSale);
            }

            clearCart();
            setIsCheckoutOpen(false);
            resetCheckoutForm();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Erro na Venda',
                description: error.message || 'Não foi possível registar a venda.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reter: guarda o carrinho e deixa o balcão livre; retomar troca com o que estiver a meio
    const holdCurrent = () => {
        if (!cart.length) return;
        saveHeld(holdCart(held, cart, new Date()));
        clearCart();
        setDrawerOpen(false);
        toast({ title: 'Carrinho retido', description: 'Retome-o em "Retidos" quando o cliente voltar.' });
    };
    const resumeHeld = (id: string) => {
        const r = resumeCart(held, id, cart, new Date());
        if (!r) return;
        saveHeld(r.list);
        setCart(r.cart);
        setHeldOpen(false);
    };

    const resetCheckoutForm = () => {
        setCheckoutDate(new Date());
        setCheckoutClientName('');
        setCheckoutCustomerId('new');
        setCheckoutDocType('Venda a Dinheiro');
        setCheckoutNotes('');
        setCheckoutApplyVat(false);
        setCheckoutVatPercentage(17);
        setCheckoutDiscountType('fixed');
        setCheckoutDiscountValue(0);
        setCheckoutPendingPickup(false);
    };

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
                        </div>
                    </div>
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }

    if (!canView('sales')) {
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="p-8 text-center">
                    <CardHeader>
                        <CardTitle>Acesso Negado</CardTitle>
                        <CardDescription>Não tem permissão para aceder ao ponto de venda.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 pb-32 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-bold flex items-center gap-3">
                        <ShoppingCart className="h-7 w-7 text-primary" />
                        Vender por toque
                    </h1>
                    <p className="text-muted-foreground">
                        Toque nos produtos e finalize a venda de uma só vez.
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    {held.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setHeldOpen(true)} data-testid="held-open">
                            <Clock className="mr-1.5 h-4 w-4" />Retidos ({held.length})
                        </Button>
                    )}
                    <Button asChild variant="outline" size="sm">
                        <Link href="/pos?modo=rapida"><Keyboard className="mr-1.5 h-4 w-4" />Escrever ou ler código</Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT: Product Grid */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Search & Filters */}
                    <Card className="glass-panel border-none p-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Input
                                    placeholder="Pesquisar produto..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-12 bg-background/50 text-foreground placeholder:text-muted-foreground"
                                />
                            </div>
                            {isMultiLocation && (
                                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                                    <SelectTrigger className="w-full sm:w-48 h-12">
                                        <SelectValue placeholder="Localização" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <LocationSelectItems locations={locations} />
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        {/* Category pills */}
                        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
                            {categories.map(cat => (
                                <Button
                                    key={cat}
                                    variant={selectedCategory === cat ? 'default' : 'outline'}
                                    size="sm"
                                    className="whitespace-nowrap rounded-full"
                                    onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                                >
                                    {cat === 'all' ? 'Todos' : cat}
                                </Button>
                            ))}
                        </div>
                    </Card>

                    {/* Product Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-4">
                        {filteredProducts.map(product => {
                            const inCart = cart.find(item => item.productName === product.name);
                            return (
                                <button
                                    key={product.id || product.name}
                                    onClick={() => addToCart(product)}
                                    className={`
                    relative group text-left rounded-xl border-2 transition-all duration-200
                    hover:shadow-lg hover:scale-[1.02] flex flex-col
                    ${inCart
                                            ? 'border-primary bg-primary/5 shadow-md'
                                            : 'border-border/50 bg-card hover:border-primary/50'
                                        }
                  `}
                                >
                                    <ProductPhoto src={product.imageUrl} alt={product.name} className="w-full h-32 rounded-t-xl" />
                                    <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                                        {inCart && (
                                            <div className="absolute -top-3 -right-3 bg-primary text-primary-foreground rounded-full min-w-[24px] h-6 px-1 flex items-center justify-center text-xs font-bold shadow-lg z-10 ring-2 ring-background">
                                                {inCart.quantity}
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <p className="font-semibold text-sm leading-tight line-clamp-2">{product.name}</p>
                                            <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>
                                            <div className="flex justify-between items-end">
                                                <span className="text-lg font-bold text-primary">{formatCurrency(product.price)}</span>
                                                <span className="text-xs text-muted-foreground">{product.availableStock} {product.unit || 'un'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* AI Cross-Selling Suggestions */}
                    {cart.length > 0 && (
                        <div className="mt-6 mb-2">
                            <AiSuggestions
                                cart={cart}
                                catalogProducts={availableProducts as any}
                                onAddToCart={addToCart as any}
                            />
                        </div>
                    )}

                    {filteredProducts.length === 0 && (
                        <Card className="p-8 text-center text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="font-medium">Nenhum produto encontrado</p>
                            <p className="text-sm">Tente ajustar a pesquisa ou filtros.</p>
                        </Card>
                    )}
                </div>

                {/* RIGHT: Cart (Desktop) */}
                <div className="hidden lg:block h-[calc(100vh-120px)] sticky top-24">
                    <PosCart
                        cart={cart}
                        cartSubtotal={cartSubtotal}
                        discountAmount={discountAmount}
                        checkoutApplyVat={checkoutApplyVat}
                        checkoutVatPercentage={checkoutVatPercentage}
                        vatAmount={vatAmount}
                        cartTotal={cartTotal}
                        onUpdateQuantity={updateCartQuantity}
                        onUpdatePrice={updateCartPrice}
                        onRemoveItem={removeFromCart}
                        onClearCart={clearCart}
                        onCheckout={() => setIsCheckoutOpen(true)}
                        onHold={holdCurrent}
                    />
                </div>
            </div>

            {/* MOBILE CART: Sticky Bottom Bar + Drawer */}
            <div className="lg:hidden">
                <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <DrawerTrigger asChild>
                        <div className="fixed bottom-16 md:bottom-0 left-0 w-full bg-background border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 flex items-center justify-between cursor-pointer active:bg-[rgba(0,0,0,0.05)] transition-colors touch-none select-none touch-manipulation pb-safe">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-sm font-bold shadow-sm">
                                    {cart.length}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-sm">Ver Carrinho</span>
                                    <span className="text-xs text-muted-foreground">{cart.length === 1 ? '1 item' : `${cart.length} itens`}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="text-lg font-bold text-primary">
                                    {formatCurrency(cartTotal)}
                                </div>
                                {isAdminOrOwner && cart.length > 0 && (
                                    <div className="text-[10px] text-muted-foreground flex gap-1 items-center">
                                        <span>Lucro:</span>
                                        <span className={projectedProfit > 0 ? 'text-emerald-500 font-semibold' : projectedProfit < 0 ? 'text-destructive font-semibold' : ''}>
                                            {formatCurrency(projectedProfit)} ({projectedMargin.toFixed(1)}%)
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DrawerTrigger>
                    <DrawerContent className="h-[85vh]">
                        <div className="h-full p-4">
                            <PosCart
                                cart={cart}
                                cartSubtotal={cartSubtotal}
                                discountAmount={discountAmount}
                                checkoutApplyVat={checkoutApplyVat}
                                checkoutVatPercentage={checkoutVatPercentage}
                                vatAmount={vatAmount}
                                cartTotal={cartTotal}
                                onUpdateQuantity={updateCartQuantity}
                                onUpdatePrice={updateCartPrice}
                                onRemoveItem={removeFromCart}
                                onClearCart={clearCart}
                                onCheckout={() => setIsCheckoutOpen(true)}
                                onHold={holdCurrent}
                                className="h-full border-none shadow-none"
                            />
                        </div>
                    </DrawerContent>
                </Drawer>
            </div>

            {/* Checkout Dialog */}
            <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-primary" />
                            Finalizar Venda
                        </DialogTitle>
                        <DialogDescription>
                            Confirme os detalhes da venda de {cart.length} {cart.length === 1 ? 'item' : 'itens'}.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[60vh]">
                        <div className="space-y-6 p-1">
                            {/* Items Summary */}
                            <div className="space-y-2 rounded-lg border p-3">
                                <h4 className="font-medium text-sm text-muted-foreground">Itens no Carrinho</h4>
                                {cart.map(item => (
                                    <div key={item.productName} className="flex justify-between text-sm">
                                        <span>{item.quantity}× {item.productName}</span>
                                        <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Customer */}
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label>Data da Venda</Label>
                                    <DatePicker date={checkoutDate} setDate={(d) => d && setCheckoutDate(d)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cliente Registado</Label>
                                    <Select value={checkoutCustomerId} onValueChange={setCheckoutCustomerId}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">-- Novo / Não Registado --</SelectItem>
                                            {customers.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Nome do Cliente (no documento)</Label>
                                    <Input
                                        value={checkoutClientName}
                                        onChange={e => setCheckoutClientName(e.target.value)}
                                        placeholder="Nome do cliente"
                                    />
                                </div>
                            </div>

                            {/* Document Type */}
                            <div className="space-y-2">
                                <Label>Tipo de Documento</Label>
                                <Select value={checkoutDocType} onValueChange={(v: any) => setCheckoutDocType(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Venda a Dinheiro">Venda a Dinheiro</SelectItem>
                                        <SelectItem value="Factura Proforma">Factura Proforma</SelectItem>
                                        <SelectItem value="Guia de Remessa">Guia de Remessa</SelectItem>
                                        <SelectItem value="Factura">Factura</SelectItem>
                                        <SelectItem value="Recibo">Recibo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Discount */}
                            <div className="space-y-3 rounded-lg border p-3">
                                <h4 className="font-medium text-sm text-muted-foreground">Desconto</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label>Tipo</Label>
                                        <Select value={checkoutDiscountType} onValueChange={(v: any) => setCheckoutDiscountType(v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fixed">Valor Fixo</SelectItem>
                                                <SelectItem value="percentage">Percentagem (%)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Valor</Label>
                                        <Input
                                            type="number"
                                            value={checkoutDiscountValue}
                                            onChange={e => setCheckoutDiscountValue(Number(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* VAT */}
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                    <Label>Aplicar IVA</Label>
                                    <p className="text-xs text-muted-foreground">Imposto sobre o valor acrescentado</p>
                                </div>
                                <Switch checked={checkoutApplyVat} onCheckedChange={setCheckoutApplyVat} />
                            </div>
                            {checkoutApplyVat && (
                                <div className="space-y-2">
                                    <Label>IVA (%)</Label>
                                    <Input
                                        type="number"
                                        value={checkoutVatPercentage}
                                        onChange={e => setCheckoutVatPercentage(Number(e.target.value))}
                                        placeholder="17"
                                    />
                                </div>
                            )}

                            {/* Pending Pickup Switch */}
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                    <Label>Agendar Levantamento</Label>
                                    <p className="text-xs text-muted-foreground">Marcar como não levantado (entrega posterior)</p>
                                </div>
                                <Switch checked={checkoutPendingPickup} onCheckedChange={setCheckoutPendingPickup} />
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label>Notas (opcional)</Label>
                                <Textarea
                                    value={checkoutNotes}
                                    onChange={e => setCheckoutNotes(e.target.value)}
                                    placeholder="Observações sobre a venda..."
                                />
                            </div>

                            {/* Totals */}
                            <div className="rounded-lg bg-muted p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-medium">{formatCurrency(cartSubtotal)}</span>
                                </div>
                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Desconto</span>
                                        <span className="font-medium text-red-500">- {formatCurrency(discountAmount)}</span>
                                    </div>
                                )}
                                {checkoutApplyVat && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">IVA ({checkoutVatPercentage}%)</span>
                                        <span className="font-medium">{formatCurrency(vatAmount)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between text-xl">
                                    <span className="font-bold">Total</span>
                                    <span className="font-bold text-primary">{formatCurrency(cartTotal)}</span>
                                </div>
                                {isAdminOrOwner && (
                                    <>
                                        <Separator />
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Custo Total (Produtos)</span>
                                            <span className="font-medium text-amber-600 dark:text-amber-500">{formatCurrency(cartTotalCost)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Lucro Projetado (S/Iva)</span>
                                            <span className={`font-medium ${projectedProfit > 0 ? 'text-emerald-500' : projectedProfit < 0 ? 'text-destructive' : ''}`}>
                                                {formatCurrency(projectedProfit)} ({projectedMargin.toFixed(1)}%)
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCheckout}
                            disabled={isSubmitting || cart.length === 0}
                            className="h-12 w-full text-base font-bold transition-all shadow-md hover:shadow-lg"
                        >
                            {isSubmitting ? 'A processar...' : `Confirmar ${formatCurrency(cartTotal)}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AfterSaleDialog done={done} onClose={(typed) => { setDone(null); if (typed) setSearchQuery(typed); }} />

            {/* Carrinhos retidos */}
            <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Carrinhos retidos</DialogTitle>
                        <DialogDescription>{cart.length ? 'O carrinho atual fica retido no lugar do que retomar.' : 'Toque para continuar a venda.'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        {held.map(h => (
                            <div key={h.id} className="flex items-center gap-2 rounded-xl border p-3">
                                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => resumeHeld(h.id)}>
                                    <p className="truncate text-sm font-semibold">{h.items.map(i => `${i.quantity}× ${i.productName}`).join(', ')}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(h.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {formatCurrency(h.total)}</p>
                                </button>
                                <Button size="sm" onClick={() => resumeHeld(h.id)}>Retomar</Button>
                                <Button size="icon" variant="ghost" aria-label="Apagar" onClick={() => saveHeld(held.filter(x => x.id !== h.id))}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
