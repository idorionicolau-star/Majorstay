
"use client";

import { useContext, useState, useMemo } from "react";
import { InventoryContext } from "@/context/inventory-context";
import { useFinance } from "@/context/finance-context";
import { cn, formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
    isToday, isYesterday, subDays, parseISO,
    startOfWeek, endOfWeek, subWeeks,
    startOfMonth, endOfMonth, subMonths,
    isWithinInterval,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { Timestamp } from "firebase/firestore";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isCountableSale, saleIncome } from '@/lib/sale-filters';

type Period = 'daily' | 'weekly' | 'monthly';

const MIN_SALES_FOR_TREND = 5;

export const PrimaryKPIs = () => {
    const { dashboardStats, sales, loading, products, stockMovements } = useContext(InventoryContext) || {
        dashboardStats: null,
        sales: [],
        products: [],
        stockMovements: [],
        loading: true
    };
    const { expenses } = useFinance();
    const [period, setPeriod] = useState<Period>('daily');

    const kpiData = useMemo(() => {
        if (loading || !sales || !dashboardStats || !products || !stockMovements) return null;

        const now = new Date();
        let currentPeriodSales: typeof sales;
        let previousPeriodSales: typeof sales;
        let trendLabel = '';
        let capitalTrendPeriod = 1; // days

        switch (period) {
            case 'weekly':
                const startOfThisWeek = startOfWeek(now, { locale: pt });
                const endOfThisWeek = endOfWeek(now, { locale: pt });
                const startOfLastWeek = startOfWeek(subWeeks(now, 1), { locale: pt });
                const endOfLastWeek = endOfWeek(subWeeks(now, 1), { locale: pt });

                currentPeriodSales = sales.filter(s => isCountableSale(s) && isWithinInterval(parseISO(s.date), { start: startOfThisWeek, end: endOfThisWeek }));
                previousPeriodSales = sales.filter(s => isCountableSale(s) && isWithinInterval(parseISO(s.date), { start: startOfLastWeek, end: endOfLastWeek }));
                trendLabel = "vs semana ant.";
                capitalTrendPeriod = 7;
                break;
            case 'monthly':
                const startOfThisMonth = startOfMonth(now);
                const endOfThisMonth = endOfMonth(now);
                const startOfLastMonth = startOfMonth(subMonths(now, 1));
                const endOfLastMonth = endOfMonth(subMonths(now, 1));

                currentPeriodSales = sales.filter(s => isCountableSale(s) && isWithinInterval(parseISO(s.date), { start: startOfThisMonth, end: endOfThisMonth }));
                previousPeriodSales = sales.filter(s => isCountableSale(s) && isWithinInterval(parseISO(s.date), { start: startOfLastMonth, end: endOfLastMonth }));
                trendLabel = "vs mês ant.";
                capitalTrendPeriod = 30;
                break;
            case 'daily':
            default:
                currentPeriodSales = sales.filter(s => isCountableSale(s) && isToday(parseISO(s.date)));
                previousPeriodSales = sales.filter(s => isCountableSale(s) && isYesterday(parseISO(s.date)));
                trendLabel = "vs ontem";
                capitalTrendPeriod = 1;
                break;
        }

        // Calculate Profit
        const currentPeriodExpenses = expenses.filter(e => {
            const date = parseISO(e.date);
            if (period === 'daily') return isToday(date);
            if (period === 'weekly') return isWithinInterval(date, { start: startOfWeek(new Date(), { locale: pt }), end: endOfWeek(new Date(), { locale: pt }) });
            if (period === 'monthly') return isWithinInterval(date, { start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
            return false;
        });

        const previousPeriodExpenses = expenses.filter(e => {
            const date = parseISO(e.date);
            if (period === 'daily') return isYesterday(date);
            // ... simplified previous period logic for expenses matching standard periods ...
            // Actually, let's reuse the interval logic if possible, but for now simple approximation:
            return false; // Skip trend for profit for now to match simplicity or implement fully
        });

        // Full implementation for expenses trend:
        let expenseStart: Date, expenseEnd: Date, prevExpenseStart: Date, prevExpenseEnd: Date;

        if (period === 'daily') {
            expenseStart = new Date(now.setHours(0, 0, 0, 0)); expenseEnd = new Date(now.setHours(23, 59, 59, 999));
            prevExpenseStart = subDays(expenseStart, 1); prevExpenseEnd = subDays(expenseEnd, 1);
        } else if (period === 'weekly') {
            expenseStart = startOfWeek(now, { locale: pt }); expenseEnd = endOfWeek(now, { locale: pt });
            prevExpenseStart = startOfWeek(subWeeks(now, 1), { locale: pt }); prevExpenseEnd = endOfWeek(subWeeks(now, 1), { locale: pt });
        } else {
            expenseStart = startOfMonth(now); expenseEnd = endOfMonth(now);
            prevExpenseStart = startOfMonth(subMonths(now, 1)); prevExpenseEnd = endOfMonth(subMonths(now, 1));
        }

        const currentExpensesVal = expenses
            .filter(e => isWithinInterval(parseISO(e.date), { start: expenseStart, end: expenseEnd }))
            .reduce((sum, e) => sum + e.amount, 0);

        const prevExpensesVal = expenses
            .filter(e => isWithinInterval(parseISO(e.date), { start: prevExpenseStart, end: prevExpenseEnd }))
            .reduce((sum, e) => sum + e.amount, 0);

        const currentCOGS = currentPeriodSales.reduce((sum, s) => sum + (s.quantity * (s.unitCost || 0)), 0);
        const prevCOGS = previousPeriodSales.reduce((sum, s) => sum + (s.quantity * (s.unitCost || 0)), 0);

        const currentProfit = currentPeriodSales.reduce((sum, s) => sum + saleIncome(s), 0) - currentCOGS - currentExpensesVal;
        const prevProfit = previousPeriodSales.reduce((sum, s) => sum + saleIncome(s), 0) - prevCOGS - prevExpensesVal;

        const profitGrowth = prevProfit !== 0 ? ((currentProfit - prevProfit) / Math.abs(prevProfit)) * 100 : (currentProfit > 0 ? 100 : 0);


        const currentSalesValue = currentPeriodSales.reduce((sum, s) => sum + saleIncome(s), 0);
        const previousSalesValue = previousPeriodSales.reduce((sum, s) => sum + saleIncome(s), 0);

        const salesGrowth = previousSalesValue > 0
            ? ((currentSalesValue - previousSalesValue) / previousSalesValue) * 100
            : (currentSalesValue > 0 ? 100 : 0);

        // uma venda com vários produtos são várias linhas: o ticket conta vendas (nº do documento), não linhas
        const tickets = (list: typeof sales) => new Set(list.map(s => s.guideNumber || s.id)).size;
        const currentTickets = tickets(currentPeriodSales), previousTickets = tickets(previousPeriodSales);
        const currentAvgTicket = currentTickets > 0 ? currentSalesValue / currentTickets : 0;
        const previousAvgTicket = previousTickets > 0 ? previousSalesValue / previousTickets : 0;
        // produtos vendidos sem custo: o lucro sai a mais (sem custo = lucro de 100%)
        const noCost = new Set(currentPeriodSales.filter(s => !(s.unitCost && s.unitCost > 0)).map(s => s.productName)).size;
        const allNoCost = currentPeriodSales.length > 0 && currentPeriodSales.every(s => !(s.unitCost && s.unitCost > 0));

        const ticketGrowth = previousAvgTicket > 0
            ? ((currentAvgTicket - previousAvgTicket) / previousAvgTicket) * 100
            : (currentAvgTicket > 0 ? 100 : 0);

        const periodAgo = subDays(now, capitalTrendPeriod);

        const productPriceMap = new Map<string, number>();
        products.forEach(p => {
            if (p.id) { // Use catalog product ID which is more stable
                productPriceMap.set(p.id, p.price);
            }
        });

        const inventoryValueChange = stockMovements
            .filter(m => m.timestamp && (m.timestamp as Timestamp).toDate() > periodAgo)
            .reduce((netChange, movement) => {
                const price = productPriceMap.get(movement.productId);
                if (price === undefined || movement.type === 'TRANSFER') {
                    return netChange;
                }
                return netChange + (movement.quantity * price);
            }, 0);

        const currentInventoryValue = dashboardStats.totalInventoryValue;
        const inventoryValuePeriodAgo = currentInventoryValue - inventoryValueChange;

        const capitalGrowth = inventoryValuePeriodAgo > 0
            ? ((currentInventoryValue - inventoryValuePeriodAgo) / inventoryValuePeriodAgo) * 100
            : (currentInventoryValue > 0 ? 100 : 0);

        // Com poucas vendas no período anterior, qualquer variação parece um desastre
        // (ex.: -97%). Só comparamos quando há base suficiente.
        const hasBase = previousPeriodSales.length >= MIN_SALES_FOR_TREND;

        return {
            hasBase,
            salesGrowth,
            ticketGrowth,
            capitalGrowth,
            currentPeriodSales: currentSalesValue,
            currentAvgTicket,
            currentProfit,
            profitGrowth,
            noCost,
            allNoCost,
            trendLabel
        };
    }, [sales, dashboardStats, products, stockMovements, expenses, loading, period]);


    if (loading || !kpiData) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                <Skeleton className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                <Skeleton className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                <Skeleton className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                <Skeleton className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
        )
    }

    const periodLabels = {
        daily: 'Diário',
        weekly: 'Semanal',
        monthly: 'Mensal'
    };

    const cards = [
        {
            title: `FATURAMENTO (${periodLabels[period].toUpperCase()})`,
            value: kpiData.currentPeriodSales,
            href: "/sales",
            trend: kpiData.hasBase ? kpiData.salesGrowth : null,
            trendLabel: kpiData.hasBase ? kpiData.trendLabel : "poucos dados para comparar",
            colorClass: "kpi-card--green",
        },
        {
            title: "VALOR EM STOCK",
            value: dashboardStats.totalInventoryValue,
            href: "/inventory",
            trend: kpiData.capitalGrowth,
            trendLabel: `vs ult. ${period === 'daily' ? '24h' : period === 'weekly' ? '7d' : '30d'}`,
            colorClass: "kpi-card--blue",
            invertTrend: true, // Aumento de capital imobilizado = mau (dinheiro preso em stock)
        },
        {
            title: `TICKET MÉDIO (${periodLabels[period].toUpperCase()})`,
            value: kpiData.currentAvgTicket,
            href: "/reports",
            trend: kpiData.hasBase ? kpiData.ticketGrowth : null,
            trendLabel: kpiData.hasBase ? kpiData.trendLabel : "poucos dados para comparar",
            colorClass: "kpi-card--purple",
        },
        {
            title: `LUCRO LÍQUIDO (${periodLabels[period].toUpperCase()})`,
            value: kpiData.currentProfit,
            // sem custo nos produtos vendidos o "lucro" seria igual ao faturamento: não mostramos um número enganador
            display: kpiData.allNoCost ? "Faltam custos" : undefined,
            href: kpiData.noCost ? "/inventory" : "/finance",
            trend: kpiData.hasBase && !kpiData.noCost ? kpiData.profitGrowth : null,
            trendLabel: kpiData.allNoCost ? "registe o custo dos produtos"
                : kpiData.noCost ? `${kpiData.noCost} produto${kpiData.noCost > 1 ? 's' : ''} sem custo: lucro a mais`
                : kpiData.hasBase ? kpiData.trendLabel : "poucos dados para comparar",
            colorClass: "kpi-card--orange", // Define orange class in CSS or just use utility if configured
        },
    ];

    return (
        <div>
            <div className="flex justify-center mb-2">
                <Tabs defaultValue="daily" value={period} onValueChange={(value) => setPeriod(value as Period)}>
                    <TabsList className="h-8">
                        <TabsTrigger value="daily" className="text-xs px-3 h-6">Diário</TabsTrigger>
                        <TabsTrigger value="weekly" className="text-xs px-3 h-6">Semanal</TabsTrigger>
                        <TabsTrigger value="monthly" className="text-xs px-3 h-6">Mensal</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card, index) => {
                    const isPositive = (card.trend || 0) >= 0;
                    const TrendIcon = card.trend === null || card.trend === 0 ? Minus : (isPositive ? TrendingUp : TrendingDown);

                    // For invertTrend cards (like Capital Imobilizado), positive = bad (red), negative = good (green)
                    const isGood = card.invertTrend ? !isPositive : isPositive;
                    const trendColor = card.trend === null || card.trend === 0
                        ? "text-slate-400"
                        : isGood ? "text-[var(--card-color)]" : "text-rose-500 dark:text-rose-400";

                    const trendText = card.trend === null || !isFinite(card.trend) ? "" : `${isPositive ? '+' : ''}${card.trend?.toFixed(1)}%`;

                    return (
                        <Link href={card.href} key={index} className="block group">
                            <div className={cn(
                                "bg-white dark:bg-slate-800 rounded-2xl p-4 relative overflow-hidden border hover:-translate-y-1 transition-transform duration-300 cursor-pointer",
                                card.colorClass
                            )}>
                                <div className="relative z-10 flex flex-col h-full items-center justify-center text-center">
                                    <p className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">{card.title}</p>
                                    <h2 className="text-2xl font-bold" style={{ color: `var(--card-color)` }}>
                                        {card.display ?? formatCurrency(card.value, { compact: true })}
                                    </h2>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className={cn("flex items-center text-xs font-bold gap-0.5", trendColor)}>
                                            {trendText && <TrendIcon className="h-3 w-3" />}
                                            {trendText}
                                        </span>
                                        <span className="text-slate-400 text-[10px]">{card.trendLabel}</span>
                                    </div>
                                </div>

                                <div className="absolute bottom-0 left-0 w-full h-1.5 rounded-b-2xl bg-slate-200 dark:bg-slate-700/50 overflow-hidden">
                                    <div
                                        className="h-full"
                                        style={{
                                            backgroundColor: `var(--card-color)`,
                                            width: card.trend !== null && isFinite(card.trend) ? `${Math.min(Math.abs(card.trend || 0), 100)}%` : '0%'
                                        }}
                                    />
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    );
};
