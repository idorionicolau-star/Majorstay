"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Layers, Loader2, Pencil, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInventory } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { nameKey, pushPriceHistory } from "@/lib/catalog-view";
import { renameClash, renamePairs, type RenamePair } from "@/lib/rename";
import { cleanOptions, optionsOfFamily, planVariants, SUGGESTED_VALUES, variantName, type VariantValues } from "@/lib/variants";
import { VariantsEditor, type VariantsState } from "@/components/catalog/variants-editor";
import type { Product } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { evalQty } from "@/lib/calc";

/** Quem pode mudar nomes e variações: quem gere o inventário. */
export function useCanRename() {
    const { canEdit, isReadOnly } = useInventory();
    return !isReadOnly && canEdit("inventory");
}

/** Variação nova com a quantidade que entrou agora (só em Entrada) — vai para o lote do Stock Rápido. */
export type NewVariantEntry = { product: Product; qty: number; /** o produto que já existia (agora 1.ª variação): entra no lote como produto existente */ existing?: boolean };

const clean = (s: string) => s.trim().replace(/\s+/g, " ");
const toQty = (s: string) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };

/**
 * Editar um produto no Stock Rápido: mudar o nome (em todo o programa) e as variações —
 * criar variações num produto que ainda não as tem, mudar o valor de uma, acrescentar novas.
 */
