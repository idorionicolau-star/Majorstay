
"use client";

import { locationLabel, matchesLocationFilter, siteFilter, sitesOf } from '@/lib/sites';
import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { findByBarcode } from "@/lib/barcode";
import { UNKNOWN_CODE } from "@/lib/scan-gate";
import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import type { Product, Location, ModulePermission } from "@/lib/types";
import { columns } from "@/components/inventory/columns";
import { InventoryDataTable } from "@/components/inventory/data-table";
import { Button } from "@/components/ui/button";
import { FileText, ListFilter, MapPin, List, LayoutGrid, ChevronDown, Plus, ChevronsUpDown, Printer, Download, ScanBarcode, ClipboardList, WandSparkles, MoreHorizontal, Truck } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/inventory/product-card";
import { FamilyRow, ProductRow } from "@/components/inventory/product-row";
import { FamilyCard } from "@/components/inventory/family-card";
import { groupFamilies, isFamilyGroup, variantLabel, type FamilyGroup } from "@/lib/variants";
import { ProductsTabs } from "@/components/inventory/products-tabs";
import { ReservedDriftBanner } from "@/components/inventory/reserved-drift-banner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useInventory } from "@/context/inventory-context";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
import { isSameDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { formatCurrency, normalizeString, plural } from "@/lib/utils";
import { generateInventoryReportPDF } from "@/lib/pdf-generator";
import { Virtuoso } from 'react-virtuoso';


import { useFuse } from "@/hooks/use-fuse";
import { DeepLinkBanner } from "@/components/deep-link-banner";
import { parseInventoryFocus, applyInventoryFocus, hasInventoryFocus, inventoryFocusTitle, rememberInventoryUrl } from "@/lib/deep-links";

type SortKey = 'stock_desc' | 'stock_asc' | 'name_asc' | 'date_desc';

const SORT_LABELS: Record<SortKey, string> = {
  stock_desc: 'Maior stock',
  stock_asc: 'Menor stock',
  name_asc: 'Nome (A-Z)',
  date_desc: 'Mais recentes',
};

export default function InventoryPage() {
  const {
    products,
    locations,
    allLocations,
    isMultiLocation,
    addProduct,
    updateProduct,
    deleteProduct,
    clearProductsCollection,
    loading: inventoryLoading,
    canEdit,
    canView,
    user,
    companyData,
    confirmAction,
    syncSmartThresholds,
    setAutoThresholds,
    isReadOnly,
    catalogProducts,
  } = useInventory();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Produtos do catálogo que ainda não têm stock (criados no Catálogo sem quantidade): não aparecem na lista abaixo
  const withoutStock = useMemo(() => {
    const inStock = new Set((products || []).map((p) => normalizeString(p.name)));
    return (catalogProducts || []).filter((c) => !inStock.has(normalizeString(c.name)));
  }, [products, catalogProducts]);
  // Um só formulário para criar um produto: o do Catálogo (com "quanto tem agora?"). Sem acesso ao catálogo, o antigo.
  const newProductHref = canView('settings') ? '/catalog?novo=1' : '/inventory/new';
  // Chegou por um aviso (notificação, diagnóstico)? Mostra só o caso pedido.
  const focus = useMemo(() => parseInventoryFocus(searchParams), [searchParams]);
  // Editar um produto e voltar regressa aqui com o mesmo filtro (ver useInventoryBackHref).
  useEffect(() => {
    const q = searchParams.toString();
    rememberInventoryUrl(q ? `/inventory?${q}` : '/inventory');
  }, [searchParams]);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [nameFilter, setNameFilter] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  // null = ainda não escolhido: decide-se pela quantidade de produtos com foto.
  const [view, setView] = useState<'list' | 'grid' | null>(null);
  const [gridCols, setGridCols] = useState<'3' | '4' | '5'>('3');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(60);

  useEffect(() => {
    const handleResize = () => {
      setItemsPerPage(window.innerWidth >= 768 ? 60 : 10);
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [sortBy, setSortBy] = useState<SortKey>('date_desc');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { toast } = useToast();


  const canEditInventory = canEdit('inventory');
  const canViewInventory = canView('inventory');
  const isAdmin = user?.role === 'Admin';


  useEffect(() => {
    const productFilter = searchParams.get('filter');
    if (productFilter) {
      setNameFilter(decodeURIComponent(productFilter));
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('majorstockx-inventory-view') as 'list' | 'grid';
      const savedGridCols = localStorage.getItem('majorstockx-inventory-grid-cols') as '3' | '4' | '5';
      if (savedView) setView(savedView);
      if (savedGridCols) setGridCols(savedGridCols);
    }
  }, []);

  const handleSetView = (newView: 'list' | 'grid') => {
    setView(newView);
    localStorage.setItem('majorstockx-inventory-view', newView);
  }

  const handleSetGridCols = (cols: '3' | '4' | '5') => {
    setGridCols(cols);
    localStorage.setItem('majorstockx-inventory-grid-cols', cols);
  }



  const handleUpdateProduct = async (updatedProduct: Product) => {
    if (updatedProduct.instanceId) {
      try {
        await updateProduct(updatedProduct.instanceId, updatedProduct);
      } catch {
        return; // o motivo já foi mostrado (ex.: nome repetido)
      }
      toast({
        title: "Produto Atualizado",
        description: `O produto "${updatedProduct.name}" foi atualizado com sucesso.`,
      });
    }
  };



  const handleConfirmDeleteProduct = (product: Product) => {
    // If it's a merged product, it might use instanceId as its main identifier for our UI
    const deleteId = product.instanceId || product.id;

    if (confirmAction && product && deleteId) {
      confirmAction(async () => {
        await deleteProduct(deleteId);
        toast({
          title: "Produto Apagado",
          description: `O produto "${product.name}" foi removido do inventário.`,
        });
      }, "Apagar Produto", `Tem a certeza que quer apagar "${product.name}"? Esta ação moverá o produto para a lixeira. Confirme com a sua palavra-passe.`);
    } else {
      console.warn("Could not delete product: missing confirmAction, product, or ID", { hasConfirm: !!confirmAction, product, deleteId });
    }
  };

  const handlePrintCountForm = () => {
    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<!DOCTYPE html><html><head><title>Formulário de Contagem de Estoque</title>');
      printWindow.document.write(`
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
      `);
      printWindow.document.write(`
        <style>
          @media screen {
            body {
              background-color: #f0f2f5;
            }
          }
          body { 
            font-family: 'PT Sans', sans-serif; 
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 2rem;
            
          }
          .container {
            width: 100%;
            margin: 0 auto;
            background-color: #fff;
            padding: 2rem;
            box-shadow: 0 0 20px rgba(0,0,0,0.05);
            border-radius: 8px;
            box-sizing: border-box;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #eee;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
          }
          .header h1 { 
            font-family: 'Space Grotesk', sans-serif;
            font-size: 2rem;
            color: #3498db; /* primary color */
            margin: 0;
          }
          .logo {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .logo span {
             font-family: 'Space Grotesk', sans-serif;
             font-size: 1.5rem;
             font-weight: bold;
             color: #3498db;
          }
          p { margin-bottom: 1rem; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 1.5rem; 
            font-size: 11px;
          }
          thead {
            display: table-header-group; /* Important for repeating headers */
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: left; 
          }
          th { 
            background-color: #f9fafb;
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 700;
            color: #374151;
          }
          .count-col { width: 80px; }
          .obs-col { width: 150px; }
          .signature-line {
            border-top: 1px solid #999;
            width: 250px;
            margin-top: 3rem;
          }
          .footer {
            text-align: center;
            margin-top: 3rem;
            font-size: 0.8rem;
            color: #999;
          }
          @page {
            size: A4 landscape;
            margin: 0.5in;
          }
          @media print {
            .no-print { display: none; }
            body { -webkit-print-color-adjust: exact; padding: 0; margin: 0; }
            .container { box-shadow: none; border-radius: 0; border: none; }
          }
        </style>
      `);
      printWindow.document.write('</head><body><div class="container">');

      printWindow.document.write(`
        <div class="header">
          <h1>Contagem de Estoque</h1>
          <div class="logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #3498db;">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></line>
            </svg>
            <span>MajorStockX</span>
          </div>
        </div>
      `);

      printWindow.document.write(`<p><b>Data da Contagem:</b> ${new Date().toLocaleDateString('pt-BR')}</p>`);
      printWindow.document.write(`<p><b>Responsável:</b> _________________________</p>`);

      printWindow.document.write('<table>');
      printWindow.document.write(`
        <thead>
            <tr>
                <th>Produto</th>
                <th>Categoria</th>
                ${isMultiLocation ? '<th>Localização</th>' : ''}
                <th class="count-col">Stock Sistema</th>
                <th class="count-col">Qtd. Contada</th>
                <th class="count-col">Diferença</th>
                <th class="obs-col">Observações</th>
            </tr>
        </thead>
      `);
      printWindow.document.write('<tbody>');

      // If filtering by a specific location and no products match, it means
      // the location exists but has 0 products attached to it.
      // In this case, we still want to list all known products with 0 stock so the user can count them.
      let listToPrint = filteredProducts;
      if (listToPrint.length === 0 && selectedLocation !== 'all' && !selectedLocation.startsWith('site:') && locations.length > 0) {
        // Create a list of all unique products with 0 stock for this empty location
        const uniqueNames = new Set();
        listToPrint = products.reduce((acc: Product[], p) => {
          const normName = p.name.toLowerCase().trim();
          if (!uniqueNames.has(normName)) {
            uniqueNames.add(normName);
            acc.push({ ...p, stock: 0, reservedStock: 0, location: selectedLocation });
          }
          return acc;
        }, []);

        // Apply the same category/name filters if defined
        if (categoryFilter.length > 0) {
          listToPrint = listToPrint.filter(p => categoryFilter.includes(p.category));
        }
        if (nameFilter) {
          listToPrint = listToPrint.filter(p => p.name.toLowerCase().includes(nameFilter.toLowerCase()));
        }
      }

      listToPrint.sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || '')).forEach(product => {
        const locationName = isMultiLocation ? (locations.find(l => l.id === product.location)?.name || product.location) : '';
        printWindow.document.write(`
            <tr>
                <td>${product.name}</td>
                <td>${product.category || 'Geral'}</td>
                ${isMultiLocation ? `<td>${locationName}</td>` : ''}
                <td>${product.stock - (product.reservedStock || 0)}</td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        `);
      });
      printWindow.document.write('</tbody></table>');

      printWindow.document.write('<div class="signature-line"><p>Assinatura do Responsável</p></div>');
      printWindow.document.write('<div class="footer"><p>MajorStockX &copy; ' + new Date().getFullYear() + '</p></div>');

      printWindow.document.write('</div></body></html>');
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    }
  };

  // Sem fotos, os cartões são quase todos "Sem foto" — a lista mostra muito mais por ecrã.
  const currentView = useMemo<'list' | 'grid'>(() => {
    if (view) return view;
    if (products.length === 0) return 'grid';
    const withPhoto = products.filter(p => p.imageUrl).length;
    return withPhoto / products.length >= 0.3 ? 'grid' : 'list';
  }, [view, products]);

  const categories = useMemo(() => {
    const categorySet = new Set(products.map(p => p.category));
    return Array.from(categorySet);
  }, [products]);

  // Pre-filter by category, location, and date BEFORE fuzzy search
  const preFilteredProducts = useMemo(() => {
    let result = hasInventoryFocus(focus) ? applyInventoryFocus(products, focus) : [...products];

    if (selectedLocation !== 'all') {
      result = result.filter(p => matchesLocationFilter(selectedLocation, p.location, locations));
    }

    if (categoryFilter.length > 0) {
      result = result.filter(p => categoryFilter.includes(p.category));
    }

    if (dateFilter) {
      result = result.filter(p => isSameDay(new Date(p.lastUpdated), dateFilter));
    }

    return result;
  }, [products, focus, selectedLocation, categoryFilter, dateFilter, locations]);

  // Apply fuzzy search on the pre-filtered list
  const searchedProducts = useFuse(preFilteredProducts, nameFilter, { keys: ['name', 'barcode', 'sku'] });

  const filteredProducts = useMemo(() => {
    // Apply sorting to the searched results
    let result = [...searchedProducts];

    // Sorting logic
    switch (sortBy) {
      case 'stock_desc':
        result.sort((a, b) => (b.stock - b.reservedStock) - (a.stock - a.reservedStock));
        break;
      case 'stock_asc':
        result.sort((a, b) => (a.stock - a.reservedStock) - (b.stock - b.reservedStock));
        break;
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'date_desc':
        result.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        break;
      default:
        result.sort((a, b) => (b.stock - b.reservedStock) - (a.stock - a.reservedStock));
        break;
    }

    return result;
  }, [searchedProducts, sortBy]);

  // Variações da mesma família juntas numa só entrada (lista do telemóvel e cartões); a tabela mostra todas.
  const grouped = useMemo(() => groupFamilies(filteredProducts), [filteredProducts]);
  const [openFamilies, setOpenFamilies] = useState<Set<string>>(new Set());
  const familyOpen = (key: string) => !!nameFilter.trim() || openFamilies.has(key);
  const toggleFamily = (key: string) => setOpenFamilies((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  type ListItem = { t: 'p'; p: Product; member?: boolean } | { t: 'f'; f: FamilyGroup<Product> };
  const listItems = useMemo<ListItem[]>(() => grouped.flatMap((x): ListItem[] => {
    if (!isFamilyGroup(x)) return [{ t: 'p', p: x }];
    return [{ t: 'f', f: x }, ...(familyOpen(x.key) ? x.members.map((m): ListItem => ({ t: 'p', p: m, member: true })) : [])];
  }), [grouped, openFamilies, nameFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cartões: mostra 48 e vai juntando mais quando se chega perto do fim.
  const GRID_PAGE = 48;
  const [gridLimit, setGridLimit] = useState(GRID_PAGE);
  const gridSentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setGridLimit(GRID_PAGE); }, [filteredProducts]);
  useEffect(() => {
    const el = gridSentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) setGridLimit(l => l + GRID_PAGE);
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [gridLimit, currentView, filteredProducts.length]);

  // Reset scroll when filters change - Optional with Virtuoso Window Scroll
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [selectedLocation, nameFilter, categoryFilter, dateFilter, sortBy]);

  const handleClearInventory = async () => {
    if (clearProductsCollection && confirmAction) {
      confirmAction(async () => {
        await clearProductsCollection();
        setShowClearConfirm(false);
      }, "Limpar Todo o Inventário", "Tem a certeza absoluta? Esta ação apagará todos os produtos e é irreversível. Requer a sua palavra-passe.");
    }
  };

  const reportTitle = useMemo(() => {
    if (selectedLocation === 'all' || !isMultiLocation) {
      return "Relatório de Inventário Geral";
    }
    const loc = locations.find(l => l.id === selectedLocation);
    const locationName = selectedLocation.startsWith('site:') ? `ponto ${selectedLocation.slice(5)}` : loc && locationLabel(loc);
    return `Relatório de Inventário: ${locationName || 'Desconhecida'}`;
  }, [selectedLocation, isMultiLocation, locations]);

  const handlePrintReport = () => {
    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<!DOCTYPE html><html><head><title>' + reportTitle + '</title>');
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
                    .header h1 { font-family: 'Space Grotesk', sans-serif; font-size: 2rem; color: #3498db; margin: 0; }
                    .logo { display: flex; flex-direction: column; align-items: flex-start; }
                    .logo span { font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; font-weight: bold; color: #3498db; }
                    table { width: 100%; border-collapse: collapse; margin-top: 2rem; font-size: 10px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f9fafb; font-family: 'Space Grotesk', sans-serif; }
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
                    <h1>${reportTitle}</h1>
                </div>
                <h2>Data: ${new Date().toLocaleDateString('pt-BR')}</h2>
            `);

      printWindow.document.write('<table><thead><tr><th>Produto</th><th>Categoria</th><th>Stock Disp.</th><th>Preço Unit.</th><th>Valor Stock</th></tr></thead><tbody>');

      let totalValue = 0;
      filteredProducts.forEach(product => {
        const availableStock = product.stock - product.reservedStock;
        const stockValue = availableStock * product.price;
        totalValue += stockValue;
        printWindow.document.write(`
                    <tr>
                        <td>${product.name}</td>
                        <td>${product.category}</td>
                        <td>${availableStock} ${product.unit || 'un.'}</td>
                        <td>${formatCurrency(product.price)}</td>
                        <td>${formatCurrency(stockValue)}</td>
                    </tr>
                `);
      });

      printWindow.document.write(`
                <tr>
                    <td colspan="4" style="text-align: right; font-weight: bold;">Valor Total do Inventário:</td>
                    <td style="font-weight: bold;">${formatCurrency(totalValue)}</td>
                </tr>
            `);

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

  const handleDownloadPdfReport = () => {
    const locationName = selectedLocation === 'all' || !isMultiLocation
      ? 'Geral'
      : locations.find(l => l.id === selectedLocation)?.name || 'Desconhecida';

    generateInventoryReportPDF(filteredProducts, companyData || null, locationName);

    toast({
      title: "PDF Gerado",
      description: "O relatório de inventário foi descarregado.",
    });
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
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem a certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível e irá apagar permanentemente <strong>todos</strong> os produtos do seu inventário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearInventory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-4">
        <ProductsTabs />
        <ReservedDriftBanner />
        {canEditInventory && withoutStock.length > 0 && (
          <Link
            href="/inventory/quick?modo=entrada"
            data-tour="inv-without-stock"
            className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-sm hover:bg-primary/10"
          >
            <span className="min-w-0">
              <b>{plural(withoutStock.length, 'produto do catálogo', 'produtos do catálogo')}</b> ainda sem stock{allLocations.length > locations.length ? ' neste ponto' : ''}
              <span className="block truncate text-xs text-muted-foreground">{withoutStock.slice(0, 3).map((c) => c.name).join(', ')}{withoutStock.length > 3 ? '…' : ''}</span>
            </span>
            <span className="shrink-0 font-semibold text-primary">Dar entrada ›</span>
          </Link>
        )}
        {/* Acções principais — só o que se usa todos os dias fica à vista */}
        {/* Os botões quebram para a linha de baixo quando não cabem (telemóvel pequeno, tablet em pé) e crescem para
            encher a linha; nunca saem do ecrã nem cortam o texto (min-w-fit). O "Mais" fica sempre à direita. */}
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {canEditInventory && (
            <Button data-tour="inv-quick" variant="default" className="h-12 min-w-fit flex-1 basis-[7.5rem] bg-green-600 px-3 text-white hover:bg-green-700 sm:flex-none sm:px-6" asChild>
              <Link href="/inventory/quick">
                <LayoutGrid className="mr-2 h-4 w-4" />
                <span>Stock Rápido</span>
              </Link>
            </Button>
          )}
          {canEditInventory && (
            <Button data-tour="inv-count" variant="outline" className="h-12 min-w-fit flex-1 basis-[7.5rem] border-blue-600 px-3 text-blue-600 hover:bg-blue-50 sm:flex-none sm:px-6 dark:hover:bg-blue-950/30" asChild>
              <Link href="/inventory/quick?modo=contagem">
                <ClipboardList className="mr-2 h-4 w-4" />
                <span>Contagem</span>
              </Link>
            </Button>
          )}
          {isMultiLocation && canEditInventory && (
            <Button data-tour="inv-transfer" variant="outline" className="h-12 min-w-fit flex-1 basis-[7.5rem] px-3 sm:flex-none sm:px-6" asChild>
              <Link href="/inventory/transfer">
                <Truck className="mr-2 h-4 w-4" />
                <span>Transferir</span>
              </Link>
            </Button>
          )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-tour="inv-more" variant="outline" className="h-12 shrink-0 px-3" aria-label="Mais opções">
                <MoreHorizontal className="h-5 w-5" />
                <span className="ml-2 hidden sm:inline">Mais</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Imprimir / exportar (lista filtrada)</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleDownloadPdfReport}>
                <Download className="mr-2 h-4 w-4" /> Descarregar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintReport}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir relatório
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintCountForm}>
                <FileText className="mr-2 h-4 w-4" /> Folha de contagem em papel
              </DropdownMenuItem>
              {canEditInventory && isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await syncSmartThresholds(true); }}>
                    <WandSparkles className="mr-2 h-4 w-4" /> Recalcular mínimos de stock
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Pesquisa e filtros */}
        <div className="w-full space-y-2">
          <div className="relative w-full">
            {/* procurar lendo o código de barras com a câmara (antes o ícone era só desenho e não fazia nada) */}
            <button
              type="button"
              aria-label="Procurar pelo código de barras"
              onClick={() => setScanOpen(true)}
              className="absolute right-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ScanBarcode className="h-5 w-5" />
            </button>
            <BarcodeScanner
              open={scanOpen}
              title="Aponte ao código do produto"
              onClose={() => setScanOpen(false)}
              onScan={(code) => {
                const p = findByBarcode(products || [], code);
                if (!p) return UNKNOWN_CODE;
                setNameFilter(p.name);
                setScanOpen(false);
                return `✓ ${p.name}`;
              }}
            />
            <Input
              data-tour="inv-search"
              placeholder="Procurar por nome ou código..."
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              className="w-full shadow-sm h-12 text-sm pr-10"
            />
          </div>

          <div data-tour="inv-filters" className="flex items-center gap-2 overflow-x-auto overflow-y-hidden pb-1 -mx-1 px-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 shrink-0 gap-1.5 px-3">
                  <ListFilter className="h-4 w-4" />
                  <span>Categoria</span>
                  {categoryFilter.length > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                      {categoryFilter.length > 9 ? '9+' : categoryFilter.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <ScrollArea className="h-48">
                  {categoryFilter.length > 0 && (
                    <>
                      <DropdownMenuItem onClick={() => setCategoryFilter([])}>Limpar filtro</DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {categories.map((category) => (
                    <DropdownMenuCheckboxItem
                      key={category}
                      className="capitalize"
                      checked={categoryFilter.includes(category)}
                      onCheckedChange={(value) => {
                        if (value) setCategoryFilter([...categoryFilter, category]);
                        else setCategoryFilter(categoryFilter.filter(c => c !== category));
                      }}
                    >
                      {category}
                    </DropdownMenuCheckboxItem>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {isMultiLocation && canViewInventory && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className={cn("h-10 shrink-0 gap-1.5 px-3", selectedLocation !== 'all' && "border-primary text-primary")}>
                    <MapPin className="h-4 w-4" />
                    <span className="max-w-[8rem] truncate">{selectedLocation === 'all' ? 'Local' : (locations.find(l => l.id === selectedLocation)?.name || 'Local')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <ScrollArea className="h-[200px]">
                    <DropdownMenuCheckboxItem checked={selectedLocation === 'all'} onCheckedChange={() => setSelectedLocation('all')}>
                      Todas as localizações
                    </DropdownMenuCheckboxItem>
                    {/* com pontos: o ponto inteiro, e cada local com o ponto à frente */}
                    {sitesOf(locations).length > 1 && sitesOf(locations).map(site => (
                      <DropdownMenuCheckboxItem key={site} checked={selectedLocation === siteFilter(site)} onCheckedChange={() => setSelectedLocation(siteFilter(site))}>
                        Ponto {site} (tudo)
                      </DropdownMenuCheckboxItem>
                    ))}
                    {locations.map(location => (
                      <DropdownMenuCheckboxItem
                        key={location.id}
                        checked={selectedLocation === location.id}
                        onCheckedChange={() => setSelectedLocation(location.id)}
                      >
                        {locationLabel(location)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 shrink-0 gap-1.5 px-3">
                  <ChevronsUpDown className="h-4 w-4" />
                  <span>{SORT_LABELS[sortBy]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                    <DropdownMenuRadioItem key={k} value={k}>{SORT_LABELS[k]}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="shrink-0">
              <DatePicker date={dateFilter} setDate={setDateFilter} />
            </div>

            {/* Lista / Cartões — também no telemóvel */}
            <div data-tour="inv-view" className="ml-auto flex shrink-0 items-center rounded-lg border p-0.5">
              <Button variant={currentView === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => handleSetView('list')} className="h-9 px-2.5" aria-label="Vista de lista">
                <List className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Lista</span>
              </Button>
              <Button variant={currentView === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => handleSetView('grid')} className="h-9 px-2.5" aria-label="Vista de cartões">
                <LayoutGrid className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Cartões</span>
              </Button>
            </div>
            {currentView === 'grid' && (
              <div className="hidden md:block shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 gap-2">
                      <span>{gridCols} colunas</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuRadioGroup value={gridCols} onValueChange={(value) => handleSetGridCols(value as '3' | '4' | '5')}>
                      <DropdownMenuRadioItem value="3">3 colunas</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="4">4 colunas</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="5">5 colunas</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {plural(filteredProducts.length, 'produto', 'produtos')}
            {filteredProducts.length !== products.length && ` de ${products.length}`}
          </p>
        </div>

        {hasInventoryFocus(focus) && (() => {
          const t = inventoryFocusTitle(focus, filteredProducts.length);
          return (
            <DeepLinkBanner title={t.title} hint={t.hint} count={filteredProducts.length} onClear={() => router.replace('/inventory')}>
              {focus.problem === 'limites-manuais' && canEditInventory && filteredProducts.length > 0 && (
                <Button type="button" size="sm" onClick={() => setAutoThresholds(filteredProducts)} disabled={isReadOnly} className="shrink-0">
                  <WandSparkles className="mr-1.5 h-4 w-4" /> Pôr {filteredProducts.length === 1 ? 'em' : `os ${filteredProducts.length} em`} automático
                </Button>
              )}
            </DeepLinkBanner>
          );
        })()}

        {currentView === 'list' && !isDesktop ? (
          filteredProducts.length > 0 ? (
            <div data-tour="inv-list" className="overflow-hidden rounded-xl border bg-card pb-0 mb-20">
              <Virtuoso
                useWindowScroll
                increaseViewportBy={500}
                // Desenha logo as primeiras linhas, sem esperar pela medição do ecrã.
                initialItemCount={Math.min(20, listItems.length)}
                data={listItems}
                // A lista pode encolher depois do 1.º desenho (ex.: ?filter= vindo da Pesquisa Rápida): a Virtuoso ainda
                // pede por instantes linhas que já não existem — sem estas guardas a página rebentava ("reading 't'").
                computeItemKey={(index, it) => (!it ? `x-${index}` : it.t === 'f' ? `f-${it.f.key}` : `${it.member ? 'm' : 'p'}-${it.p.instanceId}`)}
                itemContent={(index, it) => !it ? null : it.t === 'f' ? (
                  <FamilyRow
                    group={it.f.group}
                    members={it.f.members}
                    expanded={familyOpen(it.f.key)}
                    onToggle={() => toggleFamily(it.f.key)}
                    label={variantLabel}
                    locationName={isMultiLocation ? locations.find(l => l.id === it.f.members[0]?.location)?.name : undefined}
                  />
                ) : (
                  <div className={cn(it.member && "border-l-4 border-primary/30 bg-muted/20")}>
                    <ProductRow
                      product={it.p}
                      canEdit={canEditInventory}
                      locationName={isMultiLocation ? locations.find(l => l.id === it.p.location)?.name : undefined}
                    />
                  </div>
                )}
              />
            </div>
          ) : (
            <Card className="text-center py-12 text-muted-foreground">
              <p>Nenhum produto encontrado com os filtros atuais.</p>
            </Card>
          )
        ) : currentView === 'list' ? (
          <div data-tour="inv-list">
          <InventoryDataTable
            columns={columns({
              onAttemptDelete: handleConfirmDeleteProduct,
              onProductUpdate: handleUpdateProduct,
              canEdit: canEditInventory,
              isMultiLocation: isMultiLocation,
              locations: locations,
              isReadOnly: isReadOnly
            })}
            data={filteredProducts}
            useVirtualization
          />
          </div>
        ) : (
          filteredProducts.length > 0 ? (
            // Grelha normal, carregada aos poucos: a grelha virtual re-media os cartões (com e sem
            // foto têm alturas diferentes) a meio do scroll e a página tremia.
            <>
              <div className={cn(
                "grid gap-2 sm:gap-4",
                gridCols === '3' && "grid-cols-2 sm:grid-cols-3",
                gridCols === '4' && "grid-cols-2 sm:grid-cols-4",
                gridCols === '5' && "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5"
              )}>
                {grouped.slice(0, gridLimit).map(item => isFamilyGroup(item) ? (
                  <FamilyCard
                    key={`f-${item.key}`}
                    group={item.group}
                    members={item.members}
                    canEdit={canEditInventory}
                    label={variantLabel}
                    locationName={isMultiLocation ? locations.find(l => l.id === item.members[0]?.location)?.name : undefined}
                  />
                ) : ((product: Product) => (
                  <ProductCard
                    key={product.instanceId}
                    product={product}
                    onProductUpdate={handleUpdateProduct}
                    onAttemptDelete={handleConfirmDeleteProduct}
                    viewMode={gridCols === '5' || gridCols === '4' ? 'condensed' : 'normal'}
                    canEdit={canEditInventory}
                    locations={locations}
                    isMultiLocation={isMultiLocation}
                    locationName={locations.find(l => l.id === product.location)?.name}
                  />
                ))(item))}
              </div>
              {gridLimit < grouped.length && <div ref={gridSentinel} className="h-24" aria-hidden />}
              <div className="pb-20" />
            </>
          ) : (
            <Card className="text-center py-12 text-muted-foreground">
              <p>Nenhum produto encontrado com os filtros atuais.</p>
              {canEditInventory && <p className="text-sm">Comece por adicionar um novo produto.</p>}
            </Card>
          )
        )}

        {/* Pagination buttons - Removed in favor of Virtualization */}

        {/* "Limpar todo o inventário" fica só em Ajustes — não num ecrã de uso diário. */}
      </div >
      {canEditInventory && (
        isReadOnly ? (
          <Button
            disabled
            className="fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-lg z-20"
            size="icon"
            title="Indisponível em modo leitura"
          >
            <Plus className="h-6 w-6" />
          </Button>
        ) : (
          <Button
            asChild
            data-tour="inv-add"
            className="fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-lg z-20"
            size="icon"
          >
            <Link href={newProductHref}>
              <Plus className="h-6 w-6" />
              <span className="sr-only">Adicionar Produto</span>
            </Link>
          </Button>
        )
      )}
    </>
  );
}
