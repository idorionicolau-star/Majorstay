"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Plus, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Product, CartItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';

interface AiSuggestionsProps {
    cart: CartItem[];
    catalogProducts: Product[];
    onAddToCart: (product: Product) => void;
}

export function AiSuggestions({ cart, catalogProducts, onAddToCart }: AiSuggestionsProps) {
    const [suggestions, setSuggestions] = useState<Product[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasGenerated, setHasGenerated] = useState(false);
    const { toast } = useToast();

    // If the cart is empty, we don't need to show suggestions based on nothing
    if (cart.length === 0) {
        return null;
    }

    const generateSuggestions = async () => {
        setIsGenerating(true);

        try {
            const auth = getAuth();
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error('Utilizador não autenticado');

            const token = await currentUser.getIdToken();

            const response = await fetch('/api/suggest-upsell', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    cartItems: cart,
                    catalogItems: catalogProducts,
                }),
            });

            if (!response.ok) {
                throw new Error('Falha ao obter sugestões');
            }

            const data = await response.json();

            if (data.suggestions && Array.isArray(data.suggestions)) {
                // Map the IDs back to the actual catalog products
                const matchedProducts = data.suggestions
                    .map((id: string) => catalogProducts.find(p => p.id === id))
                    .filter((p: Product | undefined): p is Product => p !== undefined);

                setSuggestions(matchedProducts);
                setHasGenerated(true);
            } else {
                setSuggestions([]);
                setHasGenerated(true);
            }
        } catch (error: any) {
            console.error('Error fetching suggestions:', error);
            toast({
                title: 'Erro de IA',
                description: 'Não foi possível gerar sugestões neste momento.',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Card className="mt-4 p-4 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-primary font-semibold">
                    <Sparkles className="h-5 w-5" />
                    <span>IA Major Stock (Cross-Selling)</span>
                </div>

                {!hasGenerated && (
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={generateSuggestions}
                        disabled={isGenerating || catalogProducts.length === 0}
                        className="h-8 text-xs font-medium"
                    >
                        {isGenerating ? (
                            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> A Processar</>
                        ) : (
                            'Sugerir Combos'
                        )}
                    </Button>
                )}
            </div>

            {hasGenerated && suggestions.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                    Nenhuma sugestão óbvia encontrada para este carrinho neste momento.
                </p>
            )}

            {suggestions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {suggestions.map((product) => (
                        <div
                            key={`sugg-${product.id}`}
                            className="bg-background rounded-lg border p-3 flex flex-col justify-between hover:border-primary/50 transition-colors"
                        >
                            <div>
                                <h4 className="font-medium text-sm line-clamp-2" title={product.name}>
                                    {product.name}
                                </h4>
                                <p className="text-primary font-semibold mt-1 text-sm">
                                    {formatCurrency(product.price)}
                                </p>
                            </div>

                            <Button
                                size="sm"
                                className="w-full mt-3 h-8"
                                variant="outline"
                                onClick={() => {
                                    onAddToCart({ ...product, stockInstance: product, availableStock: 0 } as Product);
                                    // Remove this suggestion visually once added
                                    setSuggestions(prev => prev.filter(p => p.id !== product.id));
                                }}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Adicionar
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {hasGenerated && (
                <div className="flex justify-end mt-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={generateSuggestions}
                        disabled={isGenerating}
                        className="h-6 text-[10px] text-muted-foreground hover:text-primary"
                    >
                        {isGenerating ? 'A atualizar...' : 'Atualizar Sugestões'}
                    </Button>
                </div>
            )}
        </Card>
    );
}