export function RenameProductDialog({ name, open, onClose, onDone, location, withQty, onEntries, pendingNew = [], startFamily = false }: {
    name: string;
    open: boolean;
    onClose: () => void;
    /** nomes que mudaram (para o lote do Stock Rápido seguir) */
    onDone?: (pairs: RenamePair[]) => void;
    /** localização do Stock Rápido (para mostrar o stock de cada variação) */
    location?: string;
    /** Entrada: pede a quantidade que entrou de cada variação nova */
    withQty?: boolean;
    onEntries?: (entries: NewVariantEntry[]) => void;
    /** variações novas que estão no lote por registar (não se pode juntar stock a elas antes de registar) */
    pendingNew?: string[];
    /** "Editar família" (Catálogo): nome base, preço para as variações sem preço e variações, numa janela só */
    startFamily?: boolean;
}) {
    const { catalogProducts, products, renameProduct, addCatalogProduct, updateCatalogProducts, updateProduct, canEdit, user, mergeIntoVariant } = useInventory();
    const { toast } = useToast();
    const catalog = useMemo(() => (catalogProducts || []).filter((c) => !c.deletedAt), [catalogProducts]);
    const all = useMemo(() => [...catalog, ...(products || [])], [catalog, products]);
    const product = useMemo(() => all.find((p) => nameKey(p.name) === nameKey(name)), [all, name]);
    const group = product?.variantGroup;

    // a família: um por nome (catálogo + stock), com o stock desta localização
    const members = useMemo(() => {
        type Row = { name: string; values: VariantValues; stock: number; unit: string; price: number; cost: number; ownCost: boolean; fromCatalog: boolean };
        if (!group) return [] as Row[];
        const k = nameKey(group);
        const by = new Map<string, Row>();
        for (const p of all) {
            if (!p.variantGroup || nameKey(p.variantGroup) !== k) continue;
            const key = nameKey(p.name);
            const isStock = "instanceId" in p && !!(p as Product).instanceId;
            const cur = by.get(key) || { name: p.name, values: p.variantValues || {}, stock: 0, unit: p.unit || "un", price: 0, cost: 0, ownCost: false, fromCatalog: false };
            // o preço do catálogo manda; sem catálogo, o do stock
            if (!isStock && p.price) { cur.price = p.price; cur.fromCatalog = true; } else if (!cur.fromCatalog && p.price) cur.price = p.price;
            // o custo também: o do catálogo manda; "custo próprio" (mudado à mão) está no catálogo
            if (!isStock) { if (p.cost) cur.cost = p.cost; if (p.ownCost) cur.ownCost = true; } else if (!cur.cost && p.cost) cur.cost = p.cost;
            if (isStock && (!location || ((p as Product).location || "") === location)) cur.stock += (p as Product).stock || 0;
            by.set(key, cur);
        }
        return [...by.values()].sort((a, b) => a.name.localeCompare(b.name, "pt", { numeric: true }));
    }, [all, group, location]);
    const options = useMemo(() => optionsOfFamily(members.map((m) => ({ variantValues: m.values }))), [members]);
    const order = options.map((o) => o.name);

    // ---- nome
    const [family, setFamily] = useState(false);
    const [value, setValue] = useState(name);
    const [saving, setSaving] = useState(false);
    // ---- variações
    const [editing, setEditing] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<VariantValues>({});
    const [editPrice, setEditPrice] = useState("");
    const [editCost, setEditCost] = useState("");
    // variações novas: o mesmo editor do produto novo (tipos, valores com sugestões, quantidade e preço de cada uma)
    const [vstate, setVstate] = useState<VariantsState>({ enabled: true, options: [{ name: "Cor", values: [] }], prices: {} });
    const [vqty, setVqty] = useState<Record<string, string>>({});
    /** num produto que passa a ter variações: em qual fica o stock que já existe */
    const [stockTo, setStockTo] = useState("");
    // ---- criar variações num produto que não as tem
    const [converting, setConverting] = useState(false);
    // ---- editar a família (Catálogo): o preço da família só preenche as variações sem preço
    const familyMode = startFamily && !!group;
    const [famPrice, setFamPrice] = useState("");
    const famPriceN = famPrice.trim() ? evalQty(famPrice) : 0;
    const famPriceOk = Number.isFinite(famPriceN) && famPriceN > 0;
    const blanks = members.filter((m) => !m.price);
    /** "aplicar também às que já têm preço" (por omissão, o preço da família só preenche as sem preço) */
    const [priceAll, setPriceAll] = useState(false);
    const priced = famPriceOk ? members.filter((m) => m.price && m.price !== famPriceN) : [];
    const priceFill = famPriceOk ? [...blanks, ...(priceAll ? priced : [])] : [];
    // custo da família: um custo único para todas, menos as que tiveram o custo mudado à mão
    const [famCost, setFamCost] = useState("");
    const famCostN = famCost.trim() ? evalQty(famCost) : 0;
    const famCostOk = Number.isFinite(famCostN) && famCostN > 0;
    const unified = members.filter((m) => !m.ownCost);
    const costFill = famCostOk ? unified.filter((m) => m.cost !== famCostN) : [];

    useEffect(() => {
        if (!open) return;
        setFamily(!!(startFamily && group)); setValue(startFamily && group ? group : name); setSaving(false);
        setEditing(null); setVqty({}); setStockTo(""); setConverting(false); setFamPrice(""); setPriceAll(false);
        // o custo único que a família já tem (se as variações sem custo próprio têm todas o mesmo)
        const costs = [...new Set(members.filter((m) => !m.ownCost).map((m) => m.cost))];
        setFamCost(costs.length === 1 && costs[0] > 0 ? String(costs[0]) : "");
        setVstate({ enabled: true, options: order.length ? order.map((n) => ({ name: n, values: [] })) : [{ name: "Cor", values: [] }], prices: {} });
    }, [open, name, group]); // eslint-disable-line react-hooks/exhaustive-deps

    const allNames = useMemo(() => all.map((p) => p.name), [all]);
    const vOrder = cleanOptions(vstate.options).map((o) => o.name);
    const vplan = planVariants(group || name, vstate.options, allNames);
    const chosen = vplan.create.find((v) => v.name === stockTo) || vplan.create[0];
    const familyHints = useMemo(() => Object.fromEntries(options.map((o) => [o.name, o.values])), [options]);

    const pairs = product ? renamePairs(product, value, all, family) : [];
    const clash = pairs.length ? renameClash(pairs, all) : null;
    const taken = (n: string) => all.some((p) => nameKey(p.name) === nameKey(n));

    /** o modelo para variações novas: preço, custo, unidade, categoria, alertas e foto */
    const model = () => {
        const src = catalog.find((c) => nameKey(c.name) === nameKey(name)) || product;
        const p = (src || {}) as Partial<Product>;
        return {
            // na família, as variações novas sem preço próprio levam o preço da família
            category: p.category || "Geral", price: familyMode && famPriceOk ? famPriceN : p.price || 0, cost: familyMode && famCostOk ? famCostN : p.cost || 0, unit: p.unit || "un",
            lowStockThreshold: p.lowStockThreshold ?? 10, criticalStockThreshold: p.criticalStockThreshold ?? 5,
            ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
        };
    };
    /** cria as variações no catálogo e (em Entrada) junta ao lote as que trazem quantidade */
    const createVariants = async (base: string, list: { values: VariantValues; qty: number; price?: number }[], ord: string[]) => {
        const m = model();
        const entries: NewVariantEntry[] = [];
        for (const v of list) {
            const n = variantName(base, v.values, ord);
            const price = v.price && v.price > 0 ? v.price : m.price;
            await addCatalogProduct({ ...m, price, name: n, variantGroup: base, variantValues: v.values } as Parameters<typeof addCatalogProduct>[0]);
            if (v.qty > 0) entries.push({ qty: v.qty, product: { ...m, price, name: n, variantGroup: base, variantValues: v.values, instanceId: `new-${n}`, stock: 0, reservedStock: 0, lastUpdated: "" } as Product });
        }
        if (entries.length) onEntries?.(entries);
    };

    const saveName = async () => {
        if (!pairs.length || clash || saving) return;
        setSaving(true);
        const ok = await renameProduct(name, value, { family });
        setSaving(false);
        if (!ok) return;
        toast({ title: "Nome mudado", description: pairs.length > 1 ? `${pairs.length} variações passam a «${clean(value)} - …».` : `«${pairs[0].from}» passa a «${pairs[0].to}» em todo o programa.` });
        onDone?.(pairs);
        onClose();
    };

    /**
     * "Editar família": o preço vai só para as variações sem preço (as outras guardam o seu);
     * o custo vai para todas as que não têm custo próprio; depois o nome.
     */
    const saveFamily = async () => {
        const fill = priceFill;
        if (clash || saving) return;
        if (!pairs.length && !fill.length && !costFill.length) {
            toast({
                title: "Nada a mudar",
                description: famPriceOk && priced.length
                    ? "Todas as variações já têm preço próprio. Marque «Aplicar também às que já têm preço» para o mudar em todas."
                    : "O nome, o preço e o custo já estão assim.",
            });
            return;
        }
        setSaving(true);
        for (const m of fill) await setPrice(m.name, famPriceN);
        for (const m of costFill) await setCost(m.name, famCostN, false);
        const ok = pairs.length ? await renameProduct(name, value, { family: true }) : true;
        setSaving(false);
        if (!ok) return;
        toast({
            title: "Família actualizada",
            description: [
                pairs.length ? `Nome: «${clean(value)}».` : "",
                fill.length ? `${formatCurrency(famPriceN)} em ${fill.length} variaç${fill.length === 1 ? "ão" : "ões"}${priceAll && priced.length ? "" : " sem preço"}.` : "",
                costFill.length ? `Custo ${formatCurrency(famCostN)} em ${costFill.length} variaç${costFill.length === 1 ? "ão" : "ões"}.` : "",
            ].filter(Boolean).join(" "),
        });
        if (pairs.length) onDone?.(pairs);
        onClose();
    };

    /** preço de uma variação: no catálogo (com histórico de preços) e no stock de todas as localizações */
    const setPrice = async (productName: string, price: number) => {
        const k = nameKey(productName);
        const cat = catalog.filter((c) => c.id && nameKey(c.name) === k);
        if (cat.length && canEdit("settings")) {
            const at = new Date().toISOString();
            await updateCatalogProducts(cat.map((c) => ({ id: c.id!, data: { price, priceHistory: pushPriceHistory(c.priceHistory, { at, from: c.price || 0, to: price, by: user?.username }) } })));
        }
        for (const p of (products || []).filter((x) => nameKey(x.name) === k && x.instanceId)) await updateProduct(p.instanceId, { price });
    };

    /** custo de uma variação: no catálogo (chega ao stock) e no stock sem catálogo; `own` = mudado à mão */
    const setCost = async (productName: string, cost: number, own: boolean) => {
        const k = nameKey(productName);
        const cat = catalog.filter((c) => c.id && nameKey(c.name) === k);
        if (cat.length && canEdit("settings")) await updateCatalogProducts(cat.map((c) => ({ id: c.id!, data: { cost, ownCost: own } })));
        for (const p of (products || []).filter((x) => nameKey(x.name) === k && x.instanceId && (x.cost || 0) !== cost)) await updateProduct(p.instanceId, { cost });
    };

    const saveEdit = async (m: { name: string; values: VariantValues; price: number; cost: number }) => {
        const values = Object.fromEntries(order.map((k) => [k, clean(editValues[k] ?? m.values[k] ?? "")]));
        if (order.some((k) => !values[k]) || !group) return;
        const to = variantName(group, values, order);
        const renamed = nameKey(to) !== nameKey(m.name);
        const newPrice = toQty(editPrice);
        const repriced = editPrice.trim() !== "" && newPrice > 0 && newPrice !== m.price;
        const newCost = toQty(editCost);
        const recosted = editCost.trim() !== "" && newCost > 0 && newCost !== m.cost;
        if (!renamed && !repriced && !recosted) { setEditing(null); return; }
        if (renamed && taken(to)) { toast({ variant: "destructive", title: "Essa variação já existe", description: to }); return; }
        setSaving(true);
        if (renamed && !(await renameProduct(m.name, to, { set: { variantValues: values } }))) { setSaving(false); return; }
        if (repriced) await setPrice(renamed ? to : m.name, newPrice);
        // custo mudado só nesta variação: passa a ser próprio (o custo da família não o substitui)
        if (recosted) await setCost(renamed ? to : m.name, newCost, true);
        setSaving(false);
        setEditing(null);
        toast({ title: "Variação actualizada", description: [renamed ? `«${m.name}» passa a «${to}».` : "", repriced ? `Preço: ${formatCurrency(newPrice)}.` : "", recosted ? `Custo: ${formatCurrency(newCost)}.` : ""].filter(Boolean).join(" ") });
        if (renamed) onDone?.([{ from: m.name, to }]);
    };

    /** acrescenta à família as variações do editor (com quantidade e preço de cada uma) */
    const addMany = async () => {
        if (!group || !vplan.create.length || vplan.tooMany || saving) return;
        setSaving(true);
        await createVariants(group, vplan.create.map((v) => ({ values: v.values, qty: withQty ? toQty(vqty[v.name] || "") : 0, price: toQty(vstate.prices[v.name] || "") })), vOrder);
        setSaving(false);
        const inLot = withQty ? vplan.create.filter((v) => toQty(vqty[v.name] || "") > 0).length : 0;
        toast({ title: `${vplan.create.length} variaç${vplan.create.length === 1 ? "ão criada" : "ões criadas"}`, description: inLot ? `${inLot} no lote — confirme para dar entrada.` : `Estão no catálogo de «${group}».` });
        setVstate({ ...vstate, options: vstate.options.map((o) => ({ ...o, values: [] })), prices: {} });
        setVqty({});
    };

    const convert = async () => {
        if (!chosen || vplan.tooMany || saving) return;
        const base = name;
        setSaving(true);
        // preço próprio da variação onde fica o stock: grava-se antes de mudar o nome
        const ownPrice = toQty(vstate.prices[chosen.name] || "");
        if (ownPrice) await setPrice(name, ownPrice);
        // o produto actual (com o seu stock e histórico) passa a ser a variação escolhida
        const ok = await renameProduct(name, chosen.name, { set: { variantGroup: base, variantValues: chosen.values } });
        if (!ok) { setSaving(false); return; }
        // não estava no catálogo (só no stock): entra agora, para a família ficar completa
        if (!catalog.some((c) => nameKey(c.name) === nameKey(name))) {
            await addCatalogProduct({ ...model(), ...(ownPrice ? { price: ownPrice } : {}), name: chosen.name, variantGroup: base, variantValues: chosen.values } as Parameters<typeof addCatalogProduct>[0]);
        }
        const rest = vplan.create.filter((v) => v.name !== chosen.name);
        await createVariants(base, rest.map((v) => ({ values: v.values, qty: withQty ? toQty(vqty[v.name] || "") : 0, price: toQty(vstate.prices[v.name] || "") })), vOrder);
        // quantidade que entrou agora da variação onde fica o stock: soma ao produto que já existia
        const q = withQty ? toQty(vqty[chosen.name] || "") : 0;
        const stockHere = (products || []).find((p) => nameKey(p.name) === nameKey(name) && (!location || (p.location || "") === location));
        if (q > 0) {
            const renamed = { ...(stockHere || { ...model(), instanceId: `new-${chosen.name}`, stock: 0, reservedStock: 0, lastUpdated: "" }), name: chosen.name, variantGroup: base, variantValues: chosen.values } as Product;
            onEntries?.([{ product: renamed, qty: q, existing: !!stockHere }]);
        }
        setSaving(false);
        toast({ title: `«${base}» tem agora ${vplan.create.length} variações`, description: `O stock que já havia ficou em «${chosen.name}».` });
        onDone?.([{ from: name, to: chosen.name }]);
        onClose();
    };


    // Produto solto com o mesmo nome de uma família que já existe ("Pavê Borbulha" e "Pavê Borbulha - Preto", …):
    // o stock dele é de uma dessas variações (ou de uma nova) — junta-se à família.
    const sameFamily = useMemo(() => {
        if (group) return [] as Product[];
        const k = nameKey(name);
        return catalog.filter((c) => c.variantGroup && nameKey(c.variantGroup) === k && nameKey(c.name) !== k)
            .sort((a, b) => a.name.localeCompare(b.name, "pt", { numeric: true })) as unknown as Product[];
    }, [catalog, group, name]);
    const famOrder = useMemo(() => optionsOfFamily(sameFamily.map((m) => ({ variantValues: m.variantValues }))).map((o) => o.name), [sameFamily]);
    const myStockAll = (products || []).filter((p) => nameKey(p.name) === nameKey(name)).reduce((t, p) => t + (p.stock || 0), 0);
    const myStock = (products || []).filter((p) => nameKey(p.name) === nameKey(name) && (!location || (p.location || "") === location)).reduce((t, p) => t + (p.stock || 0), 0);
    const hasStockHere = (n: string) => (products || []).some((p) => nameKey(p.name) === nameKey(n) && (!location || (p.location || "") === location) && (p.stock || 0) > 0);
    const [joinNew, setJoinNew] = useState("");

    const join = async (targetName: string) => {
        setSaving(true);
        const ok = await mergeIntoVariant(name, targetName);
        setSaving(false);
        if (!ok) return;
        toast({ title: `Juntou-se à família «${sameFamily[0]?.variantGroup}»`, description: `O stock de «${name}» passou para «${targetName}».` });
        onDone?.([{ from: name, to: targetName }]);
        onClose();
    };
    const joinAsNew = async () => {
        const v = clean(joinNew);
        const base = sameFamily[0]?.variantGroup;
        if (!v || !base || famOrder.length !== 1) return;
        const values = { [famOrder[0]]: v };
        const to = variantName(base, values, famOrder);
        if (taken(to)) { await join(to); return; }
        setSaving(true);
        const ok = await renameProduct(name, to, { set: { variantGroup: base, variantValues: values } });
        if (ok && !catalog.some((c) => nameKey(c.name) === nameKey(name))) await addCatalogProduct({ ...model(), name: to, variantGroup: base, variantValues: values } as Parameters<typeof addCatalogProduct>[0]);
        setSaving(false);
        if (!ok) return;
        toast({ title: `Juntou-se à família «${base}»`, description: `«${name}» passa a «${to}».` });
        onDone?.([{ from: name, to }]);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader className="text-left">
                    <DialogTitle>{familyMode ? <>Editar família «{group}»</> : <>Editar «{name}»</>}</DialogTitle>
                    <DialogDescription>O nome e as variações mudam em todo o programa: catálogo, stock de todas as localizações, receitas e encomendas em aberto.</DialogDescription>
                </DialogHeader>

                {familyMode ? (
                <section className="space-y-3" data-tour="family-edit">
                    <div className="space-y-1.5">
                        <label htmlFor="rename-input" className="text-sm font-semibold">Nome da família</label>
                        <Input id="rename-input" value={value} onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveFamily(); } }} className="h-11 text-base" autoComplete="off" />
                        {clash ? <p className="text-sm text-destructive">Já há um produto chamado «{clash}».</p>
                            : pairs.length > 0 ? <p className="text-xs text-muted-foreground">Ex.: «{pairs[0].from}» → <b className="text-foreground">«{pairs[0].to}»</b></p> : null}
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="family-price" className="text-sm font-semibold">Preço da família</label>
                        <Input id="family-price" inputMode="decimal" value={famPrice} onChange={(e) => setFamPrice(e.target.value)} placeholder="Ex.: 550"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveFamily(); } }} className="h-11 text-base" autoComplete="off" />
                        <p className="text-xs text-muted-foreground">
                            {blanks.length
                                ? <>Vai para as <b className="text-foreground">{blanks.length} variaç{blanks.length === 1 ? "ão" : "ões"} sem preço</b> ({blanks.map((m) => order.map((k) => m.values[k]).filter(Boolean).join(" / ") || m.name).join(", ")}) e para as variações novas.</>
                                : <>Todas as variações já têm preço — esse fica. Este preço vai para as variações novas.</>}
                            {" "}As que já têm preço próprio não mudam (mude-as no lápis, abaixo).
                        </p>
                        {priced.length > 0 && (
                            <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                                <input type="checkbox" className="h-4 w-4 accent-primary" checked={priceAll} onChange={(e) => setPriceAll(e.target.checked)} data-tour="family-price-all" />
                                Aplicar também às {priced.length} que já têm preço
                            </label>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="family-cost" className="text-sm font-semibold">Custo da família</label>
                        <Input id="family-cost" inputMode="decimal" value={famCost} onChange={(e) => setFamCost(e.target.value)} placeholder="Ex.: 400"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveFamily(); } }} className="h-11 text-base" autoComplete="off" />
                        <p className="text-xs text-muted-foreground">
                            Um custo único para {unified.length === members.length ? <b className="text-foreground">todas as variações</b> : <b className="text-foreground">{unified.length} variaç{unified.length === 1 ? "ão" : "ões"}</b>} e para as novas.
                            {unified.length < members.length && <> {members.length - unified.length === 1 ? "A que tem" : `As ${members.length - unified.length} que têm`} custo próprio ({members.filter((m) => m.ownCost).map((m) => order.map((k) => m.values[k]).filter(Boolean).join(" / ") || m.name).join(", ")}) {members.length - unified.length === 1 ? "fica" : "ficam"} com o seu.</>}
                            {" "}Mudar o custo de uma variação no lápis torna-o próprio.
                        </p>
                    </div>
                    <Button type="button" className="h-11 w-full" onClick={saveFamily} disabled={(!pairs.length && !priceFill.length && !costFill.length && !famPriceOk) || !!clash || saving}>
                        {saving && !editing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Guardar
                    </Button>
                </section>
                ) : (
                <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Nome</h3>
                    {group && members.length > 1 && (
                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
                            {[{ v: false, label: "Só esta variação" }, { v: true, label: `A família (${members.length})` }].map((o) => (
                                <button key={String(o.v)} type="button" onClick={() => { setFamily(o.v); setValue(o.v ? group : name); }}
                                    className={cn("h-10 rounded-lg text-sm font-semibold", family === o.v ? "bg-background shadow-sm" : "text-muted-foreground")}>
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Input id="rename-input" aria-label={family ? "Nome da família" : "Nome novo"} value={value} onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveName(); } }} className="h-11 min-w-0 text-base" autoComplete="off" />
                        <Button type="button" className="h-11 shrink-0" onClick={saveName} disabled={!pairs.length || !!clash || saving}>
                            {saving && !editing && !converting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mudar nome"}
                        </Button>
                    </div>
                    {clash ? <p className="text-sm text-destructive">Já há um produto chamado «{clash}».</p>
                        : family && pairs.length > 0 ? <p className="text-xs text-muted-foreground">Ex.: «{pairs[0].from}» → <b className="text-foreground">«{pairs[0].to}»</b></p> : null}
                    <p className="text-xs text-muted-foreground">As vendas antigas passam a aparecer com o nome novo; as facturas já emitidas ficam como estão.</p>
                </section>
                )}

                {/* ---------- Variações ---------- */}
                <section className="space-y-2 border-t pt-4" data-tour="qs-edit-variants">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Layers className="h-4 w-4" /> Variações {group && <span className="font-normal text-muted-foreground">de {group}</span>}</h3>

                    {group ? (
                        <>
                            <ul className="divide-y rounded-xl border">
                                {members.map((m) => (
                                    <li key={m.name} className="px-3 py-2">
                                        {editing === m.name ? (
                                            <div className="space-y-2">
                                                {order.map((k) => (
                                                    <div key={k} className="flex items-center gap-2">
                                                        <span className="w-20 shrink-0 text-xs text-muted-foreground">{k}</span>
                                                        <Input value={editValues[k] ?? m.values[k] ?? ""} autoFocus={k === order[0]} list={`ev-${k}`}
                                                            onChange={(e) => setEditValues({ ...editValues, [k]: e.target.value })}
                                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(m); } }} className="h-9 min-w-0" />
                                                        <datalist id={`ev-${k}`}>{(SUGGESTED_VALUES[k] || []).map((v) => <option key={v} value={v} />)}</datalist>
                                                    </div>
                                                ))}
                                                <div className="flex items-center gap-2">
                                                    <span className="w-20 shrink-0 text-xs text-muted-foreground">Preço</span>
                                                    <Input inputMode="decimal" aria-label={`Preço de ${m.name}`} value={editPrice} placeholder={m.price ? String(m.price) : "0"}
                                                        onChange={(e) => setEditPrice(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(m); } }} className="h-9 w-32 min-w-0" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-20 shrink-0 text-xs text-muted-foreground">Custo</span>
                                                    <Input inputMode="decimal" aria-label={`Custo de ${m.name}`} value={editCost} placeholder={m.cost ? String(m.cost) : "0"}
                                                        onChange={(e) => setEditCost(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(m); } }} className="h-9 w-32 min-w-0" />
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                                                    <Button type="button" size="sm" onClick={() => saveEdit(m)} disabled={saving}><Check className="mr-1 h-4 w-4" /> Guardar</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className={cn("truncate text-sm", nameKey(m.name) === nameKey(name) && "font-semibold")}>{order.map((k) => m.values[k]).filter(Boolean).join(" / ") || m.name}</p>
                                                    <p className="text-xs text-muted-foreground">{m.stock} {m.unit}{location ? " aqui" : ""}{m.price ? ` · ${formatCurrency(m.price)}` : familyMode ? " · sem preço" : ""}{familyMode && m.cost ? ` · custo ${formatCurrency(m.cost)}${m.ownCost ? " (próprio)" : ""}` : ""}</p>
                                                </div>
                                                <button type="button" aria-label={`Mudar ${m.name}`} onClick={() => { setEditing(m.name); setEditValues({}); setEditPrice(m.price ? String(m.price) : ""); setEditCost(m.cost ? String(m.cost) : ""); }}
                                                    className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <div className="space-y-2" data-tour="qs-add-variant">
                                <p className="text-sm font-medium">Novas variações</p>
                                <VariantsEditor
                                    state={vstate}
                                    onChange={setVstate}
                                    baseName={group}
                                    basePrice={model().price}
                                    existingNames={allNames}
                                    quantities={withQty ? vqty : undefined}
                                    onQuantities={withQty ? setVqty : undefined}
                                    unit={product?.unit || "un"}
                                    usedValues={order.length === 1 ? familyHints : undefined}
                                    hideSwitch
                                />
                                <Button type="button" className="w-full" onClick={addMany} disabled={saving || !vplan.create.length || vplan.tooMany}>
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                                    {vplan.create.length ? `Acrescentar ${vplan.create.length} variaç${vplan.create.length === 1 ? "ão" : "ões"}` : "Acrescentar variações"}
                                </Button>
                            </div>
                        </>
                    ) : sameFamily.length > 0 ? (
                        <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm" data-tour="qs-join-family">
                            <p>Já existe a família <b>«{sameFamily[0].variantGroup}»</b> com {sameFamily.length} variações. <b>{myStock} {product?.unit || "un"}</b> deste produto são de qual?</p>
                            <div className="grid grid-cols-2 gap-2">
                                {sameFamily.map((m) => {
                                    const pending = pendingNew.some((n) => nameKey(n) === nameKey(m.name));
                                    const busy = hasStockHere(m.name) || pending;
                                    return (
                                        <button key={m.name} type="button" disabled={saving || busy} onClick={() => join(m.name)}
                                            className="flex min-h-12 flex-col items-start justify-center rounded-xl border bg-background px-3 py-2 text-left hover:border-primary disabled:opacity-40">
                                            <span className="font-semibold">{Object.values(m.variantValues || {}).join(" / ") || m.name}</span>
                                            {busy && <span className="text-xs text-muted-foreground">{pending ? "no lote — registe primeiro" : "já tem stock aqui"}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                            {famOrder.length === 1 && (
                                <div className="flex gap-2">
                                    <Input value={joinNew} onChange={(e) => setJoinNew(e.target.value)} placeholder={`Outra ${famOrder[0].toLowerCase()}…`} aria-label={`Outra ${famOrder[0]}`}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); joinAsNew(); } }} className="h-10" autoComplete="off" />
                                    <Button type="button" variant="outline" className="h-10 shrink-0" disabled={!clean(joinNew) || saving} onClick={joinAsNew}>Juntar</Button>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">O stock, as encomendas em aberto e o histórico seguem para a variação escolhida.</p>
                        </div>
                    ) : !converting ? (
                        <div className="rounded-xl border border-dashed p-3 text-sm">
                            <p className="text-muted-foreground">Este produto ainda não tem variações. Tem cores, texturas ou tamanhos diferentes?</p>
                            <Button type="button" variant="secondary" className="mt-2 w-full" onClick={() => setConverting(true)}>
                                <Layers className="mr-1.5 h-4 w-4" /> Criar variações
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <VariantsEditor
                                state={vstate}
                                onChange={setVstate}
                                baseName={name}
                                basePrice={model().price}
                                existingNames={allNames}
                                quantities={withQty ? vqty : undefined}
                                onQuantities={withQty ? setVqty : undefined}
                                unit={product?.unit || "un"}
                                hideSwitch
                            />
                            {vplan.create.length > 0 && (
                                <div className="space-y-1.5 rounded-xl border border-primary/40 bg-primary/5 p-3" data-tour="qs-stock-to">
                                    <p className="text-sm">O stock que já existe de «{name}»{myStockAll ? <> (<b>{myStockAll} {product?.unit || "un"}</b>)</> : null} fica em:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {vplan.create.map((v) => (
                                            <button key={v.name} type="button" onClick={() => setStockTo(v.name)}
                                                className={cn("rounded-full border px-3 py-1 text-sm", chosen?.name === v.name ? "border-primary bg-primary text-primary-foreground" : "bg-background")}>
                                                {Object.values(v.values).join(" / ")}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">O histórico (vendas, movimentos) também segue para essa variação.</p>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Button type="button" variant="ghost" onClick={() => setConverting(false)}>Cancelar</Button>
                                <Button type="button" className="flex-1" onClick={convert} disabled={!chosen || vplan.tooMany || saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {vplan.create.length ? `Criar ${vplan.create.length} variaç${vplan.create.length === 1 ? "ão" : "ões"}` : "Criar variações"}
                                </Button>
                            </div>
                        </div>
                    )}
                </section>
            </DialogContent>
        </Dialog>
    );
}
