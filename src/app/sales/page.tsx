"use client";

import { locationLabel, matchesLocationFilter, siteFilter, sitesOf } from '@/lib/sites';
import { useState, useEffect, useMemo, useContext } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import type { Sale } from "@/lib/types";
import { columns } from "@/components/sales/columns";
import { SalesDataTable } from "@/components/sales/sales-data-table";
import { VirtualSalesGrid } from "@/components/sales/virtual-sales-grid";

import { Button } from "@/components/ui/button";
import { List, LayoutGrid, ChevronDown, Filter, MapPin, PlusCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import Link from 'next/link';
import { InventoryContext } from "@/context/inventory-context";
import { Skeleton } from "@/components/ui/skeleton";
import { useSaleActions } from "@/components/sales/use-sale-actions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DatePicker } from "@/components/ui/date-picker";
import { Card } from "@/components/ui/card";
import { useFuse } from "@/hooks/use-fuse";
import { DeepLinkBanner } from "@/components/deep-link-banner";
// Removed useFirestorePagination and firestore query imports

export default function SalesPage() {
  const searchParams = useSearchParams();
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [view, setView] = useState<'list' | 'grid'>('grid');
  const [gridCols, setGridCols] = useState<'3' | '4' | '5'>('3');

  const [locationFilter, setLocationFilter] = useState<string>('all');
  const router = useRouter();
  // Chegou por um aviso? `venda` = número da guia, ou nome do produto (lista das mais recentes primeiro); `statusFilter` = estado.
  const [linkFocus, setLinkFocus] = useState<string | null>(null);
  useEffect(() => {
    const venda = searchParams.get('venda');
    const st = searchParams.get('statusFilter');
    if (st) setStatusFilter(st);
    if (venda) setNameFilter(venda);
    setLinkFocus(venda || st || null);
  }, [searchParams]);
  const clearLinkFocus = () => { setNameFilter(''); setStatusFilter('all'); setLinkFocus(null); router.replace('/sales'); };
  const inventoryContext = useContext(InventoryContext);

  const {
    loading: inventoryLoading,
    sales: contextSales,
    addSale,
    companyId,
    canEdit,
    canView,
    locations,
    isMultiLocation,
  } = inventoryContext || {
    loading: true,
    sales: [],
    addSale: async () => { },
    companyId: null,
    canEdit: () => false,
    canView: () => false,
    locations: [],
    isMultiLocation: false,
  };

  const canEditSales = canEdit('sales');
  const canViewSales = canView('sales');

  // --- Client-Side Filtering & Sorting (Mimicking InventoryPage) ---
  const preFilteredSales = useMemo(() => {
    if (!contextSales) return [];
    let result = [...contextSales];

    // 1. Status Filter
    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }

    // 2. Location Filter
    if (isMultiLocation && locationFilter !== 'all') {
      result = result.filter(s => matchesLocationFilter(locationFilter, s.location, locations));
    }

    // 3. Date Filter
    if (dateFilter) {
      const start = new Date(dateFilter);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateFilter);
      end.setHours(23, 59, 59, 999);
      result = result.filter(s => {
        const d = new Date(s.date);
        return d >= start && d <= end;
      });
    }

    // 4. Exclude Deleted
    result = result.filter(s => !s.deletedAt);

    // 5. Sort by Date Descending
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return result;
  }, [contextSales, statusFilter, locationFilter, dateFilter, isMultiLocation, locations]);

  const filteredSales = useFuse(preFilteredSales, nameFilter, { keys: ['productName', 'clientName', 'guideNumber'] });

  // Use filteredSales for display. No more manual pagination.
  const sales = filteredSales;
  const salesLoading = inventoryLoading; // Use inventory loading state


  const handleSetView = (newView: 'list' | 'grid') => {
    setView(newView);
    localStorage.setItem('majorstockx-sales-view', newView);
  }

  const handleSetGridCols = (cols: '3' | '4' | '5') => {
    setGridCols(cols);
    localStorage.setItem('majorstockx-sales-grid-cols', cols);
  }

  const { updateSale: handleUpdateSale, confirmPickup: handleConfirmPickup, removeSale: handleDeleteSale } = useSaleActions();

  if (!companyId) {
    return <div className="p-10 text-center"><Skeleton className="h-10 w-full" /></div>
  }

  return (
    <>
      <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Histórico de Vendas</h1>
            <p className="text-muted-foreground">Consulte o histórico de vendas e saídas de stock.</p>
          </div>
          {canEditSales && (
            <Button asChild data-tour="sales-add" className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <Link href="/pos">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova venda
              </Link>
            </Button>
          )}
        </div>

        <Card className="glass-panel p-4 border-none shrink-0">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Input
                data-tour="sales-search"
                placeholder="Filtrar por produto (nome)..."
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                className="w-full sm:max-w-xs shadow-sm h-12 text-sm bg-background/50"
              />
              <div className="flex flex-col w-full sm:flex-row sm:w-auto items-center gap-2" data-tour="sales-date">
                <DatePicker date={dateFilter} setDate={setDateFilter} />
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-border/50 pt-4">
              <div className="hidden md:flex items-center gap-2" data-tour="sales-view">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant={view === 'list' ? 'default' : 'outline'} size="icon" onClick={() => handleSetView('list')} className="h-12 w-12 hidden md:flex bg-background/50">
                        <List className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Vista de Lista</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant={view === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => handleSetView('grid')} className="h-12 w-12 hidden md:flex bg-background/50">
                        <LayoutGrid className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Vista de Grelha</p></TooltipContent>
                  </Tooltip>
                  {view === 'grid' && (
                    <div className="hidden md:flex">
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="h-12 w-28 gap-2 bg-background/50">
                                <span>{gridCols} Colunas</span>
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent><p>Número de colunas</p></TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent>
                          <DropdownMenuRadioGroup value={gridCols} onValueChange={(value) => handleSetGridCols(value as '3' | '4' | '5')}>
                            <DropdownMenuRadioItem value="3">3 Colunas</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="4">4 Colunas</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="5">5 Colunas</DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </TooltipProvider>
              </div>

              <div className="flex items-center gap-2" data-tour="sales-filter">
                <DropdownMenu>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="shadow-sm h-12 w-12 flex-shrink-0 bg-background/50" size="icon">
                            <Filter className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent><p>Filtrar por Status</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuLabel>Filtrar por Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                      <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="Pago">Pago</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="Levantado">Levantado</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {isMultiLocation && (
                  <DropdownMenu>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-12 w-12 flex-shrink-0 bg-background/50" size="icon">
                              <MapPin className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent><p>Filtrar por Localização</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      <DropdownMenuLabel>Filtrar por Local</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup value={locationFilter} onValueChange={setLocationFilter}>
                        <DropdownMenuRadioItem value="all">Todas</DropdownMenuRadioItem>
                        {sitesOf(locations).length > 1 && sitesOf(locations).map(site => (
                          <DropdownMenuRadioItem key={site} value={siteFilter(site)}>Ponto {site} (tudo)</DropdownMenuRadioItem>
                        ))}
                        {locations.map(loc => (
                          <DropdownMenuRadioItem key={loc.id} value={loc.id}>{locationLabel(loc)}</DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </Card>

        {inventoryLoading || salesLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            {linkFocus && (
              <DeepLinkBanner
                title={searchParams.get('venda') ? `Vendas: “${searchParams.get('venda')}” (${sales.length})` : `Vendas ${searchParams.get('statusFilter')} (${sales.length})`}
                hint={searchParams.get('venda') ? 'As mais recentes primeiro — a de cima foi a última a sair.' : undefined}
                count={sales.length}
                onClear={clearLinkFocus}
              />
            )}
            <div className="space-y-4" data-tour="sales-list">
              {view === 'list' ? (
                <SalesDataTable
                  columns={columns({
                    onUpdateSale: handleUpdateSale,
                    onConfirmPickup: handleConfirmPickup,
                    onDeleteSale: handleDeleteSale,
                    canEdit: canEditSales
                  })}
                  data={sales}
                  useVirtualization={true}
                />
              ) : (
                <VirtualSalesGrid
                  sales={sales}
                  onUpdateSale={handleUpdateSale}
                  onConfirmPickup={handleConfirmPickup}
                  onDeleteSale={handleDeleteSale}
                  canEdit={canEditSales}
                  locations={locations}
                  gridCols={gridCols}
                />
              )}

              {!salesLoading && sales.length === 0 && (
                <Card className="text-center py-12 text-muted-foreground mt-4">
                  Nenhuma venda encontrada com os filtros atuais.
                </Card>
              )}

              {sales.length > 0 && (
                <div className="flex items-center justify-between py-4">
                  <div className="flex-1 text-sm text-muted-foreground">
                    Total de {sales.length} vendas encontradas.
                  </div>
                </div>
              )}
            </div>
          </>
        )}


      </div>
    </>
  );
}
