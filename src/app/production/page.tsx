"use client";
import { locationLabel } from '@/lib/sites';
import { isProductionInStock } from "@/lib/production";

import { useState, useEffect, useMemo, useContext } from "react";
import { useSearchParams } from 'next/navigation';
import { ProductionDataTable } from "@/components/production/data-table";
import { columns } from "@/components/production/columns";
import type { Production, Location, ModulePermission } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { List, LayoutGrid, ChevronDown, Lock, MapPin, Trash2, PlusCircle, Plus, Printer, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ToastAction } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ProductionCard } from "@/components/production/production-card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { InventoryContext } from "@/context/inventory-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirestore } from '@/firebase/provider';
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DatePicker } from "@/components/ui/date-picker";
import { isSameDay, format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { forwardRef } from 'react';
import { ProductionPlan } from "@/components/production/production-plan";

// Os contentores da grelha são criados uma vez por número de colunas: se fossem criados a cada render, cada
// actualização desmontava os cartões e fechava os painéis abertos (ex.: "Editar produção").
const productionGrids = new Map<string, { List: React.ComponentType<any>; Item: React.ComponentType<any> }>();
function productionGrid(gridCols: string) {
  let g = productionGrids.get(gridCols);
  if (!g) {
    const List = forwardRef<HTMLDivElement>((props, ref) => (
      <div {...props} ref={ref} className={cn(
        "grid gap-2 sm:gap-4 pb-20",
        gridCols === '3' && "grid-cols-2 sm:grid-cols-3",
        gridCols === '4' && "grid-cols-2 sm:grid-cols-4",
        gridCols === '5' && "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5"
      )} />
    ));
    List.displayName = 'ProductionVirtuosoList';
    const Item = forwardRef<HTMLDivElement>((props, ref) => <div {...props} ref={ref} className="h-full" />);
    Item.displayName = 'ProductionVirtuosoItem';
    g = { List, Item };
    productionGrids.set(gridCols, g);
  }
  return g;
}

export default function ProductionPage() {
  const inventoryContext = useContext(InventoryContext);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [nameFilter, setNameFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [view, setView] = useState<'list' | 'grid'>('grid');
  const [gridCols, setGridCols] = useState<'3' | '4' | '5'>('4');
  const [productionToTransfer, setProductionToTransfer] = useState<Production | null>(null);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { productions, companyId, companyData, updateProductStock, loading: inventoryLoading, user, canEdit, canView, locations, isMultiLocation, deleteProduction, updateProduction, confirmAction, isReadOnly } = inventoryContext || { productions: [], companyId: null, companyData: null, updateProductStock: () => { }, loading: true, user: null, canEdit: () => false, canView: () => false, locations: [], isMultiLocation: false, deleteProduction: () => { }, updateProduction: () => { }, confirmAction: () => { }, isReadOnly: false };

  const canEditProduction = canEdit('production');
  const canViewProduction = canView('production');
  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    if (searchParams.get('action') === 'add' && canEditProduction) {
      router.push('/production/new');
    }
  }, [searchParams, canEditProduction, router]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('majorstockx-production-view') as 'list' | 'grid';
      const savedGridCols = localStorage.getItem('majorstockx-production-grid-cols') as '3' | '4' | '5';
      if (savedView) setView(savedView);
      if (savedGridCols) setGridCols(savedGridCols);
    }
  }, []);

  const handleSetView = (newView: 'list' | 'grid') => {
    setView(newView);
    localStorage.setItem('majorstockx-production-view', newView);
  }

  const handleSetGridCols = (cols: '3' | '4' | '5') => {
    setGridCols(cols);
    localStorage.setItem('majorstockx-production-grid-cols', cols);
  }



  const handleConfirmTransfer = async () => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
      return;
    }
    if (!productionToTransfer || !firestore || !companyId) return;
    if (isProductionInStock(productionToTransfer)) {
      toast({ title: "Já está no inventário", description: "Esta produção entrou no stock no momento do registo." });
      return;
    }

    try {
      await updateProductStock(productionToTransfer.productName, productionToTransfer.quantity, productionToTransfer.location);

      const prodDocRef = doc(firestore, `companies/${companyId}/productions`, productionToTransfer.id);
      await updateDoc(prodDocRef, { status: 'Transferido' });

      toast({
        title: "Transferência Concluída",
        description: `${productionToTransfer.quantity} unidades de ${productionToTransfer.productName} foram adicionadas ao inventário.`,
        action: (
          <ToastAction altText="Ver no Inventário" onClick={() => router.push(`/inventory?search=${encodeURIComponent(productionToTransfer.productName)}`)}>
            Ver no Inventário
          </ToastAction>
        ),
      });

      setProductionToTransfer(null);
    } catch (error: any) {
      console.error("Erro na transferência:", error);
      toast({
        variant: "destructive",
        title: "Erro na Transferência",
        description: error.message || "Não foi possível transferir para o inventário.",
      });
    }
  };

  const handleDeleteProduction = async (productionId: string) => {
    try {
      await deleteProduction(productionId);
      // Local state update not strictly needed if context uses listeners, but good for consistency
    } catch (error: any) {
      // Error handled in context
    }
  };

  const filteredProductions = useMemo(() => {
    let result = productions;
    if (nameFilter) {
      result = result.filter(p => p.productName.toLowerCase().includes(nameFilter.toLowerCase()));
    }
    if (isMultiLocation && locationFilter !== 'all') {
      result = result.filter(p => p.location === locationFilter);
    }
    if (dateFilter) {
      result = result.filter(p => isSameDay(new Date(p.date), dateFilter));
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [productions, nameFilter, locationFilter, isMultiLocation, dateFilter]);

  const handlePrintReport = () => {
    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<!DOCTYPE html><html><head><title>Relatório de Produção</title>');
      printWindow.document.write(`
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
            `);
      printWindow.document.write(`
                <style>
                    body { font-family: 'PT Sans', sans-serif; line-height: 1.6; color: #333; margin: 2rem; }
                    .container { max-width: 1000px; margin: auto; padding: 2rem; border: 1px solid #eee; border-radius: 8px; }
                    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 1rem; margin-bottom: 2rem; }
                    .header h1 { font-family: 'Space+Grotesk', sans-serif; font-size: 2rem; color: #3498db; margin: 0; }
                    .logo { display: flex; flex-direction: column; align-items: flex-start; }
                    .logo span { font-family: 'Space+Grotesk', sans-serif; font-size: 1.5rem; font-weight: bold; color: #3498db; }
                    table { width: 100%; border-collapse: collapse; margin-top: 2rem; font-size: 10px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f9fafb; font-family: 'Space+Grotesk', sans-serif; }
                    .footer { text-align: center; margin-top: 3rem; font-size: 0.8rem; color: #999; }
                    @page { size: A4 landscape; margin: 0.5in; }
                    @media print {
                      body { margin: 0; -webkit-print-color-adjust: exact; }
                      .no-print { display: none; }
                      .container { border: none; box-shadow: none; }
                    }
                </style>
            `);
      printWindow.document.write('</head><body><div class="container">');
      printWindow.document.write(`
                <div class="header">
                     <div class="logo">
                        <span>${companyData?.name || 'MajorStockX'}</span>
                    </div>
                    <h1>Relatório de Produção</h1>
                </div>
                <h2>Data: ${new Date().toLocaleDateString('pt-BR')}</h2>
            `);

      printWindow.document.write('<table><thead><tr><th>Data</th><th>Produto</th><th>Qtd.</th><th>Unidade</th><th>Localização</th><th>Registado por</th><th>Status</th></tr></thead><tbody>');
      filteredProductions.forEach(prod => {
        printWindow.document.write(`
                    <tr>
                        <td>${format(new Date(prod.date), 'dd/MM/yyyy')}</td>
                        <td>${prod.productName}</td>
                        <td>${prod.quantity}</td>
                        <td>${prod.unit || 'un.'}</td>
                        <td>${locations.find(l => l.id === prod.location)?.name || 'N/A'}</td>
                        <td>${prod.registeredBy}</td>
                        <td>${prod.status}</td>
                    </tr>
                `);
      });
      printWindow.document.write('</tbody></table>');

      printWindow.document.write(`<div class="footer"><p>${companyData?.name || 'MajorStockX'} &copy; ${new Date().getFullYear()}</p></div>`);
      printWindow.document.write('</div></body></html>');
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    }
  };

  const handleDownloadPdfReport = async () => {
    try {
      const { generateProductionPDF } = await import('@/lib/pdf-generator');
      generateProductionPDF(filteredProductions, companyData, locations);
      toast({
        title: "Relatório gerado",
        description: "Relatório de produção gerado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar o relatório PDF.",
        variant: "destructive",
      });
    }
  };

  if (inventoryLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-8 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={!!productionToTransfer} onOpenChange={(open) => !open && setProductionToTransfer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Transferência</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja transferir <span className="font-bold">{productionToTransfer?.quantity}</span> unidades de <span className="font-bold">{productionToTransfer?.productName}</span> para o inventário {isMultiLocation && `da localização "${locations.find(l => l.id === productionToTransfer?.location)?.name}"`}? Esta ação irá atualizar o stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTransfer}>Confirmar e Transferir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-headline font-bold">Produção</h1>
          </div>
          <div className="flex items-center gap-2" data-tour="prod-print">
            <Button onClick={handleDownloadPdfReport} variant="outline" className="h-12">
              <Download className="mr-2 h-4 w-4" />
              Baixar PDF
            </Button>
            <Button onClick={handlePrintReport} variant="outline" className="h-12">
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>

        {searchParams.get('planear') === '1' && (
          <ProductionPlan canRegister={canEditProduction && !isReadOnly} onClose={() => router.replace('/production')} />
        )}

        <Card className="glass-panel p-4 mb-6 border-none" data-tour="prod-filters">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Input
                placeholder="Filtrar por nome do produto..."
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                className="w-full sm:max-w-xs shadow-sm h-12 text-sm bg-background/50"
              />
              <div className="flex w-full sm:w-auto items-center gap-2">
                <DatePicker date={dateFilter} setDate={setDateFilter} />
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-border/50 pt-4">
              <div className="hidden md:flex items-center gap-2">
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
              <ScrollArea
                className="w-full md:w-auto pb-2"
              >
                <div className="flex items-center gap-2">
                  {isMultiLocation && canViewProduction && (
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
                          <TooltipContent>
                            <p>Filtrar por Localização</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align="end">
                        <ScrollArea className="h-48">
                          <DropdownMenuLabel>Filtrar por Localização</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem checked={locationFilter === 'all'} onCheckedChange={() => setLocationFilter('all')}>Todas</DropdownMenuCheckboxItem>
                          {locations.map(loc => (
                            <DropdownMenuCheckboxItem key={loc.id} checked={locationFilter === loc.id} onCheckedChange={() => setLocationFilter(loc.id)}>{locationLabel(loc)}</DropdownMenuCheckboxItem>
                          ))}
                        </ScrollArea>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <ScrollBar orientation="horizontal" className="md:hidden" />
              </ScrollArea>
            </div>
          </div>
        </Card>

        <div className="hidden md:block" data-tour="prod-list">
          {view === 'list' ? (
            <ProductionDataTable columns={columns({ onDeleteProduction: handleDeleteProduction, canEdit: canEditProduction })} data={filteredProductions} />
          ) : (
            <VirtuosoGrid
              useWindowScroll
              increaseViewportBy={500}
              data={filteredProductions}
              totalCount={filteredProductions.length}
              components={productionGrid(gridCols)}
              itemContent={(index, production) => (
                <ProductionCard
                  key={production.id}
                  production={production}
                  onTransfer={() => setProductionToTransfer(production)}
                  onDelete={handleDeleteProduction}
                  onUpdate={updateProduction}
                  viewMode={gridCols === '5' ? 'condensed' : 'normal'}
                  canEdit={canEditProduction}
                  locationName={locations.find(l => l.id === production.location)?.name}
                />
              )}
            />
          )}
        </div>

        <div className="md:hidden" data-tour="prod-list">
          {filteredProductions.length > 0 ? (
            <Virtuoso
              useWindowScroll
              increaseViewportBy={500}
              data={filteredProductions}
              itemContent={(index, production) => (
                <div className="pb-3">
                  <ProductionCard
                    key={production.id}
                    production={production}
                    onTransfer={() => setProductionToTransfer(production)}
                    onDelete={handleDeleteProduction}
                    onUpdate={updateProduction}
                    viewMode='normal'
                    canEdit={canEditProduction}
                    locationName={locations.find(l => l.id === production.location)?.name}
                  />
                </div>
              )}
            />
          ) : (
            <Card className="text-center py-12 text-muted-foreground">
              Nenhum registo de produção encontrado.
            </Card>
          )}
        </div>


        {canEditProduction && (
          <>
            <Button
              data-tour="prod-add"
              onClick={() => router.push('/production/new')}
              disabled={isReadOnly}
              title={isReadOnly ? "Indisponível em modo leitura" : ""}
              className="fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-lg z-20"
              size="icon"
            >
              <Plus className="h-6 w-6" />
              <span className="sr-only">Adicionar Produção</span>
            </Button>
          </>
        )}
      </div>
    </>
  );
}
