"use client";

import { useState, useMemo, useContext, useEffect } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { InventoryContext } from "@/context/inventory-context";
import {
    Zap,
    TrendingDown,
    ArrowRight,
    Loader2,
    AlertTriangle,
    Target,
    BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function TacticalInsights({ className }: { className?: string }) {
    const context = useContext(InventoryContext);
    const { products, sales, loading, firebaseUser } = context || { products: [], sales: [], loading: true, firebaseUser: null };

    const [insights, setInsights] = useState<{
        title: string;
        action: string;
        impact: string;
        reason: string;
        priority: 'high' | 'medium' | 'low';
    }[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Identify Dead Stock & Capital Tied Up
    const deadStockData = useMemo(() => {
        if (!products || !sales) return { items: [], totalValue: 0 };

        const soldProductNames = new Set(sales.map(s => s.productName));
        const unsold = products.filter(p => !soldProductNames.has(p.name) && p.stock > 0);

        const sorted = unsold.sort((a, b) => (b.stock * (b.cost || 0)) - (a.stock * (a.cost || 0)));
        const totalValue = unsold.reduce((sum, p) => sum + (p.stock * (p.cost || 0)), 0);

        return {
            items: sorted.slice(0, 5),
            totalValue
        };
    }, [products, sales]);

    const generateTacticalOrders = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        setError(null);

        try {
            const fbToken = await firebaseUser?.getIdToken();

            // Calculate Rupture Data
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const productSalesVelocity = new Map<string, number>();
            sales.forEach(s => {
                const rawDate: any = (s as any).date ?? (s as any).timestamp; const saleDate = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
                if (saleDate >= thirtyDaysAgo) {
                    const current = productSalesVelocity.get(s.productName) || 0;
                    productSalesVelocity.set(s.productName, current + (s.quantity || 0));
                }
            });

            const criticalRuptures = products
                .map(p => {
                    const totalSold30d = productSalesVelocity.get(p.name) || 0;
                    const ads = totalSold30d / 30;
                    const availableStock = p.stock - p.reservedStock;
                    const daysOfStock = ads > 0 ? Math.floor(availableStock / ads) : Infinity;
                    return { ...p, ads, daysOfStock };
                })
                .filter(p => p.daysOfStock <= 5)
                .sort((a, b) => a.daysOfStock - b.daysOfStock)
                .slice(0, 5);

            const promptContext = {
                type: "TACTICAL_INSIGHTS",
                deadStock: deadStockData.items.map(p => ({
                    name: p.name,
                    stock: p.stock,
                    cost: p.cost,
                    price: p.price,
                    capitalTied: p.stock * (p.cost || 0)
                })),
                ruptureRisks: criticalRuptures.map(p => ({
                    name: p.name,
                    stock: p.stock,
                    ads: p.ads,
                    daysRemaining: p.daysOfStock
                })),
                totalDeadStockValue: deadStockData.totalValue,
                inventoryValue: context?.dashboardStats?.totalInventoryValue || 0
            };

            const response = await fetch('/api/assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${fbToken}`
                },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: `Analisa os meus dados reais de inventário abaixo:\n\nDead Stock:\n${JSON.stringify(promptContext.deadStock)}\n\nRiscos de Ruptura:\n${JSON.stringify(promptContext.ruptureRisks)}\n\nCapital Imobilizado Total: ${promptContext.totalDeadStockValue} MT\nValor Total do Inventário: ${promptContext.inventoryValue} MT\n\nGera 3 ordens táticas prioritárias. Se houver rupturas iminentes (daysRemaining < 5), uma das ordens DEVE ser de reabastecimento proativo com o nome do produto específico. Se houver capital imobilizado alto, foque na liquidação. Responde APENAS em formato JSON: { "insights": [{ "title": "...", "action": "...", "impact": "...", "reason": "...", "priority": "high" | "medium" | "low" }] }`
                    }],
                    context: promptContext,
                    userId: firebaseUser?.uid,
                    companyId: context?.companyId
                })
            });

            const data = await response.json();

            // Extract JSON from response (Gemini sometimes adds markdown blocks)
            let text = data.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                setInsights(parsed.insights || []);
            } else {
                throw new Error("Formato de resposta inválido.");
            }

        } catch (err) {
            console.error("Tactical Generation Error:", err);
            setError("Não foi possível gerar ordens táticas. Tente novamente.");
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (!loading && insights.length === 0 && (deadStockData.items.length > 0 || products.length > 0)) {
            generateTacticalOrders();
        }
    }, [loading, deadStockData.items.length, products.length, insights.length]);

    return (
        <Card className={cn("glass-panel border-none shadow-xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white", className)}>
            <CardHeader className="pb-2 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                            <Target className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold tracking-tight">Ordens Táticas IA</CardTitle>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Inteligência Estratégica</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={generateTacticalOrders}
                        disabled={isGenerating}
                        className="h-8 text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                    >
                        {isGenerating ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Zap className="h-3 w-3 mr-2" />}
                        Recalcular
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div className="p-4 bg-white/5 border-b border-white/5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Capital Imobilizado</p>
                            <h3 className="text-2xl font-black text-white mt-1">
                                {formatCurrency(deadStockData.totalValue)}
                            </h3>
                        </div>
                        <div className="px-3 py-1.5 bg-rose-500/20 rounded-lg border border-rose-500/30">
                            <div className="flex items-center gap-1.5">
                                <TrendingDown className="h-4 w-4 text-rose-400" />
                                <span className="text-xs font-bold text-rose-400">Eficiência Crítica</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        Tens {deadStockData.items.length}+ produtos sem rotação. Segue as ordens abaixo para recuperar liquidez.
                    </p>
                </div>

                <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                    <AnimatePresence mode="popLayout">
                        {isGenerating && insights.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                                <p className="text-sm font-medium text-slate-400">Major Assistant a analisar stock...</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                                <AlertTriangle className="h-8 w-8 text-amber-500" />
                                <p className="text-sm text-slate-400">{error}</p>
                                <Button size="sm" variant="outline" onClick={generateTacticalOrders}>Tentar Novamente</Button>
                            </div>
                        ) : (
                            insights.map((insight, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="relative group lg:col-span-1"
                                >
                                    <div className={cn(
                                        "p-4 rounded-xl border transition-all duration-300",
                                        insight.priority === 'high'
                                            ? "bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15"
                                            : "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/15"
                                    )}>
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <h4 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                                                {insight.title}
                                            </h4>
                                            <span className={cn(
                                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                                insight.priority === 'high' ? "bg-rose-500 text-white" : "bg-indigo-500 text-white"
                                            )}>
                                                {insight.priority === 'high' ? 'Crítico' : 'Tático'}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                                <ArrowRight className="h-3 w-3 text-indigo-400 shrink-0" />
                                                <p>{insight.action}</p>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-bold bg-emerald-500/10 w-fit px-2 py-1 rounded-md">
                                                <BarChart3 className="h-3 w-3" />
                                                <span>Impacto: {insight.impact}</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
}
