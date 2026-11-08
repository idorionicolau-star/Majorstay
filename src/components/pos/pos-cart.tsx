
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Trash2, X, Minus, Plus, CreditCard, AlertTriangle, PauseCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { CartItem } from '@/lib/types';
import { useState, useEffect } from 'react';
import { useInventory } from '@/context/inventory-context';

// A local component to handle quantity input smoothly without losing cursor or decimal points
function QuantityInput({
    initialValue,
    onChange
}: {
    initialValue: number;
    onChange: (val: number) => void;
}) {
    const [localValue, setLocalValue] = useState(initialValue.toString());

    useEffect(() => {
        setLocalValue(initialValue.toString());
    }, [initialValue]);

    const handleBlur = () => {
        const num = Number(localValue);
        if (!isNaN(num) && num > 0) {
            onChange(num);
        } else {
            setLocalValue(initialValue.toString());
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        const num = Number(val);
        // Only update parent if it's a valid number and greater than 0
        // and doesn't end with a dot (so user can type "1.5")
        if (!isNaN(num) && num > 0 && !val.endsWith('.') && !val.endsWith(',')) {
            onChange(num);
        }
    };

    return (
        <Input
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-16 h-8 text-center border-none shadow-none focus-visible:ring-0 p-0 font-medium"
        />
    );
}

// A local component to handle price input
function PriceInput({
    initialValue,
    onChange
}: {
    initialValue: number;
    onChange: (val: number) => void;
}) {
    const [localValue, setLocalValue] = useState(initialValue.toString());

    useEffect(() => {
        setLocalValue(initialValue.toString());
    }, [initialValue]);

    const handleBlur = () => {
        const num = Number(localValue);
        if (!isNaN(num) && num >= 0) {
            onChange(num);
        } else {
            setLocalValue(initialValue.toString());
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        const num = Number(val);
        // Only trigger onChange if it's a valid positive number
        if (!isNaN(num) && num >= 0 && !val.endsWith('.') && !val.endsWith(',')) {
            onChange(num);
        }
    };

    return (
        <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs">MT</span>
            <Input
                type="text"
                inputMode="decimal"
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-16 h-7 text-right px-1 py-0 shadow-sm text-xs font-semibold focus-visible:ring-1"
            />
        </div>
    );
}

interface PosCartProps {
    cart: CartItem[];
    cartSubtotal: number;
    discountAmount: number;
    checkoutApplyVat: boolean;
    checkoutVatPercentage: number;
    vatAmount: number;
    cartTotal: number;
    onUpdateQuantity: (productName: string, quantity: number) => void;
    onUpdatePrice: (productName: string, newPrice: number) => void;
    onRemoveItem: (productName: string) => void;
    onClearCart: () => void;
    onCheckout: () => void;
    /** Reter carrinho: guarda-o e deixa o balcão livre */
    onHold?: () => void;
    className?: string;
}

export function PosCart({
    cart,
    cartSubtotal,
    discountAmount,
    checkoutApplyVat,
    checkoutVatPercentage,
    vatAmount,
    cartTotal,
    onUpdateQuantity,
    onUpdatePrice,
    onRemoveItem,
    onClearCart,
    onCheckout,
    onHold,
    className
}: PosCartProps) {
    const { isReadOnly } = useInventory();
    return (
        <Card className={`border-none shadow-sm h-full flex flex-col bg-card ${className}`}>
            <CardHeader className="pb-4 pt-6 px-6 flex-none">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-xl">
                        <ShoppingCart className="h-6 w-6 text-primary" />
                        Carrinho
                        {cart.length > 0 && (
                            <Badge variant="default" className="ml-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-2.5 min-w-[24px] h-6 flex items-center justify-center">
                                {cart.length}
                            </Badge>
                        )}
                    </CardTitle>
                    {cart.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClearCart}
                            disabled={isReadOnly}
                            title={isReadOnly ? "Indisponível em modo leitura" : ""}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 -mr-2"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Limpar
                        </Button>
                    )}
                </div>
            </CardHeader>
            <Separator className="opacity-50" />
            <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                        <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                            <ShoppingCart className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                        <h3 className="font-semibold text-lg text-foreground">O carrinho está vazio</h3>
                        <p className="text-muted-foreground mt-2 max-w-[200px]">
                            Selecione produtos do catálogo para iniciar uma venda.
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="flex-1">
                        <div className="divide-y divide-border/50">
                            {cart.map(item => (
                                <div key={item.productName} className="p-5 hover:bg-muted/30 transition-colors group">
                                    {/* Top Row: Name and Remove */}
                                    <div className="flex justify-between items-start gap-4 mb-4">
                                        <div className="flex items-center gap-2">
                                            {item.productName}
                                            {item.originalCost !== undefined && item.originalCost > 0 && (
                                                (() => {
                                                    // Calculate effective price after global discount
                                                    // Assuming discountAmount is a global discount applied proportionally
                                                    const itemProportion = item.subtotal / (cartSubtotal || 1);
                                                    const itemDiscount = discountAmount * itemProportion;
                                                    const effectivePrice = (item.subtotal - itemDiscount) / item.quantity;

                                                    if (effectivePrice <= item.originalCost) {
                                                        return (
                                                            <div title={`Atenção! Preço efetivo (${formatCurrency(effectivePrice)}) está abaixo ou igual ao preço de custo (${formatCurrency(item.originalCost)}). Venda com prejuízo.`}>
                                                                <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => onRemoveItem(item.productName)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>

                                    <div className="flex items-end justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 bg-background border rounded-lg p-0.5 shadow-sm">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-md hover:bg-muted"
                                                    onClick={() => onUpdateQuantity(item.productName, item.quantity - 1)}
                                                >
                                                    <Minus className="h-3.5 w-3.5" />
                                                </Button>
                                                <QuantityInput
                                                    initialValue={item.quantity}
                                                    onChange={(val) => onUpdateQuantity(item.productName, val)}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-md hover:bg-muted"
                                                    onClick={() => onUpdateQuantity(item.productName, item.quantity + 1)}
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                            <div className="flex items-center gap-1 mt-1 pl-1">
                                                <PriceInput
                                                    initialValue={item.unitPrice}
                                                    onChange={(val) => onUpdatePrice(item.productName, val)}
                                                />
                                                <span className="text-[10px] text-muted-foreground">x {item.quantity} {item.unit || 'un'}</span>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="block font-bold text-lg text-primary tracking-tight">
                                                {formatCurrency(item.subtotal)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}

                {/* Footer */}
                {cart.length > 0 && (
                    <div className="flex-none p-6 bg-background border-t shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] z-10">
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal ({cart.length} itens)</span>
                                <span className="font-medium text-foreground">{formatCurrency(cartSubtotal)}</span>
                            </div>

                            {discountAmount > 0 && (
                                <div className="flex justify-between text-sm animate-in fade-in slide-in-from-bottom-2">
                                    <span className="text-muted-foreground">Desconto</span>
                                    <span className="font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded text-xs">
                                        - {formatCurrency(discountAmount)}
                                    </span>
                                </div>
                            )}

                            {checkoutApplyVat && (
                                <div className="flex justify-between text-sm animate-in fade-in slide-in-from-bottom-2">
                                    <span className="text-muted-foreground">IVA ({checkoutVatPercentage}%)</span>
                                    <span className="font-medium">{formatCurrency(vatAmount)}</span>
                                </div>
                            )}

                            <Separator />

                            <div className="flex justify-between items-baseline pt-1">
                                <span className="text-lg font-bold text-foreground">Total</span>
                                <span className="text-2xl font-bold text-primary tracking-tight">{formatCurrency(cartTotal)}</span>
                            </div>
                        </div>

                        <Button
                            className="w-full h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all active:scale-[0.99]"
                            size="lg"
                            onClick={onCheckout}
                            disabled={isReadOnly}
                            title={isReadOnly ? "Indisponível em modo leitura" : ""}
                        >
                            <CreditCard className="mr-2 h-5 w-5" />
                            Finalizar Venda
                        </Button>
                        {onHold && (
                            <Button variant="ghost" className="mt-2 w-full" onClick={onHold} data-testid="hold-cart">
                                <PauseCircle className="mr-2 h-4 w-4" />Reter carrinho (o cliente volta já)
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card >
    );
}
