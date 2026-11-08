"use client";

import { useContext } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, Archive, Hash, ClipboardList, Hammer } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { InventoryContext } from "@/context/inventory-context";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function StatsCards() {
    const { dashboardStats, loading } = useContext(InventoryContext) || { 
      dashboardStats: {
        monthlySalesValue: 0,
        averageTicket: 0,
        totalInventoryValue: 0,
        totalItemsInStock: 0,
        pendingOrders: 0,
        readyForTransfer: 0,
      },
      loading: true 
    };

    if (loading) {
        return (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
        );
    }
    
    const stats = [
        {
          title: "Vendas (Mês)",
          value: dashboardStats.monthlySalesValue,
          isCurrency: true,
          icon: DollarSign,
          href: "/sales",
          color: "text-chart-2"
        },
        {
          title: "Ticket Médio",
          value: dashboardStats.averageTicket,
          isCurrency: true,
          icon: TrendingUp,
          href: "/reports",
          color: "text-chart-2"
        },
        {
          title: "Valor do Inventário",
          value: dashboardStats.totalInventoryValue,
          isCurrency: true,
          icon: Archive,
          href: "/inventory",
          color: "text-chart-3"
        },
        {
          title: "Itens em Estoque",
          value: dashboardStats.totalItemsInStock,
          isCurrency: false,
          icon: Hash,
          href: "/inventory",
          color: "text-chart-3"
        },
        {
          title: "Encomendas Pendentes",
          value: dashboardStats.pendingOrders,
          isCurrency: false,
          icon: ClipboardList,
          href: "/orders",
          color: "text-primary"
        },
        {
          title: "Pronto p/ Transferir",
          value: dashboardStats.readyForTransfer,
          isCurrency: false,
          icon: Hammer,
          href: "/production",
          color: "text-primary"
        },
      ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <TooltipProvider>
        {stats.map((stat) => (
            <Link href={stat.href} key={stat.title} className="group">
              <Card className="glass-card relative transition-all duration-300 hover:shadow-neon-cyan hover:-translate-y-1">
                  <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary animate-pulse-indicator"></div>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-semibold">{stat.title}</CardTitle>
                      <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {stat.isCurrency ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={`text-2xl font-bold ${stat.color} cursor-pointer`}>
                                    <span className="sm:hidden">{formatCurrency(stat.value)}</span>
                                    <span className="hidden sm:inline">{formatCurrency(stat.value, { compact: true })}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="hidden sm:block">
                                <p>{formatCurrency(stat.value)}</p>
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <div className={`text-2xl font-bold ${stat.color}`}>
                            {typeof stat.value === 'number' ? stat.value.toLocaleString('pt-BR') : stat.value}
                        </div>
                    )}
                  </CardContent>
              </Card>
            </Link>
        ))}
      </TooltipProvider>
    </div>
  );
}
