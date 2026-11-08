"use client";
import { SiteTotals } from "@/components/dashboard/site-totals";
import { PendingShipmentsBanner } from "@/components/inventory/pending-shipments-banner";

import { useContext } from "react";
import { InventoryContext } from "@/context/inventory-context";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessSummary } from "@/components/dashboard/business-summary";
import { KPISkeleton } from "@/components/dashboard/kpi-skeleton";
import { PanelSkeleton } from "@/components/dashboard/panel-skeleton";

// Static Imports
import { PrimaryKPIs } from "@/components/dashboard/primary-kpis";
import { MonthlySalesChart } from "@/components/dashboard/monthly-sales-chart";
import { FinancialHealthChart } from "@/components/dashboard/financial-health-chart";
import { TopSales } from "@/components/dashboard/top-sales";
import { StockAlerts } from "@/components/dashboard/stock-alerts";
import { EmptyStateWelcome } from "@/components/dashboard/empty-state";
import { GettingStartedCard } from "@/components/onboarding/getting-started-card";

// Removed dynamic imports to prevent circular dependency issues in production build
// The loading state is handled by the main component logic below


export default function DashboardPage() {
  const { user, products, catalogProducts, loading } = useContext(InventoryContext) || { user: null, products: [], catalogProducts: [], loading: true };
  const isPrivilegedUser = user?.role === 'Admin' || user?.role === 'Dono';

  if (loading) {
    return (
      <div className="flex flex-col gap-4 pb-10 main-content">
        <KPISkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Fallback skeleton grid if needed, but KPISkeleton covers it */}
        </div>
        <PanelSkeleton />
      </div>
    );
  }

  // SHOW WELCOME SCREEN IF NO PRODUCTS AND NO CATALOG
  // If the user has a catalog but no inventory, they should see the dashboard to start working.
  // We only show welcome screen if the system is completely empty.
  if (!loading && products.length === 0 && (!catalogProducts || catalogProducts.length === 0)) {
    return <EmptyStateWelcome />;
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-700 pb-10 main-content">

      {isPrivilegedUser && <GettingStartedCard />}

      {/* envios que chegaram e esperam confirmação (transferências com confirmação de receção) */}
      <PendingShipmentsBanner />

      {/* 1. Hoje · Atalhos · Atenção — o que se precisa ao abrir a app */}
      <BusinessSummary />

      {/* vários pontos (lojas): quanto vende e quanto tem cada um */}
      {isPrivilegedUser && <SiteTotals />}

      {isPrivilegedUser ? (
        <>
          {/* 2. Análise detalhada — para quem quer ir mais fundo */}
          <h2 className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Números e gráficos</h2>
          <div data-tour="dash-kpis"><PrimaryKPIs /></div>


          {/* 3. Charts & Insights Section - Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3" data-tour="dash-chart">
              <MonthlySalesChart className="h-full" />
            </div>
            <div className="lg:col-span-1">
              <TopSales className="h-full" />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-4">
              <FinancialHealthChart className="h-full" />
            </div>
          </div>

          {/* Row 3 - Stock Alerts (as perguntas ao assistente estão na Pesquisa Rápida) */}
          <StockAlerts className="md:max-h-[450px]" />
        </>
      ) : (
        <Card className="glass-panel h-[400px] flex flex-col justify-center items-center">
          <CardHeader>
            <CardTitle className="text-xl text-slate-400 flex items-center gap-3">
              <Lock strokeWidth={1.5} className="h-6 w-6" />
              Acesso Restrito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base text-slate-500 max-w-md text-center">
              As estatísticas avançadas e o dashboard financeiro estão disponíveis apenas para o Dono ou Administrador.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
