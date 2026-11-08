"use client";

import { haul } from "@/lib/haul";
import { locationLabel } from '@/lib/sites';
import { habitualLocation, recordLocation } from "@/lib/habitual-location";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Check, ChevronDown, Factory, FlaskConical, Loader2, MapPin, Minus, Plus, Search, StickyNote, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInventory } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { safeReturn } from "@/lib/deep-links";
import { findRecipe } from "@/lib/production-materials";
import { fromDrafts, MaterialsEditor, toDrafts, type MaterialDraft } from "@/components/production/materials-editor";
import { Textarea } from "@/components/ui/textarea";
import { catalogChoices, dateLabel, mostProduced, recipeMaterials, todayMz, validProductionDate, wasteHint, yesterdayMz } from "@/lib/production-core";
import { clampQty } from "@/lib/transfer-core";
import { isFamilyGroup, variantLabel } from "@/lib/variants";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/friendly-error";

/** materials: undefined = segue a receita (acompanha a quantidade); depois de mexer, fica o que se escreveu. */
type Item = { name: string; unit: string; qty: string; notes?: string; materials?: MaterialDraft[]; open?: boolean };

/**
 * Registar produção, ao estilo da Venda Rápida: escolhe-se o dia (hoje, ontem ou outro), pesquisa-se no catálogo
 * (as variações aparecem juntas por família) e juntam-se vários produtos; um botão regista tudo. Cada produção
 * põe o produto no stock e desconta a matéria-prima da receita.
 * Vindo do "O que produzir": ?produto=&quantidade=&local=&voltar= já preenchem a lista.
 */
