"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Edit, ImageOff, Layers, ScanBarcode, PackagePlus, Percent, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import { filterCatalog, marginPct, SORT_LABELS, type CatalogSort } from "@/lib/catalog-view";

export type CatalogRow = { id: string; name: string; category?: string; price?: number; unit?: string; imageUrl?: string; cost?: number; barcode?: string; variantGroup?: string };

const PAGE = 50;

const Row = memo(function Row({ p, selected, readOnly, onToggle, onOpen, onEdit, onDelete }: {
    p: CatalogRow; selected: boolean; readOnly: boolean;
    onToggle: (id: string, on: boolean) => void; onOpen: (p: CatalogRow) => void; onEdit: (p: CatalogRow) => void; onDelete: (p: CatalogRow) => void;
}) {
    const unit = p.unit && p.unit !== "un" ? `/${p.unit}` : "";
    const margin = marginPct(p.price, p.cost);
    return (
        <div
            data-testid="catalog-row"
            data-tour="catalog-row"
            data-selected={selected || undefined}
            className={cn("grid items-center gap-3 border-b px-3 py-2.5 last:border-b-0", "grid-cols-[auto_44px_minmax(0,1fr)_auto]", "md:grid-cols-[auto_44px_minmax(0,2fr)_minmax(0,1fr)_130px_72px]", selected ? "bg-primary/5" : "hover:bg-muted/40")}
        >
            <Checkbox data-tour="catalog-select" checked={selected} onCheckedChange={(c) => onToggle(p.id, !!c)} aria-label={`Selecionar ${p.name}`} />
            {p.imageUrl ? (
                <img src={p.imageUrl} alt="" loading="lazy" decoding="async" className="h-11 w-11 rounded-lg border object-cover" />
            ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"><ImageOff className="h-4 w-4 opacity-50" /></div>
            )}
            <button type="button" data-tour="catalog-row-open" onClick={() => onOpen(p)} className="min-w-0 text-left" aria-label={`Abrir ${p.name}`}>
                <span className="block truncate font-medium">{p.name}</span>
                <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <span className="truncate md:hidden">{p.category || "Sem categoria"}</span>
                    {margin !== null && <span className={cn("shrink-0 rounded px-1 font-medium", margin < 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")} title="Margem sobre o preço de venda">{margin < 0 ? "abaixo do custo" : `margem ${margin}%`}</span>}
                    {p.variantGroup && <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-primary/10 px-1 font-medium text-primary" title={`Variação de ${p.variantGroup}`}><Layers className="h-3 w-3" />variação</span>}
                    {p.barcode && <ScanBarcode className="h-3 w-3 shrink-0" aria-label="Tem código de barras" />}
                </span>
            </button>
            <span className="hidden truncate text-sm text-muted-foreground md:block">{p.category || "Sem categoria"}</span>
            <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums">{formatCurrency(p.price || 0)}<span className="text-xs font-normal text-muted-foreground">{unit}</span></span>
            <span className="hidden items-center justify-end gap-1 md:flex">
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={readOnly} onClick={() => onEdit(p)} aria-label={`Editar ${p.name}`}><Edit className="h-4 w-4 text-muted-foreground" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={readOnly} onClick={() => onDelete(p)} aria-label={`Apagar ${p.name}`}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
            </span>
        </div>
    );
});

/**
 * Lista de produtos do catálogo: pesquisa tolerante, filtro por categoria, ordenação, 50 de cada vez
 * (rolagem contínua), selecção com acções em massa. Funciona igual no telemóvel (cartões) e no computador (linhas).
 */
export function CatalogProductsView({ products, categories, loading, readOnly, term, onTerm, category, onCategory, onAdd, onOpen, onEdit, onDelete, onBulk }: {
    products: CatalogRow[];
    categories: string[];
    loading: boolean;
    readOnly: boolean;
    term: string; onTerm: (t: string) => void;
    category: string; onCategory: (c: string) => void;
    onAdd: (prefillName?: string) => void;
    onOpen: (p: CatalogRow) => void;
    onEdit: (p: CatalogRow) => void;
    onDelete: (p: CatalogRow) => void;
    onBulk: (action: "category" | "price" | "delete", ids: string[]) => void;
}) {
    const [sort, setSort] = useState<CatalogSort>("relevance");
    const [visible, setVisible] = useState(PAGE);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const deferred = useDeferredValue(term);
    const sentinel = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => filterCatalog(products, { term: deferred, category, sort }), [products, deferred, category, sort]);
    useEffect(() => { setVisible(PAGE); }, [deferred, category, sort]);
    // a selecção só guarda produtos que ainda existem
    useEffect(() => { setSelected((prev) => { const ids = new Set(products.map((p) => p.id)); const next = new Set([...prev].filter((id) => ids.has(id))); return next.size === prev.size ? prev : next; }); }, [products]);

    // rolagem contínua: ao chegar ao fim mostra mais 50
    useEffect(() => {
        const el = sentinel.current;
        if (!el || visible >= filtered.length) return;
        const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setVisible((v) => v + PAGE); }, { rootMargin: "400px" });
        io.observe(el);
        return () => io.disconnect();
    }, [visible, filtered.length]);

    const toggle = useCallback((id: string, on: boolean) => setSelected((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; }), []);
    const shown = filtered.slice(0, visible);
    const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
    const toggleAll = (on: boolean) => setSelected(on ? new Set(filtered.map((p) => p.id)) : new Set());
    const ids = [...selected];
    const searching = deferred.trim().length > 0 || category !== "all";

    return (
        <div className="space-y-3">
            {/* pesquisa + filtros */}
            <div className="space-y-2">
                <div className="relative" data-tour="catalog-search">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input value={term} onChange={(e) => onTerm(e.target.value)} placeholder="Pesquisar por nome, categoria ou código…" className="h-11 pl-9 pr-9" aria-label="Pesquisar no catálogo" />
                    {term && <button type="button" onClick={() => onTerm("")} aria-label="Limpar pesquisa" className="absolute right-3 top-3.5 text-muted-foreground"><X className="h-4 w-4" /></button>}
                </div>
                <div className="flex flex-wrap items-center gap-2" data-tour="catalog-filters">
                    <Select value={category} onValueChange={onCategory}>
                        <SelectTrigger className="h-9 w-[170px]" aria-label="Filtrar por categoria"><Tag className="mr-1.5 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={sort} onValueChange={(v) => setSort(v as CatalogSort)}>
                        <SelectTrigger className="h-9 w-[170px]" aria-label="Ordenar"><ArrowUpDown className="mr-1.5 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                        <SelectContent>{(Object.keys(SORT_LABELS) as CatalogSort[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="ml-auto text-sm text-muted-foreground" aria-live="polite">{searching ? `${filtered.length} de ${products.length}` : `${products.length}`} produto{products.length === 1 ? "" : "s"}</span>
                </div>
            </div>

            {/* lista */}
            <div className="overflow-hidden rounded-xl border bg-card">
                <div className="hidden items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[auto_44px_minmax(0,2fr)_minmax(0,1fr)_130px_72px]">
                    <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(!!c)} aria-label="Selecionar todos os resultados" disabled={!filtered.length} />
                    <span /><span>Produto</span><span>Categoria</span><span className="text-right">Preço</span><span />
                </div>
                {loading ? (
                    <div className="space-y-2 p-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                        <PackagePlus className="h-8 w-8 text-muted-foreground" />
                        {products.length === 0 ? (
                            <><p className="text-muted-foreground">O catálogo está vazio. Adicione produtos um a um ou importe uma lista.</p>
                                {!readOnly && <Button onClick={() => onAdd()}><Plus className="mr-1.5 h-4 w-4" /> Novo produto</Button>}</>
                        ) : (
                            <><p className="text-muted-foreground">Nenhum produto corresponde{deferred.trim() ? <> a «{deferred.trim()}»</> : ""}.</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    <Button variant="outline" onClick={() => { onTerm(""); onCategory("all"); }}>Limpar filtros</Button>
                                    {!readOnly && deferred.trim() && <Button onClick={() => onAdd(deferred.trim())}><Plus className="mr-1.5 h-4 w-4" /> Criar «{deferred.trim()}»</Button>}
                                </div></>
                        )}
                    </div>
                ) : (
                    <>
                        <label className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm md:hidden">
                            <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(!!c)} aria-label="Selecionar todos os resultados" />
                            <span className="text-muted-foreground">Selecionar todos ({filtered.length})</span>
                        </label>
                        {shown.map((p) => <Row key={p.id} p={p} selected={selected.has(p.id)} readOnly={readOnly} onToggle={toggle} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />)}
                        {visible < filtered.length && (
                            <div ref={sentinel} className="p-3 text-center">
                                <Button variant="ghost" size="sm" onClick={() => setVisible((v) => v + PAGE)}>A mostrar {shown.length} de {filtered.length} · mostrar mais</Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* telemóvel: botão + ao alcance do polegar (desaparece quando há selecção, que usa o mesmo espaço) */}
            {!readOnly && selected.size === 0 && (
                <Button size="icon" data-tour="catalog-new" onClick={() => onAdd()} aria-label="Novo produto" className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full shadow-lg md:hidden"><Plus className="h-6 w-6" /></Button>
            )}

            {/* acções em massa */}
            {selected.size > 0 && !readOnly && (
                <div role="toolbar" data-tour="catalog-bulk" aria-label="Ações em massa" className="fixed inset-x-3 bottom-20 z-30 flex flex-wrap items-center gap-2 rounded-2xl border bg-background/95 p-2.5 shadow-lg backdrop-blur md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2">
                    <span className="px-2 text-sm font-medium">{selected.size} selecionado{selected.size === 1 ? "" : "s"}</span>
                    <Button size="sm" variant="secondary" onClick={() => onBulk("category", ids)}><Tag className="mr-1.5 h-4 w-4" /> Categoria</Button>
                    <Button size="sm" variant="secondary" onClick={() => onBulk("price", ids)}><Percent className="mr-1.5 h-4 w-4" /> Preço</Button>
                    <Button size="sm" variant="destructive" onClick={() => onBulk("delete", ids)}><Trash2 className="mr-1.5 h-4 w-4" /> Apagar</Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(new Set())} aria-label="Limpar seleção"><X className="h-4 w-4" /></Button>
                </div>
            )}
        </div>
    );
}
