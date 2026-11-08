"use client";

import { requireEmailConfirmed } from "@/components/billing/email-confirm";
import { useContext, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, doc, writeBatch } from "firebase/firestore";
import { MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { useFirestore } from "@/firebase/provider";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { useDynamicPlaceholder } from "@/hooks/use-dynamic-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToastAction } from "@/components/ui/toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CatalogProductsView, type CatalogRow } from "@/components/catalog/catalog-products-view";
import { CatalogCategoriesView, type CategoryRow } from "@/components/catalog/catalog-categories-view";
import { AddCatalogProductDialog, type InitialStock } from "./add-catalog-product-dialog";
import { EditCatalogProductDialog } from "./edit-catalog-product-dialog";
import { CatalogImporter, type CatalogImportResult } from "./catalog-importer";
import { adjustPrice, buildSyncPlan, categoryCounts, copyName, findBarcodeClash, findDuplicate, nameKey, parsePct, pushPriceHistory, sameCodeKey } from "@/lib/catalog-view";
import { CatalogProductDetail } from "@/components/catalog/catalog-product-detail";
import { AddVariantDialog } from "@/components/catalog/add-variant-dialog";
import { siblingsOf } from "@/lib/variants";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { RenameProductDialog } from "@/components/inventory/rename-product-dialog";
import { clearDraft } from "@/lib/form-draft";

type CatalogProduct = Omit<Product, "stock" | "instanceId" | "reservedStock" | "location" | "lastUpdated"> & { id: string };
const offline = () => typeof navigator !== "undefined" && !navigator.onLine;
const NEW = "__new__";

