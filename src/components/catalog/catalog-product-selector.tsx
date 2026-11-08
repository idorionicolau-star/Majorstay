
import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Product } from '@/lib/types';
import { Button } from "@/components/ui/button";
import { Check, PlusCircle, ChevronsUpDown, Search, PackageCheck } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, normalizeString, calculateSimilarity, formatCurrency } from '@/lib/utils';
import { searchCatalog } from '@/lib/catalog-view';
import { useMediaQuery } from '@/hooks/use-media-query';
import { ScrollArea } from '../ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import dynamic from 'next/dynamic';

const MAX_SHOWN = 50;
const RECENT_KEY = 'msx-recent-products';

const QuickCreateProductDialog = dynamic(() => import('./quick-create-product-dialog').then(mod => mod.QuickCreateProductDialog), {
  loading: () => null,
  ssr: false
});

type CatalogProduct = Omit<Product, 'stock' | 'instanceId' | 'reservedStock' | 'location' | 'lastUpdated'>;
type CatalogCategory = { id: string; name: string };

interface CatalogProductSelectorProps {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  selectedValue: string;
  onValueChange: (value: string, product?: CatalogProduct) => void;
  placeholder?: string;
}

export function CatalogProductSelector({ products, categories, selectedValue, onValueChange, placeholder = "Selecionar produto..." }: CatalogProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [recentNames, setRecentNames] = useState<string[]>([]);
  useEffect(() => {
    try { setRecentNames(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')); } catch { /* sem armazenamento */ }
  }, [open]);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const categoryFilteredProducts = useMemo(() => {
    if (categoryFilter === 'all') return products;
    return products.filter(p => p.category === categoryFilter);
  }, [products, categoryFilter]);

  // Pesquisa igual à do resto da app (sem acentos, plural, gralhas, também por categoria).
  // Só se desenham MAX_SHOWN: com centenas de produtos, desenhá-los todos tornava abrir a lista lento no telemóvel.
  const { shown, total } = useMemo(() => {
    const q = searchQuery.trim();
    if (q) {
      const hits = searchCatalog(categoryFilteredProducts, q);
      return { shown: hits.slice(0, MAX_SHOWN), total: hits.length };
    }
    const alpha = [...categoryFilteredProducts].sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true }));
    const recents = recentNames.map(n => alpha.find(p => p.name === n)).filter((p): p is CatalogProduct => !!p).slice(0, 6);
    const rest = alpha.filter(p => !recents.includes(p));
    return { shown: [...recents, ...rest].slice(0, MAX_SHOWN), total: alpha.length };
  }, [categoryFilteredProducts, searchQuery, recentNames]);
  const filteredProducts = shown;

  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState('');
  const [isSimilarityWarningOpen, setIsSimilarityWarningOpen] = useState(false);
  const [similarCandidates, setSimilarCandidates] = useState<CatalogProduct[]>([]);
  const [potentialDuplicateName, setPotentialDuplicateName] = useState('');

  const handleInputChange = (val: string) => {
    setSearchQuery(val);
  };

  const handleSelect = useCallback((name: string, product?: CatalogProduct) => {
    try {
      const next = [name, ...(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[]).filter((n) => n !== name)].slice(0, 12);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch { /* sem armazenamento */ }
    onValueChange(name, product);
    setOpen(false);
    setSearchQuery('');
  }, [onValueChange]);

  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          variant="outline"
          role="combobox"
          aria-expanded={false}
          className="w-full justify-between h-12 px-3 font-normal"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            {selectedValue ? (
              <div className="flex items-center gap-2 truncate">
                {(() => {
                  const selectedProduct = products.find(p => p.name === selectedValue);
                  return selectedProduct?.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt="" className="h-5 w-5 rounded object-cover shrink-0" />
                  ) : null;
                })()}
                <span className="truncate">{selectedValue}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      ) : (
        <div className="w-full border rounded-md shadow-sm bg-background flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b bg-muted/50">
            <Select onValueChange={setCategoryFilter} value={categoryFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Filtrar por Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {sortedCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Command shouldFilter={false}>
            <div className="relative">
              <CommandInput
                placeholder="Pesquisar produto..."
                value={searchQuery}
                onValueChange={handleInputChange}
                className="h-14 text-base focus:bg-accent/30 focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
                autoFocus={isDesktop}
                onFocus={(e) => {
                  if (!isDesktop) {
                    setTimeout(() => {
                      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                  }
                }}
              />
            </div>
            <CommandList>
              <div className="h-[250px] md:h-[300px] overflow-y-auto overscroll-contain touch-pan-y">
                <CommandEmpty>
                  {searchQuery ? (
                    <div className="p-4 text-sm text-center text-muted-foreground">
                      Nenhum produto encontrado.
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-center text-muted-foreground">
                      Comece a digitar...
                    </div>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {searchQuery.length > 0 && !filteredProducts.some(p => normalizeString(p.name) === normalizeString(searchQuery)) && (
                    <CommandItem
                      onSelect={() => {
                        const candidates = products.filter(p => calculateSimilarity(p.name, searchQuery) >= 0.7);
                        if (candidates.length > 0) {
                          setSimilarCandidates(candidates);
                          setPotentialDuplicateName(searchQuery);
                          setIsSimilarityWarningOpen(true);
                        } else {
                          setQuickCreateName(searchQuery);
                          setIsQuickCreateOpen(true);
                        }
                        setOpen(false);
                      }}
                      className="cursor-pointer text-primary font-medium"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      <span>Criar "{searchQuery}"</span>
                    </CommandItem>
                  )}
                  {filteredProducts.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={product.name}
                      onSelect={() => handleSelect(product.name, product)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedValue === product.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex w-full items-center gap-2">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <PackageCheck className="h-3 w-3 opacity-40" />
                          </div>
                        )}
                        <span className="min-w-0 flex-1 truncate">{product.name}</span>
                        {!!product.price && <span className="shrink-0 pl-2 text-xs tabular-nums text-muted-foreground">{formatCurrency(product.price)}</span>}
                      </div>
                    </CommandItem>
                  ))}
                  {total > filteredProducts.length && (
                    <p className="px-3 py-2 text-center text-xs text-muted-foreground">A mostrar {filteredProducts.length} de {total} — escreva para filtrar.</p>
                  )}
                </CommandGroup>
              </div>
            </CommandList>
          </Command>
          <div className="p-2 border-t bg-muted/50">
            <Button
              type="button"
              variant="ghost"
              className="w-full h-10"
              onClick={() => {
                setOpen(false);
                setSearchQuery('');
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isSimilarityWarningOpen} onOpenChange={setIsSimilarityWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produtos Semelhantes Encontrados</DialogTitle>
            <DialogDescription>
              Encontrámos produtos com nomes semelhantes a "{potentialDuplicateName}". Deseja usar um destes ou criar um novo mesmo assim?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            {similarCandidates.map(candidate => (
              <Button
                key={candidate.id}
                variant="outline"
                className="justify-start focus-visible:ring-0"
                onClick={() => {
                  handleSelect(candidate.name, candidate);
                  setIsSimilarityWarningOpen(false);
                  setSimilarCandidates([]);
                }}
              >
                <Check className="mr-2 h-4 w-4 text-green-500" />
                Usar: {candidate.name}
              </Button>
            ))}
            <div className="border-t my-2"></div>
            <Button
              variant="destructive"
              onClick={() => {
                setQuickCreateName(potentialDuplicateName);
                setIsSimilarityWarningOpen(false);
                setIsQuickCreateOpen(true);
                setSimilarCandidates([]);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar "{potentialDuplicateName}" (Novo)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <QuickCreateProductDialog
        open={isQuickCreateOpen}
        onOpenChange={setIsQuickCreateOpen}
        defaultName={quickCreateName}
        onSuccess={(newName, productDetails) => {
          // Construct a temporary CatalogProduct object for immediate selection
          const tempProduct: CatalogProduct | undefined = productDetails ? {
            id: 'temp-' + Date.now(),
            name: newName,
            category: productDetails.category,
            unit: productDetails.unit,
            price: productDetails.price,
            lowStockThreshold: 10,
            criticalStockThreshold: 5,
          } : undefined;

          onValueChange(newName, tempProduct);
          setSearchQuery('');
          setOpen(false);
        }}
      />
    </div>
  );
}
