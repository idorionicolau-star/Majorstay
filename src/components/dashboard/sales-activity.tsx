
"use client";

import { useContext } from "react";
import { InventoryContext } from "@/context/inventory-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Activity } from 'lucide-react';
import type { Sale } from "@/lib/types";

export function SalesActivity() {
  const { sales, loading } = useContext(InventoryContext) || { sales: [], loading: true };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const names = name.split(' ');
    if (names.length > 1 && names[0] && names[names.length - 1]) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Sort sales by date and get the most recent 5
  const recentSales = sales
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <Card className="glass-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
            <Activity />
            Atividade de Vendas
        </CardTitle>
        <CardDescription>As últimas 5 vendas registadas no sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-muted/50 space-y-2">
                  <Skeleton className="h-10 w-10 rounded-full mx-auto" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-6 w-3/4 mx-auto" />
                  <Skeleton className="h-4 w-1/2 mx-auto" />
              </div>
            ))}
          </div>
        ) : recentSales.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {recentSales.map((sale: Sale) => (
              <div key={sale.id} className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted/50 text-center">
                  <Avatar className="h-10 w-10 mb-2">
                    <AvatarFallback className="bg-primary/20 text-primary font-bold">
                      {getInitials(sale.soldBy)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-semibold truncate w-full" title={sale.productName}>{sale.productName}</p>
                  <p className="text-sm font-bold">{formatCurrency(sale.totalValue)}</p>
                  <p className="text-xs text-muted-foreground">{sale.quantity} un. por {sale.soldBy}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma venda registada ainda.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