export default function NewProductionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { catalogProducts, productions, recipes, rawMaterials, locations, isMultiLocation, addProduction, canEdit, isReadOnly } = useInventory();
    const { toast } = useToast();
    const backHref = safeReturn(searchParams.get("voltar"), "/production", "/production");

    const [day, setDay] = useState(() => todayMz());
    const [location, setLocation] = useState("");
    const [text, setText] = useState("");
    const [items, setItems] = useState<Item[]>([]);
    const [busy, setBusy] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // um nome aparece uma vez (o catálogo pode ter o mesmo produto repetido)
    const catalog = useMemo(() => {
        const seen = new Set<string>();
        return (catalogProducts || []).filter((p) => p.name && !seen.has(p.name) && (seen.add(p.name), true));
    }, [catalogProducts]);
    const unitOf = (name: string) => catalog.find((p) => p.name === name)?.unit || "un";

    // localização: a do link, a última usada, ou a primeira
    useEffect(() => {
        if (!isMultiLocation || !locations?.length || location) return;
        const saved = habitualLocation(locations.map((l) => l.id));
        const wanted = searchParams.get("local");
        const pick = [wanted, saved].find((id) => id && locations.some((l) => l.id === id));
        setLocation(pick || locations[0].id);
    }, [isMultiLocation, locations, location, searchParams]);

    // vindo do plano: o produto e a quantidade já na lista
    const prefilled = useRef(false);
    useEffect(() => {
        const name = searchParams.get("produto");
        if (prefilled.current || !name || !catalog.length) return;
        prefilled.current = true;
        const q = Number(searchParams.get("quantidade")) || 1;
        setItems([{ name, unit: unitOf(name), qty: String(q) }]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalog, searchParams]);

    const choices = useMemo(() => catalogChoices(catalog, text), [catalog, text]);
    const top = useMemo(() => mostProduced(productions || [], new Set(catalog.map((c) => c.name))), [productions, catalog]);
    const inList = new Set(items.map((i) => i.name));
    const valid = items.map((i) => ({ ...i, n: clampQty(i.qty, Number.MAX_SAFE_INTEGER) })).filter((i) => i.n > 0);
    const dateOk = validProductionDate(day);
    const locName = (id: string) => locations?.find((l) => l.id === id)?.name || id;

    const add = (name: string) => {
        setItems((list) => (list.some((i) => i.name === name) ? list : [...list, { name, unit: unitOf(name), qty: "1" }]));
        setText("");
        requestAnimationFrame(() => { const el = document.getElementById(`pq-${name}`) as HTMLInputElement | null; el?.focus(); el?.select(); });
    };
    const setQty = (name: string, qty: string) => setItems((list) => list.map((i) => (i.name === name ? { ...i, qty } : i)));
    const step = (name: string, d: number) => setItems((list) => list.map((i) => (i.name === name ? { ...i, qty: String(Math.max(0, (clampQty(i.qty, Number.MAX_SAFE_INTEGER) || 0) + d)) } : i)));
    const remove = (name: string) => setItems((list) => list.filter((i) => i.name !== name));
    const patch = (name: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.name === name ? { ...i, ...p } : i)));
    /** a matéria-prima da receita para esta quantidade */
    const recipeFor = (it: Item) => recipeMaterials(findRecipe(recipes || undefined, it.name), clampQty(it.qty, Number.MAX_SAFE_INTEGER), rawMaterials || []);

    const submit = async () => {
        if (!valid.length || busy || !dateOk) return;
        setBusy(true);
        if (location) recordLocation(location);
        const failed: { name: string; error: string }[] = [];
        let done = 0;
        // a betoneira a puxar a barra enquanto regista (fica vermelha se nada foi registado)
        await haul("production", "A registar a produção…", "Produção registada", async () => {
            for (const it of valid) {
                try {
                    await addProduction({
                        productName: it.name, quantity: it.n, unit: it.unit, ...(isMultiLocation && location ? { location } : {}), date: day,
                        ...(it.materials ? { materialsUsed: fromDrafts(it.materials) } : {}),
                        ...(it.notes && it.notes.trim() ? { notes: it.notes } : {}),
                    }, { silent: true });
                    done++;
                } catch (e) {
                    failed.push({ name: it.name, error: friendlyError(e, "editar Produção, Inventário e Matéria-Prima") });
                }
            }
            if (!done) throw new Error("nada registado");
        }).catch(() => { /* o aviso abaixo explica o que falhou */ });
        setBusy(false);
        const when = dateLabel(day);
        toast({
            variant: failed.length && !done ? "destructive" : undefined,
            title: done ? `${done} ${done === 1 ? "produção registada" : "produções registadas"} (${when})` : "Nada foi registado",
            description: [done ? "Já entraram no stock." : "", failed.length ? `Falharam: ${failed.map((f) => `${f.name}: ${f.error}`).join(" · ")}` : ""].filter(Boolean).join(" "),
        });
        if (!failed.length) { router.push(backHref); return; }
        setItems((list) => list.filter((i) => failed.some((f) => f.name === i.name)));
    };

    if (!canEdit("production")) return <div className="p-8 text-center text-muted-foreground">Sem permissão para registar produção.</div>;

    const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
        <button type="button" onClick={onClick} aria-pressed={active}
            className={cn("rounded-full border px-3 py-1.5 text-sm font-medium transition", active ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/60")}>
            {children}
        </button>
    );
    const isOtherDay = day !== todayMz() && day !== yesterdayMz();

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-28">
            <div className="flex items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Registar produção</h1>
                    <p className="text-sm text-muted-foreground">Escolha o dia, procure os produtos e junte-os à lista. Entram no stock ao registar.</p>
                </div>
            </div>

            <div className="space-y-3 rounded-2xl border bg-card p-3">
                <div data-tour="prod-date">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Dia da produção</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Chip active={day === todayMz()} onClick={() => setDay(todayMz())}>Hoje</Chip>
                        <Chip active={day === yesterdayMz()} onClick={() => setDay(yesterdayMz())}>Ontem</Chip>
                        <label className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-sm", isOtherDay && "border-primary")}>
                            Outro dia
                            <input type="date" aria-label="Outro dia" value={day} max={todayMz()} onChange={(e) => e.target.value && setDay(e.target.value)} className="bg-transparent text-sm outline-none" />
                        </label>
                    </div>
                    {!dateOk && <p className="mt-1 text-xs text-red-600">Escolha um dia até hoje (no máximo um ano atrás).</p>}
                </div>
                {isMultiLocation && (locations?.length || 0) > 1 && (
                    <div data-tour="prod-location">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Onde foi produzido</p>
                        <div className="flex flex-wrap gap-1.5">
                            {locations.map((l) => <Chip key={l.id} active={location === l.id} onClick={() => setLocation(l.id)}>{locationLabel(l)}</Chip>)}
                        </div>
                    </div>
                )}
            </div>

            <div className="relative" data-tour="prod-search">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input ref={searchRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Procurar no catálogo…" aria-label="Procurar no catálogo"
                    className="h-12 rounded-2xl pl-12 pr-10 text-base" autoComplete="off"
                    onKeyDown={(e) => {
                        if (e.key !== "Enter" || !choices[0]) return;
                        e.preventDefault();
                        const c = choices[0];
                        if (!isFamilyGroup(c)) add(c.name); else if (c.members.length === 1) add(c.members[0].name);
                    }} />
                {text && <button type="button" aria-label="Limpar" onClick={() => setText("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"><X className="h-5 w-5" /></button>}
            </div>

            {items.length > 0 && (
                <section data-tour="prod-basket" className="rounded-2xl border border-primary/40 bg-primary/5 p-3">
                    <p className="mb-2 text-sm font-semibold">A registar ({items.length}) · {dateLabel(day)}{isMultiLocation && location ? ` · ${locName(location)}` : ""}</p>
                    <ul className="space-y-2">
                        {items.map((it) => {
                            const recipeLines = recipeFor(it);
                            // só com a receita (sem matéria-prima mexida à mão): abrir material para poucas unidades
                            const waste = it.materials ? null : wasteHint(findRecipe(recipes || undefined, it.name), clampQty(it.qty, Number.MAX_SAFE_INTEGER), rawMaterials || []);
                            const mats = it.materials ?? toDrafts(recipeLines);
                            const summary = mats.filter((m) => Number(String(m.qty).replace(",", ".")) > 0).map((m) => `${m.qty} ${m.unit || ""} ${m.name}`.replace(/\s+/g, " ").trim()).join(", ");
                            return (
                                <li key={it.name} className="rounded-xl bg-background px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="min-w-[10rem] flex-1">
                                            <p className="font-medium leading-snug">{it.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {it.unit}{summary ? <> · <FlaskConical className="inline h-3 w-3" /> gasta {summary}</> : ""}{it.notes ? <> · <StickyNote className="inline h-3 w-3" /> nota</> : ""}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button type="button" size="icon" variant="outline" className="h-9 w-9" onClick={() => step(it.name, -1)} aria-label={`Menos ${it.name}`}><Minus className="h-4 w-4" /></Button>
                                            <Input id={`pq-${it.name}`} inputMode="decimal" value={it.qty} onChange={(e) => setQty(it.name, e.target.value)} onFocus={(e) => e.target.select()}
                                                aria-label={`Quantidade de ${it.name}`} className="h-9 w-24 text-center" />
                                            <Button type="button" size="icon" variant="outline" className="h-9 w-9" onClick={() => step(it.name, 1)} aria-label={`Mais ${it.name}`}><Plus className="h-4 w-4" /></Button>
                                            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground" onClick={() => remove(it.name)} aria-label={`Tirar ${it.name}`}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                    {waste && (
                                        <div data-tour="prod-waste" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
                                            <span>💡 Com {waste.used} {waste.unit || ""} de {waste.material} dá para <b>{waste.capacity}</b>: sobra para mais {waste.capacity - clampQty(it.qty, Number.MAX_SAFE_INTEGER)}.</span>
                                            <Button type="button" size="sm" variant="outline" className="h-7 border-amber-300 px-2 text-xs dark:border-amber-700" onClick={() => setQty(it.name, String(waste.capacity))}>
                                                Produzir {waste.capacity}
                                            </Button>
                                        </div>
                                    )}
                                    <button type="button" onClick={() => patch(it.name, { open: !it.open })} aria-expanded={!!it.open}
                                        className="mt-1 flex items-center gap-1 text-xs font-medium text-primary" data-tour="prod-item-details">
                                        <ChevronDown className={cn("h-3.5 w-3.5 transition", it.open && "rotate-180")} /> Matéria-prima e notas
                                    </button>
                                    {it.open && (
                                        <div className="mt-2 space-y-3 border-t pt-3">
                                            <MaterialsEditor value={mats} onChange={(v) => patch(it.name, { materials: v })} rawMaterials={rawMaterials || []}
                                                recipe={recipeLines} onUseRecipe={() => patch(it.name, { materials: undefined })} />
                                            <Textarea rows={2} value={it.notes || ""} onChange={(e) => patch(it.name, { notes: e.target.value })} maxLength={1000}
                                                aria-label={`Notas de ${it.name}`} placeholder="Notas (ex.: foram usados 3 sacos; faltou água a meio)" />
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            {!text && top.length > 0 && (
                <section data-tour="prod-top">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mais produzidos</p>
                    <div className="flex flex-wrap gap-1.5">
                        {top.map((n) => (
                            <button key={n} type="button" onClick={() => add(n)} className={cn("rounded-full border px-3 py-1.5 text-sm", inList.has(n) ? "border-primary bg-primary/10" : "hover:border-primary/60")}>
                                {inList.has(n) ? <Check className="mr-1 inline h-3.5 w-3.5" /> : <Plus className="mr-1 inline h-3.5 w-3.5" />}{n}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            <section data-tour="prod-list">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{text ? `Resultados (${choices.length})` : `Catálogo (${catalog.length})`}</p>
                {catalog.length === 0 ? (
                    <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
                        O catálogo está vazio. <Link href="/catalog" className="text-primary underline">Adicione os produtos no Catálogo</Link> primeiro.
                    </div>
                ) : choices.length === 0 ? (
                    <p className="rounded-2xl border p-4 text-sm text-muted-foreground">Nenhum produto do catálogo com esse nome.</p>
                ) : (
                    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                        {choices.map((c) => isFamilyGroup(c) ? (
                            <li key={`f-${c.key}`} className="px-4 py-3" data-tour="prod-family">
                                <p className="font-medium">{c.group} <span className="text-xs font-normal text-muted-foreground">· {c.members.length} variações — escolha</span></p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {c.members.map((m) => (
                                        <button key={m.name} type="button" onClick={() => add(m.name)} aria-label={`Juntar ${m.name}`}
                                            className={cn("rounded-full border px-3 py-1 text-sm", inList.has(m.name) ? "border-primary bg-primary/10 font-medium" : "hover:border-primary/60")}>
                                            {inList.has(m.name) && <Check className="mr-1 inline h-3.5 w-3.5" />}{variantLabel(m)}
                                        </button>
                                    ))}
                                </div>
                            </li>
                        ) : (
                            <li key={c.name}>
                                <button type="button" onClick={() => add(c.name)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50", inList.has(c.name) && "bg-primary/5")}>
                                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                                    <span className="text-xs text-muted-foreground">{c.unit || "un"}</span>
                                    {inList.has(c.name) ? <Check className="h-5 w-5 shrink-0 text-primary" /> : <Plus className="h-5 w-5 shrink-0 text-muted-foreground" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className="fixed inset-x-0 bottom-16 z-30 px-4 md:bottom-4 md:left-auto md:right-6 md:w-[28rem] md:px-0">
                <Button type="button" onClick={submit} disabled={!valid.length || busy || isReadOnly || !dateOk}
                    className="h-14 w-full rounded-2xl bg-emerald-600 text-base text-white shadow-xl hover:bg-emerald-700" data-tour="prod-submit">
                    {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Factory className="mr-2 h-5 w-5" />}
                    {busy ? "A registar…" : valid.length ? `Registar ${valid.length} ${valid.length === 1 ? "produção" : "produções"} (${dateLabel(day)})` : "Escolha os produtos"}
                </Button>
            </div>
        </div>
    );
}
