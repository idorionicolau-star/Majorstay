
"use client"

import { useContext, useState, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { InventoryContext } from "@/context/inventory-context";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subMonths, startOfYear, endOfYear, startOfMonth, format, eachMonthOfInterval, subYears, eachDayOfInterval, subDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { isCountableSale } from '@/lib/sale-filters';

type Period = '30d' | '6m' | 'this_year' | 'last_year';

export function MonthlySalesChart({ className }: { className?: string }) {
  const { sales, loading } = useContext(InventoryContext) || { sales: [], loading: true };
  const [period, setPeriod] = useState<Period>('6m');

  const chartData = useMemo(() => {
    if (!sales) return [];

    const now = new Date();

    if (period === '30d') {
      const startDate = subDays(now, 29); // 30 days including today
      const endDate = now;
      const dayInterval = eachDayOfInterval({ start: startDate, end: endDate });

      return dayInterval.map(day => {
        const daySales = sales.filter(s => {
          if (!isCountableSale(s)) return false;
          const saleDate = new Date(s.date);
          return saleDate.getFullYear() === day.getFullYear() &&
            saleDate.getMonth() === day.getMonth() &&
            saleDate.getDate() === day.getDate();
        }).reduce((sum, s) => sum + (s.amountPaid ?? s.totalValue), 0);

        const dayName = format(day, 'dd/MMM', { locale: pt });
        return {
          name: dayName,
          vendas: daySales,
        };
      });
    }

    let startDate: Date, endDate: Date;

    switch (period) {
      case 'this_year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case 'last_year':
        const lastYear = subYears(now, 1);
        startDate = startOfYear(lastYear);
        endDate = endOfYear(lastYear);
        break;
      case '6m':
      default:
        startDate = subMonths(now, 5);
        endDate = now;
        break;
    }

    startDate = startOfMonth(startDate);

    const monthInterval = eachMonthOfInterval({ start: startDate, end: endDate });

    const salesByMonth = monthInterval.map(monthStart => {
      const monthSales = sales.filter(s => {
        if (!isCountableSale(s)) return false;
        const saleDate = new Date(s.date);
        return saleDate.getFullYear() === monthStart.getFullYear() && saleDate.getMonth() === monthStart.getMonth();
      }).reduce((sum, s) => sum + (s.amountPaid ?? s.totalValue), 0);

      const monthName = format(monthStart, 'MMM', { locale: pt });
      return {
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', ''),
        vendas: monthSales,
      };
    });

    return salesByMonth;

  }, [sales, period]);


  const chartConfig = {
    vendas: {
      label: "Vendas",
      color: "hsl(var(--chart-1))",
    },
  };

  if (loading) {
    return (
      <Card className="bg-transparent border-none">
        <CardHeader>
          <Skeleton className="h-8 w-2/3 bg-slate-800" />
          <Skeleton className="h-4 w-1/2 bg-slate-800" />
        </CardHeader>
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full bg-slate-800" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("glass-panel border-slate-200/50 dark:border-slate-800/50 shadow-none h-full", className)}>
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-0">
        <div>
          <CardTitle className="text-xl text-foreground font-medium tracking-wide">Vendas ao Longo do Tempo</CardTitle>
        </div>
        <Select value={period} onValueChange={(value: Period) => setPeriod(value)}>
          <SelectTrigger className="w-full md:w-[180px] bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-foreground">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-foreground">
            <SelectItem value="30d">Diário (30 dias)</SelectItem>
            <SelectItem value="6m">Mensal (6 Meses)</SelectItem>
            <SelectItem value="this_year">Este Ano</SelectItem>
            <SelectItem value="last_year">Ano Passado</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pl-2 pr-6 pt-4">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--sales-gradient-start)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--sales-gradient-end)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
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
                cursor={{ stroke: 'var(--sales-stroke)', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={<ChartTooltipContent
                  formatter={(value) => (
                    <span className="font-bold" style={{ color: 'var(--sales-stroke)' }}>
                      {formatCurrency(value as number)}
                    </span>
                  )}
                  className="bg-card/95 border-border rounded-xl shadow-xl p-4"
                />}
              />
              <Area
                type="monotone"
                dataKey="vendas"
                stroke="var(--sales-stroke)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#fillVendas)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
