"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Camera, Check, ClipboardPaste, Copy, ExternalLink, HelpCircle, X } from "lucide-react";
import type { Product } from "@/lib/types";
import { buildCountPrompt, matchCountRows, parsePastedCount, type CountMatch } from "@/lib/photo-count";
import { searchProducts, toNumber } from "@/lib/quick-stock";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("pt-PT", { maximumFractionDigits: 3 }));

const AIS = [
    { name: "Gemini", href: "https://gemini.google.com/app" },
    { name: "Claude", href: "https://claude.ai/new" },
];

type Row = CountMatch & { id: number; ignored: boolean; qtyText: string };

/**
 * Contar por fotografia: a pessoa usa a IA dela (Gemini, Claude) para transcrever as folhas,
 * cola a resposta aqui, confere, e as quantidades entram na contagem.
 */
export function PhotoCount({ products, locationName, blind, onApply }: {
    products: Product[];
    locationName?: string;
    /** contagem cega (funcionário): não mostra o stock do sistema */
    blind: boolean;
    onApply: (items: { product: Product; qty: number }[]) => void;
}) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [pasted, setPasted] = useState("");
    const [rows, setRows] = useState<Row[] | null>(null);
    const [searchFor, setSearchFor] = useState<number | null>(null);
    const [searchText, setSearchText] = useState("");

    const prompt = useMemo(() => buildCountPrompt(products, locationName), [products, locationName]);

    const reset = () => { setPasted(""); setRows(null); setSearchFor(null); setSearchText(""); };

    const copyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(prompt);
            toast({ title: "Instrução copiada", description: "Cole-a na IA junto com as fotografias." });
        } catch {
            toast({ variant: "destructive", title: "Não deu para copiar", description: "Seleccione o texto da instrução e copie à mão." });
        }
    };

    const pasteFromClipboard = async () => {
        try {
            const t = await navigator.clipboard.readText();
            if (t) setPasted(t);
        } catch {
            toast({ title: "Cole no campo", description: "Toque no campo e escolha Colar." });
        }
    };

    const check = () => {
        const parsed = parsePastedCount(pasted);
        if (!parsed.length) {
            toast({ variant: "destructive", title: "Não encontrei linhas", description: "A resposta deve ter uma linha por produto: Nome | quantidade." });
            return;
        }
        setRows(matchCountRows(parsed, products).map((m, i) => ({ ...m, id: i, ignored: false, qtyText: m.qty == null ? "" : fmt(m.qty) })));
    };

    const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const choose = (id: number, p: Product) => { update(id, { product: p, status: "ok", reason: undefined }); setSearchFor(null); setSearchText(""); };

    // Duvidosos só entram depois de a pessoa tocar no produto certo (uma quantidade ilegível basta escrevê-la).
    const ready = (rows || []).filter((r) => !r.ignored && r.product && r.qtyText.trim() !== "" && toNumber(r.qtyText) >= 0
        && (r.status === "ok" || r.reason === "Quantidade ilegível"));
    const pending = (rows || []).filter((r) => !r.ignored && !ready.includes(r));
    const counts = {
        ok: (rows || []).filter((r) => r.status === "ok" && !r.ignored).length,
        doubt: (rows || []).filter((r) => r.status === "doubt" && !r.ignored).length,
        missing: (rows || []).filter((r) => r.status === "missing" && !r.ignored).length,
    };

    const apply = () => {
        // o mesmo produto escolhido em duas linhas soma
        const totals = new Map<string, { product: Product; qty: number }>();
        ready.forEach((r) => {
            const p = r.product!;
            const key = p.instanceId || p.id || p.name;
            const prev = totals.get(key);
            const q = toNumber(r.qtyText);
            totals.set(key, { product: p, qty: (prev?.qty || 0) + q });
        });
        onApply(Array.from(totals.values()));
        toast({ title: "Juntado à contagem", description: `${totals.size} produto${totals.size === 1 ? "" : "s"}. Confira e carregue em Confirmar contagem.` });
        setOpen(false);
        reset();
    };

    return (
        <>
            <Button type="button" variant="outline" className="h-10 gap-2" onClick={() => setOpen(true)}>
                <Camera className="h-4 w-4" /> Contar por fotografia
            </Button>
            <ResponsiveDialog
                open={open}
                onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}
                title="Contar por fotografia"
                description={locationName ? `Local: ${locationName}` : undefined}
                className="md:max-w-2xl"
            >
                {!rows ? (
                    <div className="space-y-4 text-sm">
                        <ol className="space-y-3">
                            <li className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                                <div className="min-w-0 flex-1 space-y-2">
                                    <p>Copie a instrução (já leva a lista dos {products.length} produtos deste local).</p>
                                    <Button type="button" variant="secondary" size="sm" onClick={copyPrompt}><Copy className="mr-1.5 h-4 w-4" /> Copiar instrução</Button>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                                <div className="min-w-0 flex-1 space-y-2">
                                    <p>Abra uma IA, junte as fotografias das folhas, cole a instrução e envie. Depois copie a resposta.</p>
                                    <div className="flex flex-wrap gap-2">
                                        {AIS.map((a) => (
                                            <Button key={a.name} asChild variant="outline" size="sm">
                                                <a href={a.href} target="_blank" rel="noopener noreferrer">{a.name} <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p>Cole aqui a resposta da IA:</p>
                                        <Button type="button" variant="ghost" size="sm" onClick={pasteFromClipboard}><ClipboardPaste className="mr-1.5 h-4 w-4" /> Colar</Button>
                                    </div>
                                    <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={7} placeholder={"Bloco 15x40 | 215\nPavê Rectangular | 120\n…"} className="font-mono text-xs" />
                                </div>
                            </li>
                        </ol>
                        <Button type="button" className="w-full" onClick={check} disabled={!pasted.trim()}>Conferir</Button>
                    </div>
                ) : (
                    <div className="space-y-3 text-sm">
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-700 dark:text-emerald-400">✓ {counts.ok} certos</span>
                            {counts.doubt > 0 && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-700 dark:text-amber-400">? {counts.doubt} duvidosos</span>}
                            {counts.missing > 0 && <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-red-700 dark:text-red-400">✗ {counts.missing} não encontrados</span>}
                        </div>

                        <ul className="divide-y rounded-xl border">
                            {[...rows].sort((a, b) => rank(a) - rank(b)).map((r) => {
                                const q = toNumber(r.qtyText);
                                const diff = r.product && r.qtyText.trim() !== "" && Number.isFinite(q) ? q - (r.product.stock || 0) : null;
                                return (
                                    <li key={r.id} className={cn("space-y-2 px-3 py-2.5", r.ignored && "opacity-50")}>
                                        <div className="flex items-start gap-2">
                                            {r.status === "ok" ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                                : r.status === "doubt" ? <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                                    : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold">{r.product ? r.product.name : r.name}</p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    Lido: “{r.name}”{r.merged > 1 ? ` · ${r.merged} linhas somadas` : ""}{r.reason ? ` · ${r.reason}` : ""}
                                                </p>
                                                {r.product && !blind && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Sistema: {fmt(r.product.stock || 0)} {r.product.unit || "un"}
                                                        {diff !== null && diff !== 0 && <b className={cn("ml-2", diff > 0 ? "text-emerald-600" : "text-red-600")}>{diff > 0 ? "+" : ""}{fmt(diff)}</b>}
                                                        {diff === 0 && <b className="ml-2 text-emerald-600">✓ certo</b>}
                                                    </p>
                                                )}
                                            </div>
                                            <Input inputMode="decimal" value={r.qtyText} onChange={(e) => update(r.id, { qtyText: e.target.value })} placeholder="?" disabled={r.ignored}
                                                className={cn("h-10 w-20 shrink-0 text-right font-bold", r.qtyText.trim() === "" && !r.ignored && "border-amber-500")} />
                                            <button type="button" aria-label={r.ignored ? "Usar" : "Ignorar"} title={r.ignored ? "Usar" : "Ignorar"} onClick={() => update(r.id, { ignored: !r.ignored })} className="mt-2 shrink-0 text-muted-foreground">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>

                                        {!r.ignored && r.status !== "ok" && (
                                            <div className="ml-6 flex flex-wrap gap-1.5">
                                                {r.candidates.map((c) => (
                                                    <button key={c.instanceId || c.id} type="button" onClick={() => choose(r.id, c)}
                                                        className={cn("rounded-full border px-2.5 py-1 text-xs", r.product === c ? "border-primary bg-primary/10 font-semibold" : "bg-muted/40")}>
                                                        {c.name}
                                                    </button>
                                                ))}
                                                <button type="button" onClick={() => { setSearchFor(searchFor === r.id ? null : r.id); setSearchText(r.name); }} className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground">
                                                    Procurar outro…
                                                </button>
                                            </div>
                                        )}
                                        {searchFor === r.id && (
                                            <div className="ml-6 space-y-1">
                                                <Input autoFocus value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Nome do produto" className="h-9" />
                                                {searchProducts(products, searchText, 6).map((p) => (
                                                    <button key={p.instanceId || p.id} type="button" onClick={() => choose(r.id, p)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted">{p.name}</button>
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        {pending.length > 0 && (
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                {pending.length === 1 ? "Falta conferir 1 linha" : `Faltam conferir ${pending.length} linhas`}: toque no produto certo, escreva a quantidade ou toque em ✕ para ignorar.
                            </p>
                        )}
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setRows(null)}>Voltar</Button>
                            <Button type="button" className="flex-1" onClick={apply} disabled={!ready.length || pending.length > 0}>
                                Juntar {ready.length} à contagem
                            </Button>
                        </div>
                    </div>
                )}
            </ResponsiveDialog>
        </>
    );
}

function rank(r: Row) {
    if (r.ignored) return 4;
    return r.status === "missing" ? 0 : r.status === "doubt" ? 1 : 2;
}
