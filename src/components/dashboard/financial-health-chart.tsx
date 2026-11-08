"use client"

import { useContext, useState, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { InventoryContext } from "@/context/inventory-context";
import { useFinance } from "@/context/finance-context";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { subMonths, startOfMonth, format, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { pt } from 'date-fns/locale';

type Period = '6m' | 'this_year';

export function FinancialHealthChart({ className }: { className?: string }) {
    const { sales, loading: inventoryLoading } = useContext(InventoryContext) || { sales: [], loading: true };
    const { expenses, loading: financeLoading } = useFinance();
    const [period, setPeriod] = useState<Period>('6m');

    const loading = inventoryLoading || financeLoading;

    // ... (rest of the component logic remains unchanged)

    const chartData = useMemo(() => {
        if (!sales || !expenses) return [];

        const now = new Date();
        let startDate: Date, endDate: Date;

        if (period === 'this_year') {
            startDate = startOfYear(now);
            endDate = endOfYear(now);
        } else {
            startDate = subMonths(now, 5); // 6 months total
            endDate = now;
        }

        startDate = startOfMonth(startDate);
        const monthInterval = eachMonthOfInterval({ start: startDate, end: endDate });

        return monthInterval.map(monthStart => {
            const monthSales = sales.filter(s => {
                const saleDate = new Date(s.date);
                return saleDate.getFullYear() === monthStart.getFullYear() && saleDate.getMonth() === monthStart.getMonth();
            }).reduce((sum, s) => sum + (s.amountPaid || s.totalValue), 0);

            const monthExpenses = expenses.filter(e => {
                const expenseDate = new Date(e.date);
                return expenseDate.getFullYear() === monthStart.getFullYear() && expenseDate.getMonth() === monthStart.getMonth();
            }).reduce((sum, e) => sum + e.amount, 0);

            const monthName = format(monthStart, 'MMM', { locale: pt });
            return {
                name: monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', ''),
                receitas: monthSales,
                despesas: monthExpenses,
                lucro: monthSales - monthExpenses
            };
        });

    }, [sales, expenses, period]);


    const chartConfig = {
        receitas: {
            label: "Receitas",
            color: "#22c55e", // Green
        },
        despesas: {
            label: "Despesas",
            color: "#ef4444", // Red
        },
    };

    if (loading) {
        return (
            <Card className="bg-transparent border-none">
                <CardHeader>
                    <Skeleton className="h-8 w-1/3 bg-slate-800" />
                </CardHeader>
                <CardContent className="p-6">
                    <Skeleton className="h-[300px] w-full bg-slate-800" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("glass-panel border-slate-200/50 dark:border-slate-800/50 shadow-none h-full", className)}>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2">
                <div>
                    <CardTitle className="text-xl text-foreground font-medium tracking-wide">Saúde Financeira</CardTitle>
                </div>
                <Select value={period} onValueChange={(value: Period) => setPeriod(value)}>
                    <SelectTrigger className="w-full md:w-[180px] bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-foreground">
                        <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-foreground">
                        <SelectItem value="6m">Últimos 6 Meses</SelectItem>
                        <SelectItem value="this_year">Este Ano</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="pl-2 pr-6 pt-4">
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800/60" />
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                fontSize={12}
                                stroke="currentColor"
                                className="text-muted-foreground"
                            />
                            <YAxis
                                tickFormatter={(value) => formatCurrency(value as number, { compact: true })}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                width={80}
                                fontSize={12}
                                stroke="currentColor"
                                className="text-muted-foreground"
                            />
                            <Tooltip
                                cursor={{ fill: 'var(--slate-100)', opacity: 0.1 }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-card/95 border-border rounded-xl shadow-xl p-4 text-xs">
                                                <p className="font-bold mb-2">{label}</p>
                                                {payload.map((entry: any, index: number) => (
                                                    <div key={index} className="flex items-center gap-2 mb-1">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                        <span className="text-muted-foreground capitalize">{entry.name}:</span>
                                                        <span className="font-bold">{formatCurrency(entry.value)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                                                    <span className="text-muted-foreground">Lucro:</span>
                                                    <span className={`font-bold ${payload[0].payload.lucro >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {formatCurrency(payload[0].payload.lucro)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend />
                            <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