export function CatalogManager() {
    const { toast } = useToast();
    const ctx = useContext(InventoryContext);
    const firestore = useFirestore();

    const catalog = useMemo(() => (ctx?.catalogProducts || []) as CatalogProduct[], [ctx?.catalogProducts]);
    const allCatalog = useMemo(() => (ctx?.allCatalogProducts || []) as CatalogProduct[], [ctx?.allCatalogProducts]);
    const categories = useMemo(() => (ctx?.catalogCategories || []) as { id: string; name: string }[], [ctx?.catalogCategories]);
    const inventory = ctx?.products;
    const sales = ctx?.sales;
    const locations = ctx?.locations;
    const username = ctx?.user?.username;
    const companyId = ctx?.companyId;
    const readOnly = !!ctx?.isReadOnly;
    const loading = !ctx || !!ctx.loading;

    // o que se escreveu em "Novo produto" volta se a janela fechar sem querer (ver form-draft)
    const draftKey = `majorstockx-draft-catalog-new:${companyId || "x"}`;
    const [tab, setTab] = useState("products");
    const [term, setTerm] = useState("");
    const [category, setCategory] = useState("all");

    const [addOpen, setAddOpen] = useState(false);
    const [addPrefill, setAddPrefill] = useState("");
    const [editId, setEditId] = useState<string | null>(null);
    const [detailId, setDetailId] = useState<string | null>(null);
    const [dupSource, setDupSource] = useState<CatalogProduct | null>(null);
    const [variantSource, setVariantSource] = useState<CatalogProduct | null>(null);
    const [newVariantOf, setNewVariantOf] = useState<string | null>(null);
    /** variação cuja família vai mudar de nome (abre a janela "Editar" já em "A família") */
    const [familyRename, setFamilyRename] = useState<string | null>(null);
    /** família cujo preço se vai mudar de uma vez */
    const [dup, setDup] = useState<{ data: Omit<CatalogProduct, "id">; existing: CatalogProduct; initialStock?: InitialStock } | null>(null);
    const [bulk, setBulk] = useState<{ kind: "category" | "price" | "delete"; ids: string[] } | null>(null);
    const [bulkCat, setBulkCat] = useState("");
    const [bulkNewCat, setBulkNewCat] = useState("");
    const [bulkPct, setBulkPct] = useState("");
    const [catDialog, setCatDialog] = useState<{ mode: "add" | "rename"; cat?: CategoryRow } | null>(null);
    const [catName, setCatName] = useState("");
    const [delCat, setDelCat] = useState<CategoryRow | null>(null);
    const [syncPlan, setSyncPlan] = useState<ReturnType<typeof buildSyncPlan> | null>(null);
    const [syncing, setSyncing] = useState<{ done: number; total: number } | null>(null);
    const categoryPlaceholder = useDynamicPlaceholder("category", !!catDialog);

    const categoryNames = useMemo(() => categories.map((c) => c.name).sort((a, b) => a.localeCompare(b, "pt")), [categories]);
    const counts = useMemo(() => categoryCounts(catalog), [catalog]);
    const catRows: CategoryRow[] = useMemo(
        () => [...categories].sort((a, b) => a.name.localeCompare(b.name, "pt")).map((c) => ({ id: c.id, name: c.name, count: counts.get(c.name) || 0 })),
        [categories, counts],
    );
    const editing = editId ? catalog.find((p) => p.id === editId) : undefined;
    const detail = detailId ? catalog.find((p) => p.id === detailId) || null : null;
    const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);

    // Quem pode mexer no stock diz logo quanto tem do produto novo (um só formulário para criar um produto)
    const stockLocations = useMemo(() => {
        if (!ctx?.canEdit?.("inventory")) return undefined;
        const locs = ctx.isMultiLocation ? (ctx.locations || []).map((l) => ({ id: l.id, name: l.name })) : [];
        return locs.length ? locs : [{ id: "Principal", name: "Principal" }];
    }, [ctx]);

    // Chegou de outra aba de Produtos: `?novo=1` abre "Novo produto"; `?produto=Nome` abre a ficha desse produto
    const params = useSearchParams();
    const router = useRouter();
    const wantsNew = params.get("novo") === "1";
    const wantsProduct = params.get("produto");
    useEffect(() => {
        if (!wantsNew && !wantsProduct) return;
        if (wantsProduct) {
            if (!catalog.length) return; // espera pelo catálogo
            const found = catalog.find((p) => nameKey(p.name) === nameKey(wantsProduct));
            if (found) setDetailId(found.id);
        }
        if (wantsNew && !readOnly) { setAddPrefill(""); setAddOpen(true); }
        router.replace("/catalog");
    }, [wantsNew, wantsProduct, catalog, readOnly, router]);

    if (!ctx) return <div className="p-4 text-muted-foreground">A carregar o catálogo…</div>;

    // ---------- produtos ----------
    /** A categoria escolhida ainda não existe (ex.: "Geral" numa empresa nova, ou uma escrita na hora) → cria-a. */
    const ensureCategory = (name?: string) => {
        const n = (name || "").trim();
        if (n && !categories.some((c) => nameKey(c.name) === nameKey(n))) ctx.addCatalogCategory(n);
    };
    const commitAdd = (data: Omit<CatalogProduct, "id">, initialStock?: InitialStock) => {
        clearDraft(draftKey); // o produto já foi criado: o rascunho acabou
        ensureCategory(data.category);
        ctx.addCatalogProduct(data);
        // o que já tem entra no stock (fica registado no histórico como "Criação de novo produto")
        if (initialStock && initialStock.quantity > 0) {
            // sem campos "undefined" (o Firestore recusa-os)
            const { priceHistory: _ph, imageUrl, ...fields } = data;
            ctx.addProduct({ ...fields, ...(imageUrl ? { imageUrl } : {}), stock: initialStock.quantity, location: initialStock.location || "Principal" } as Parameters<typeof ctx.addProduct>[0]);
        }
        const inStock = initialStock && initialStock.quantity > 0 ? ` e ${initialStock.quantity} ${data.unit || "un"} em stock` : "";
        toast({ title: "Produto adicionado", description: `«${data.name}» está no catálogo${inStock}.${offline() ? " Fica guardado neste aparelho até haver internet." : ""}` });
    };
    const handleAdd = async (data: Omit<CatalogProduct, "id">, initialStock?: InitialStock) => {
        // conta nova: o primeiro produto pede a confirmação do email (o rascunho fica guardado se desistir)
        if (!(await requireEmailConfirmed())) return;
        if (data.barcode) {
            const clash = findBarcodeClash(catalog, data.barcode);
            if (clash) { toast({ variant: "destructive", title: "Esse código de barras já existe", description: `Pertence a «${clash.name}». Cada produto tem o seu código.` }); return; }
        }
        const existing = findDuplicate(catalog, data.name);
        if (existing) { setDup({ data, existing, initialStock }); return; } // pergunta antes de criar um repetido
        commitAdd(data, initialStock);
    };
    /** Produto com variações: uma entrada no catálogo por variação, todas com o mesmo `variantGroup`. */
    const handleAddVariants = async (base: Omit<CatalogProduct, "id">, variants: { name: string; values: Record<string, string>; price: number }[], existing: string[]) => {
        if (readOnly) return;
        if (!(await requireEmailConfirmed())) return;
        clearDraft(draftKey);
        ensureCategory(base.category);
        const group = base.name.trim();
        for (const v of variants) {
            ctx.addCatalogProduct({ ...base, name: v.name, price: v.price, variantGroup: group, variantValues: v.values });
        }
        toast({
            title: `${variants.length} variaç${variants.length === 1 ? "ão criada" : "ões criadas"}`,
            description: `«${group}»: ${variants.map((v) => Object.values(v.values).join(" / ")).slice(0, 4).join(", ")}${variants.length > 4 ? "…" : ""}.${existing.length ? ` ${existing.length} já existia${existing.length === 1 ? "" : "m"}.` : ""}${offline() ? " Ficam guardadas neste aparelho até haver internet." : ""}`,
        });
    };
    /** Mais uma variação para uma família que já existe: herda preço, custo, unidade, categoria e foto de uma irmã. */
    const handleAddOneVariant = (values: Record<string, string>, name: string) => {
        const group = newVariantOf;
        setNewVariantOf(null);
        if (!group || readOnly) return;
        const model = siblingsOf({ name: group, variantGroup: group }, catalog)[0];
        if (!model) return;
        const { id: _id, priceHistory: _ph, barcode: _bc, variantValues: _vv, ...rest } = model;
        ctx.addCatalogProduct({ ...rest, name, barcode: "", variantGroup: group, variantValues: values });
        toast({ title: "Variação criada", description: `«${name}» está no catálogo.` });
    };
    const handleUpdate = async (id: string, data: Partial<CatalogProduct>) => {
        if (data.name) {
            const clash = findDuplicate(catalog, data.name, id);
            if (clash) { toast({ variant: "destructive", title: "Esse nome já existe", description: `Já há «${clash.name}» no catálogo. Escolha outro nome.` }); return; }
        }
        if (data.barcode) {
            const clash = findBarcodeClash(catalog, data.barcode, id);
            if (clash) { toast({ variant: "destructive", title: "Esse código de barras já existe", description: `Pertence a «${clash.name}».` }); return; }
        }
        const before = byId.get(id);
        const patch: Partial<CatalogProduct> = { ...data };
        // nome novo: muda também no stock (todas as localizações), receitas e encomendas em aberto
        if (before && data.name && data.name.trim() !== before.name) {
            if (!(await ctx.renameProduct(before.name, data.name))) return;
            delete patch.name;
        }
        if (before && typeof data.price === "number" && data.price !== (before.price || 0)) {
            patch.priceHistory = pushPriceHistory(before.priceHistory, { at: new Date().toISOString(), from: before.price || 0, to: data.price, by: username });
        }
        // variação com custo mudado à mão: o custo da família deixa de a substituir
        if (before?.variantGroup && typeof data.cost === "number" && data.cost !== (before.cost || 0)) patch.ownCost = true;
        const n = Object.keys(patch).length ? await ctx.updateCatalogProducts([{ id, data: patch }]) : 1;
        if (n) toast({ title: "Produto atualizado" });
    };
    const askBulk = (kind: "category" | "price" | "delete", ids: string[]) => {
        setBulk({ kind, ids }); setBulkCat(""); setBulkNewCat(""); setBulkPct("");
    };

    const confirmDelete = async () => {
        if (!bulk) return;
        const ids = bulk.ids;
        setBulk(null);
        const n = await ctx.deleteCatalogProducts(ids);
        if (!n) return;
        toast({
            title: `${n} produto${n === 1 ? "" : "s"} movido${n === 1 ? "" : "s"} para a lixeira`,
            description: "Podem ser restaurados em Definições → Lixeira.",
            action: <ToastAction altText="Desfazer" onClick={() => ctx.updateCatalogProducts(ids.map((id) => ({ id, data: { deletedAt: null, deletedBy: null } as unknown as Partial<CatalogProduct> })))}>Desfazer</ToastAction>,
        });
    };
    const confirmCategory = async () => {
        if (!bulk) return;
        const target = bulkCat === NEW ? bulkNewCat.trim() : bulkCat;
        if (!target) return;
        if (bulkCat === NEW && !categories.some((c) => nameKey(c.name) === nameKey(target))) await ctx.addCatalogCategory(target);
        const name = categories.find((c) => nameKey(c.name) === nameKey(target))?.name || target;
        const ids = bulk.ids;
        setBulk(null);
        const n = await ctx.updateCatalogProducts(ids.map((id) => ({ id, data: { category: name } })));
        if (n) toast({ title: `${n} produto${n === 1 ? "" : "s"} em «${name}»` });
    };
    const pct = parsePct(bulkPct);
    const confirmPrice = async () => {
        if (!bulk || pct === null || pct === 0) return;
        const ids = bulk.ids;
        setBulk(null);
        const at = new Date().toISOString();
        const n = await ctx.updateCatalogProducts(ids.flatMap((id) => {
            const p = byId.get(id);
            if (!p) return [];
            const to = adjustPrice(p.price || 0, pct);
            return [{ id, data: { price: to, priceHistory: pushPriceHistory(p.priceHistory, { at, from: p.price || 0, to, by: username }) } }];
        }));
        if (n) toast({ title: `Preço ${pct > 0 ? "subiu" : "desceu"} ${Math.abs(pct)}% em ${n} produto${n === 1 ? "" : "s"}` });
    };

    // ---------- categorias ----------
    const confirmCategoryDialog = () => {
        if (!catDialog) return;
        const name = catName.trim();
        if (!name) { toast({ variant: "destructive", title: "Escreva o nome da categoria" }); return; }
        const clash = categories.find((c) => nameKey(c.name) === nameKey(name) && c.id !== catDialog.cat?.id);
        if (clash) { toast({ variant: "destructive", title: "Essa categoria já existe", description: `«${clash.name}»` }); return; }
        if (catDialog.mode === "add") {
            ctx.addCatalogCategory(name);
            toast({ title: "Categoria adicionada", description: `«${name}»` });
        } else if (catDialog.cat && firestore && companyId) {
            const old = catDialog.cat;
            updateDocumentNonBlocking(doc(firestore, `companies/${companyId}/catalogCategories`, old.id), { name });
            // também os da lixeira, para não voltarem com a categoria antiga
            ctx.updateCatalogProducts(allCatalog.filter((p) => p.category === old.name).map((p) => ({ id: p.id, data: { category: name } })));
            if (category === old.name) setCategory(name);
            toast({ title: "Categoria renomeada", description: `«${old.name}» → «${name}»` });
        }
        setCatDialog(null); setCatName("");
    };
    const confirmDeleteCategory = async () => {
        if (!delCat) return;
        const c = delCat;
        setDelCat(null);
        if (await ctx.deleteCatalogCategory(c.id)) toast({ title: "Categoria apagada", description: `«${c.name}»` });
    };

    const collectionRef = (name: string) => collection(firestore!, `companies/${companyId}/${name}`);

    // ---------- sincronizar com o inventário ----------
    const startSync = () => {
        const plan = buildSyncPlan(inventory || [], catalog, categories.map((c) => c.name));
        if (!plan.products.length) { toast({ title: "Tudo sincronizado", description: "Todos os produtos do inventário já estão no catálogo." }); return; }
        setSyncPlan(plan);
    };
    const runSync = async () => {
        if (!syncPlan || !firestore || !companyId) return;
        const plan = syncPlan;
        setSyncPlan(null);
        const total = plan.newCategories.length + plan.products.length;
        setSyncing({ done: 0, total });
        try {
            const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [
                ...plan.newCategories.map((name) => (b: ReturnType<typeof writeBatch>) => b.set(doc(collectionRef("catalogCategories")), { name })),
                ...plan.products.map((p) => (b: ReturnType<typeof writeBatch>) => b.set(doc(collectionRef("catalogProducts")), p)),
            ];
            for (let i = 0; i < ops.length; i += 400) {
                const batch = writeBatch(firestore);
                ops.slice(i, i + 400).forEach((op) => op(batch));
                if (offline()) batch.commit().catch(() => { }); else await batch.commit();
                setSyncing({ done: Math.min(i + 400, ops.length), total });
            }
            toast({ title: "Sincronização concluída", description: `${plan.products.length} produto${plan.products.length === 1 ? "" : "s"} adicionado${plan.products.length === 1 ? "" : "s"} ao catálogo.` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Erro ao sincronizar", description: e?.message || "Tente de novo: o que já foi gravado não se perde." });
        } finally { setSyncing(null); }
    };
    // ---------- importação (como antes) ----------
    const handleBulkImport = async (rawResult: CatalogImportResult) => {
        if (!firestore || !companyId) return;
        // um código de barras só pode ter um produto: os repetidos (no catálogo ou na própria lista) entram sem código
        const used = new Set(catalog.filter((c) => c.barcode).map((c) => sameCodeKey(c.barcode!)));
        let droppedCodes = 0;
        const result: CatalogImportResult = {
            ...rawResult,
            create: rawResult.create.map((c) => {
                if (!c.barcode) return c;
                const k = sameCodeKey(c.barcode);
                if (used.has(k)) { droppedCodes++; const { barcode, ...rest } = c; return rest; }
                used.add(k);
                return c;
            }),
        };
        toast({ title: "A importar produtos…" });
        try {
            const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [
                ...result.newCategories.map((name) => (b: ReturnType<typeof writeBatch>) => b.set(doc(collectionRef("catalogCategories")), { name })),
                ...result.create.map((prod) => (b: ReturnType<typeof writeBatch>) => b.set(doc(collectionRef("catalogProducts")), prod)),
                ...result.updatePrices.map((u) => (b: ReturnType<typeof writeBatch>) => {
                    const old = byId.get(u.id);
                    b.update(doc(firestore, `companies/${companyId}/catalogProducts`, u.id), { price: u.price, ...(old ? { priceHistory: pushPriceHistory(old.priceHistory, { at: new Date().toISOString(), from: old.price || 0, to: u.price, by: username }) } : {}) });
                }),
            ];
            for (let i = 0; i < ops.length; i += 400) {
                const batch = writeBatch(firestore);
                ops.slice(i, i + 400).forEach((op) => op(batch));
                await batch.commit();
            }
            const parts = [`${result.create.length} produtos importados`];
            if (result.updatePrices.length) parts.push(`${result.updatePrices.length} preços actualizados`);
            if (droppedCodes) parts.push(`${droppedCodes} código${droppedCodes === 1 ? "" : "s"} de barras repetido${droppedCodes === 1 ? "" : "s"} ignorado${droppedCodes === 1 ? "" : "s"}`);
            toast({ title: "Importação concluída", description: parts.join(", ") + "." });
            setTab("products");
        } catch (e) {
            console.error("Bulk import error:", e);
            toast({ variant: "destructive", title: "Erro", description: "Erro na importação. Nada foi perdido: tente de novo." });
            throw e;
        }
    };

    const rows: CatalogRow[] = catalog;

    return (
        <>
            <Tabs value={tab} onValueChange={setTab} className="mt-4">
                <div className="flex items-center gap-2">
                    <TabsList className="grid flex-1 grid-cols-3" data-tour="catalog-tabs">
                        <TabsTrigger value="products">Produtos</TabsTrigger>
                        <TabsTrigger value="categories">Categorias</TabsTrigger>
                        <TabsTrigger value="import">Importar</TabsTrigger>
                    </TabsList>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Mais opções do catálogo" data-tour="catalog-more"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={startSync} disabled={readOnly || syncing !== null}><RefreshCw className="mr-2 h-4 w-4" /> Sincronizar com o inventário</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {!readOnly && <Button data-tour="catalog-new" className="hidden shrink-0 md:inline-flex" onClick={() => { setAddPrefill(""); setAddOpen(true); }}><Plus className="mr-1.5 h-4 w-4" /> Novo produto</Button>}
                </div>

                {syncing && (
                    <div className="mt-3 rounded-xl border p-3 text-sm" role="status">
                        <div className="mb-2 flex justify-between"><span>A sincronizar com o inventário…</span><span className="tabular-nums">{syncing.done} / {syncing.total}</span></div>
                        <Progress value={(syncing.done / Math.max(1, syncing.total)) * 100} />
                    </div>
                )}

                <TabsContent value="products" className="mt-4">
                    <CatalogProductsView
                        products={rows}
                        categories={categoryNames}
                        loading={loading}
                        readOnly={readOnly}
                        term={term} onTerm={setTerm}
                        category={category} onCategory={setCategory}
                        onAdd={(name) => { setAddPrefill(name || ""); setAddOpen(true); }}
                        onOpen={(p) => setDetailId(p.id)}
                        onEdit={(p) => setEditId(p.id)}
                        onDelete={(p) => askBulk("delete", [p.id])}
                        onBulk={askBulk}
                    />
                </TabsContent>

                <TabsContent value="categories" className="mt-4">
                    <CatalogCategoriesView
                        rows={catRows}
                        loading={loading}
                        readOnly={readOnly}
                        onAdd={() => { setCatName(""); setCatDialog({ mode: "add" }); }}
                        onRename={(c) => { setCatName(c.name); setCatDialog({ mode: "rename", cat: c }); }}
                        onDelete={setDelCat}
                        onOpen={(name) => { setCategory(name); setTerm(""); setTab("products"); }}
                    />
                </TabsContent>

                <TabsContent value="import" className="mt-4">
                    <CatalogImporter
                        existing={catalog.map((p) => ({ id: p.id, name: p.name, price: p.price }))}
                        categories={categoryNames}
                        onImport={handleBulkImport}
                    />
                </TabsContent>
            </Tabs>

            {/* adicionar / editar */}
            <AddCatalogProductDialog
                open={addOpen}
                onOpenChange={(o) => { setAddOpen(o); if (!o) { setDupSource(null); setVariantSource(null); } }}
                hideTrigger
                categories={categoryNames}
                units={ctx.availableUnits || []}
                defaultCategory={category !== "all" ? category : undefined}
                defaultName={addPrefill}
                catalog={catalog}
                initial={variantSource ? { name: variantSource.name, category: variantSource.category, price: variantSource.price, cost: variantSource.cost || 0, unit: variantSource.unit || "un", imageUrl: variantSource.imageUrl || "", barcode: "", lowStockThreshold: variantSource.lowStockThreshold, criticalStockThreshold: variantSource.criticalStockThreshold } : dupSource ? { name: copyName(catalog, dupSource.name), category: dupSource.category, price: dupSource.price, cost: dupSource.cost || 0, unit: dupSource.unit || "un", imageUrl: dupSource.imageUrl || "", barcode: "", lowStockThreshold: dupSource.lowStockThreshold, criticalStockThreshold: dupSource.criticalStockThreshold } : undefined}
                startWithVariants={!!variantSource}
                onAdd={handleAdd}
                stockLocations={stockLocations}
                draftKey={draftKey}
                onAddVariants={handleAddVariants}
            />
            {editing && (
                <EditCatalogProductDialog
                    open
                    hideTrigger
                    onOpenChange={(o) => { if (!o) setEditId(null); }}
                    product={editing}
                    catalog={catalog}
                    categories={categoryNames}
                    units={ctx.availableUnits || []}
                    onUpdate={handleUpdate}
                />
            )}

            {familyRename && (
                <RenameProductDialog name={familyRename} open={!!familyRename} onClose={() => setFamilyRename(null)} startFamily />
            )}

            <CatalogProductDetail
                product={detail}
                inventory={inventory || []}
                sales={sales || []}
                locations={locations || []}
                readOnly={readOnly}
                family={catalog}
                onClose={() => setDetailId(null)}
                onOpenSibling={(p) => setDetailId(p.id || null)}
                onEditFamily={(p) => { setDetailId(null); setFamilyRename(p.name); }}
                onAddVariant={(p) => { setDetailId(null); setNewVariantOf(p.variantGroup || null); }}
                onCreateVariants={(p) => { setDetailId(null); setAddPrefill(""); setVariantSource(p as CatalogProduct); setAddOpen(true); }}
                onEdit={(p) => { setDetailId(null); setEditId(p.id || null); }}
                onDuplicate={(p) => { setDetailId(null); setAddPrefill(""); setDupSource(p as CatalogProduct); setAddOpen(true); }}
                onDelete={(p) => { setDetailId(null); if (p.id) askBulk("delete", [p.id]); }}
            />

            <AddVariantDialog
                group={newVariantOf}
                members={newVariantOf ? siblingsOf({ name: newVariantOf, variantGroup: newVariantOf }, catalog) : []}
                catalogNames={catalog.map((p) => p.name)}
                onClose={() => setNewVariantOf(null)}
                onCreate={handleAddOneVariant}
            />

            {/* produto repetido */}
            <AlertDialog open={!!dup} onOpenChange={(o) => !o && setDup(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Este produto já existe</AlertDialogTitle>
                        <AlertDialogDescription>
                            Já há «{dup?.existing.name}» no catálogo ({dup?.existing.category}, {formatCurrency(dup?.existing.price || 0)}). Quer criar «{dup?.data.name}» mesmo assim?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { if (dup) commitAdd(dup.data, dup.initialStock); setDup(null); }}>Criar mesmo assim</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* apagar produtos */}
            <AlertDialog open={bulk?.kind === "delete"} onOpenChange={(o) => !o && setBulk(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apagar {bulk?.ids.length} produto{bulk?.ids.length === 1 ? "" : "s"}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {bulk && bulk.ids.length === 1 ? `«${byId.get(bulk.ids[0])?.name}» vai` : "Vão"} para a lixeira e deixam de aparecer em vendas, encomendas e entradas. O stock do inventário não muda. Pode restaurar em Definições → Lixeira.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Apagar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* mudar categoria */}
            <AlertDialog open={bulk?.kind === "category"} onOpenChange={(o) => !o && setBulk(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Mudar categoria de {bulk?.ids.length} produto{bulk?.ids.length === 1 ? "" : "s"}</AlertDialogTitle>
                        <AlertDialogDescription>Escolha a categoria de destino.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                        <Select value={bulkCat} onValueChange={setBulkCat}>
                            <SelectTrigger aria-label="Categoria de destino"><SelectValue placeholder="Escolha a categoria…" /></SelectTrigger>
                            <SelectContent>
                                {categoryNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                <SelectItem value={NEW}>＋ Nova categoria…</SelectItem>
                            </SelectContent>
                        </Select>
                        {bulkCat === NEW && <Input autoFocus value={bulkNewCat} onChange={(e) => setBulkNewCat(e.target.value)} placeholder="Nome da nova categoria" aria-label="Nome da nova categoria" />}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmCategory} disabled={!bulkCat || (bulkCat === NEW && !bulkNewCat.trim())}>Mudar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ajustar preço */}
            <AlertDialog open={bulk?.kind === "price"} onOpenChange={(o) => !o && setBulk(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Ajustar o preço de {bulk?.ids.length} produto{bulk?.ids.length === 1 ? "" : "s"}</AlertDialogTitle>
                        <AlertDialogDescription>Escreva a percentagem: «10» sobe 10%, «-5» desce 5%.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5"><Label htmlFor="bulk-pct">Percentagem (%)</Label><Input id="bulk-pct" autoFocus inputMode="decimal" value={bulkPct} onChange={(e) => setBulkPct(e.target.value)} placeholder="Ex.: 10" /></div>
                        {bulkPct.trim() !== "" && pct === null && <p className="text-sm text-destructive">Valor inválido.</p>}
                        {pct !== null && pct !== 0 && bulk && (
                            <ul className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm" aria-label="Exemplos">
                                {bulk.ids.slice(0, 3).map((id) => { const p = byId.get(id); return p ? <li key={id} className="flex justify-between gap-3"><span className="truncate">{p.name}</span><span className="whitespace-nowrap tabular-nums">{formatCurrency(p.price || 0)} → <b>{formatCurrency(adjustPrice(p.price || 0, pct))}</b></span></li> : null; })}
                                {bulk.ids.length > 3 && <li className="text-muted-foreground">e mais {bulk.ids.length - 3}…</li>}
                            </ul>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmPrice} disabled={pct === null || pct === 0}>Aplicar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* categorias */}
            <AlertDialog open={!!catDialog} onOpenChange={(o) => !o && setCatDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{catDialog?.mode === "add" ? "Nova categoria" : "Renomear categoria"}</AlertDialogTitle>
                        <AlertDialogDescription>{catDialog?.mode === "add" ? "Escreva o nome da categoria." : "Todos os produtos dela são atualizados."}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-1.5"><Label htmlFor="cat-name">Nome da categoria</Label><Input id="cat-name" autoFocus value={catName} onChange={(e) => setCatName(e.target.value)} placeholder={categoryPlaceholder} onKeyDown={(e) => { if (e.key === "Enter") confirmCategoryDialog(); }} /></div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmCategoryDialog(); }}>{catDialog?.mode === "add" ? "Adicionar" : "Guardar"}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!delCat} onOpenChange={(o) => !o && setDelCat(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Apagar a categoria «{delCat?.name}»?</AlertDialogTitle><AlertDialogDescription>Está vazia, por isso não afeta nenhum produto.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Apagar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* sincronizar */}
            <AlertDialog open={!!syncPlan} onOpenChange={(o) => !o && setSyncPlan(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Acrescentar {syncPlan?.products.length} produto{syncPlan?.products.length === 1 ? "" : "s"} ao catálogo?</AlertDialogTitle>
                        <AlertDialogDescription>Estão no inventário mas ainda não no catálogo{syncPlan?.newCategories.length ? ` (e serão criadas ${syncPlan.newCategories.length} categoria${syncPlan.newCategories.length === 1 ? "" : "s"})` : ""}.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg bg-muted/40 p-3 text-sm">
                        {syncPlan?.products.slice(0, 12).map((p) => <li key={p.name} className="truncate">{p.name} <span className="text-muted-foreground">· {p.category}</span></li>)}
                        {syncPlan && syncPlan.products.length > 12 && <li className="text-muted-foreground">e mais {syncPlan.products.length - 12}…</li>}
                    </ul>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={runSync}>Acrescentar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
