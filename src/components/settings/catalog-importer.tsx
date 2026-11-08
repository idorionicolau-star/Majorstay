"use client";

import { requireEmailConfirmed } from "@/components/billing/email-confirm";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Check, ClipboardCopy, FileSpreadsheet, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildImportPrompt, parseText, planImport, rowsFromTable, type ImportRow, type PlannedRow } from "@/lib/catalog-import";

export type CatalogImportResult = {
    create: { name: string; category: string; price: number; cost?: number; unit: string; lowStockThreshold: number; criticalStockThreshold: number; barcode?: string; imageUrl?: string }[];
    updatePrices: { id: string; price: number }[];
    newCategories: string[];
};

interface Props {
    existing: { id?: string; name: string; price?: number }[];
    categories: string[];
    onImport: (result: CatalogImportResult) => Promise<void> | void;
}

const STATUS: Record<PlannedRow["status"], { label: string; cls: string }> = {
    new: { label: "Novo", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    exists: { label: "Já existe", cls: "bg-muted text-muted-foreground" },
    similar: { label: "Parecido", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    duplicate: { label: "Repetido", cls: "bg-muted text-muted-foreground" },
};

/** Ficheiros do Windows/Excel costumam vir em Windows-1252: tenta UTF-8 e, se falhar, usa esse. */
async function readText(file: File) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch { return new TextDecoder("windows-1252").decode(buf); }
}

export function CatalogImporter({ existing, categories, onImport }: Props) {
    const { toast } = useToast();
    const [text, setText] = useState("");
    const [fileName, setFileName] = useState("");
    const [reading, setReading] = useState(false);
    const [plan, setPlan] = useState<PlannedRow[] | null>(null);
    const [defaultCategory, setDefaultCategory] = useState("Geral");
    const [updatePrices, setUpdatePrices] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    const analyse = (rows: ImportRow[]) => {
        if (!rows.length) {
            toast({ variant: "destructive", title: "Não encontrei produtos", description: "Confirme se a lista tem os nomes dos produtos (e, se quiser, o preço) e tente de novo." });
            return;
        }
        setPlan(planImport(rows, existing));
    };

    const onFile = async (file: File) => {
        setReading(true);
        setFileName(file.name);
        try {
            const lower = file.name.toLowerCase();
            if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
                const { readSheet } = await import("read-excel-file/web-worker");
                analyse(rowsFromTable(await readSheet(file)));
            } else if (lower.endsWith(".xls")) {
                toast({ variant: "destructive", title: "Formato .xls antigo", description: "Abra no Excel e guarde como .xlsx ou CSV, ou cole as células na caixa de texto." });
            } else if (/\.(pdf|png|jpe?g|webp|heic)$/.test(lower)) {
                toast({ title: "PDF e fotografias precisam da IA", description: "Use \"Tenho um PDF ou fotografia\" mais abaixo: copie a instrução, dê-a à sua IA com o ficheiro e cole a resposta aqui." });
            } else {
                const content = await readText(file);
                const parsed = /\.(csv|tsv)$/.test(lower) ? Papa.parse<string[]>(content, { skipEmptyLines: true }) : null;
                const fromTable = parsed && !parsed.errors.length ? rowsFromTable(parsed.data) : [];
                analyse(fromTable.length ? fromTable : parseText(content));
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: "Não foi possível ler o ficheiro", description: e?.message });
        } finally {
            setReading(false);
        }
    };

    const copyPrompt = async () => {
        try { await navigator.clipboard.writeText(buildImportPrompt()); setCopied(true); setTimeout(() => setCopied(false), 2500); }
        catch { toast({ variant: "destructive", title: "Não foi possível copiar", description: "Seleccione o texto e copie à mão." }); }
    };

    const setRow = (i: number, patch: Partial<PlannedRow> | { row: Partial<ImportRow> }) =>
        setPlan((p) => p && p.map((r, idx) => {
            if (idx !== i) return r;
            if ("row" in patch) return { ...r, row: { ...r.row, ...patch.row } };
            return { ...r, ...patch };
        }));

    const summary = useMemo(() => {
        const rows = plan || [];
        const catOf = (r: PlannedRow) => (r.row.category || defaultCategory || "Geral").trim();
        const toCreate = rows.filter((r) => r.include && r.status !== "exists" && r.status !== "duplicate");
        const priceUpdates = updatePrices
            ? rows.filter((r) => r.status === "exists" && r.include && r.match?.id && r.row.price !== undefined && r.row.price !== r.match.price)
            : [];
        const known = new Set(categories.map((c) => c.trim().toLowerCase()));
        const newCats = Array.from(new Set(toCreate.map(catOf).filter((c) => c && !known.has(c.toLowerCase()))));
        return { toCreate, priceUpdates, newCats, catOf, noPrice: toCreate.filter((r) => r.row.price === undefined).length };
    }, [plan, defaultCategory, categories, updatePrices]);

    const run = async () => {
        if (!plan) return;
        if (!(await requireEmailConfirmed())) return; // conta nova: confirma o email antes do primeiro produto
        setSaving(true);
        try {
            await onImport({
                create: summary.toCreate.map((r) => ({
                    name: r.row.name,
                    category: summary.catOf(r),
                    price: r.row.price ?? 0,
                    ...(r.row.cost ? { cost: r.row.cost } : {}),
                    unit: r.row.unit || "un",
                    lowStockThreshold: 10,
                    criticalStockThreshold: 5,
                    // só códigos de barras verdadeiros (EAN/UPC); referências internas como "BJ01" não entram
                    ...(r.row.code && /^\d{8,14}$/.test(r.row.code) ? { barcode: r.row.code } : {}),
                    ...(r.row.imageUrl ? { imageUrl: r.row.imageUrl } : {}),
                })),
                updatePrices: summary.priceUpdates.map((r) => ({ id: r.match!.id!, price: r.row.price! })),
                newCategories: summary.newCats,
            });
            setPlan(null);
            setText("");
            setFileName("");
        } finally {
            setSaving(false);
        }
    };

    // ------------------------------------------------------------- pré-visualização
    if (plan) {
        const counts = { new: 0, exists: 0, similar: 0, duplicate: 0 } as Record<PlannedRow["status"], number>;
        plan.forEach((r) => counts[r.status]++);
        const total = summary.toCreate.length + summary.priceUpdates.length;
        return (
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold">Confirme antes de importar</h3>
                    <p className="text-sm text-muted-foreground">
                        {plan.length} linhas lidas: <b>{counts.new}</b> novos, <b>{counts.similar}</b> parecidos com outros, <b>{counts.exists}</b> já existem, {counts.duplicate} repetidos.
                        Corrija o que precisar e desmarque o que não quer.
                    </p>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-end">
                    <div className="space-y-1.5">
                        <Label htmlFor="imp-defcat">Categoria para os que não a trazem</Label>
                        <Input id="imp-defcat" value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} list="imp-cats" className="sm:w-56" />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={updatePrices} onCheckedChange={(v) => setUpdatePrices(!!v)} />
                        Actualizar o preço dos que já existem
                    </label>
                </div>
                <datalist id="imp-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>

                <div className="max-h-[50vh] overflow-y-auto rounded-xl border">
                    <div className="sticky top-0 hidden grid-cols-[2rem_1fr_11rem_7rem_5.5rem] gap-2 border-b bg-muted/80 px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur md:grid">
                        <span /><span>Nome</span><span>Categoria</span><span>Preço</span><span>Estado</span>
                    </div>
                    {plan.map((r, i) => (
                        <div key={i} className={`grid grid-cols-[2rem_1fr] items-center gap-2 border-b px-3 py-2 last:border-0 md:grid-cols-[2rem_1fr_11rem_7rem_5.5rem] ${!r.include ? "opacity-50" : ""}`}>
                            <Checkbox checked={r.include} disabled={r.status === "duplicate"} onCheckedChange={(v) => setRow(i, { include: !!v })} />
                            <div className="min-w-0">
                                <Input value={r.row.name} onChange={(e) => setRow(i, { row: { name: e.target.value } })} className="h-8" />
                                {r.match && r.status !== "duplicate" && <p className="mt-0.5 truncate text-xs text-muted-foreground">No catálogo: {r.match.name}{r.match.price ? ` · ${r.match.price}` : ""}</p>}
                            </div>
                            <Input value={r.row.category || ""} placeholder={defaultCategory || "Geral"} onChange={(e) => setRow(i, { row: { category: e.target.value } })} list="imp-cats" className="col-start-2 h-8 md:col-start-auto" />
                            <Input inputMode="decimal" value={r.row.price ?? ""} placeholder="—" onChange={(e) => { const n = parseFloat(e.target.value.replace(",", ".")); setRow(i, { row: { price: Number.isFinite(n) ? n : undefined } }); }} className="col-start-2 h-8 md:col-start-auto" />
                            <span className={`col-start-2 w-fit rounded-full px-2 py-0.5 text-xs font-medium md:col-start-auto ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                        </div>
                    ))}
                </div>

                {summary.noPrice > 0 && <p className="text-sm text-muted-foreground">{summary.noPrice} produtos ficam sem preço (0); pode defini-lo depois.</p>}
                {summary.newCats.length > 0 && <p className="text-sm text-muted-foreground">Categorias novas a criar: {summary.newCats.join(", ")}.</p>}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="ghost" onClick={() => setPlan(null)} disabled={saving}>Voltar</Button>
                    <Button onClick={run} disabled={saving || total === 0}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Importar {summary.toCreate.length} produtos{summary.priceUpdates.length ? ` e actualizar ${summary.priceUpdates.length} preços` : ""}
                    </Button>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------- origem
    return (
        <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
                Traga a sua lista como ela estiver. O programa reconhece os <b>nomes</b> e, se existirem, o <b>preço</b>, a <b>categoria</b> e a unidade.
                Depois mostra tudo para confirmar antes de gravar.
            </p>

            <div className="space-y-2 rounded-xl border p-4">
                <h3 className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-4 w-4" /> 1. Ficheiro Excel ou CSV</h3>
                <Input type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" disabled={reading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
                {reading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> A ler {fileName}…</p>}
                <p className="text-xs text-muted-foreground">As colunas podem ter qualquer ordem e nomes como Produto, Artigo, Descrição, Preço, PVP, Categoria, Família…</p>
            </div>

            <div className="space-y-2 rounded-xl border p-4">
                <h3 className="flex items-center gap-2 font-semibold"><Wand2 className="h-4 w-4" /> 2. Colar uma lista</h3>
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={"Cole aqui células do Excel, uma lista do WhatsApp…\nCimento 32.5N - 650\nBloco 15 - 45\nAreia fina: 1.200"} />
                <Button onClick={() => analyse(parseText(text))} disabled={!text.trim()}>Analisar lista</Button>
            </div>

            <div className="space-y-2 rounded-xl border border-dashed p-4">
                <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" /> Tenho um PDF ou fotografia</h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>Copie a instrução abaixo.</li>
                    <li>Abra a sua IA (Gemini, ChatGPT, Claude…), anexe o PDF ou as fotografias e cole a instrução.</li>
                    <li>Copie a resposta e cole-a na caixa <b>2. Colar uma lista</b>.</li>
                </ol>
                <Button variant="outline" onClick={copyPrompt}>
                    {copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <ClipboardCopy className="mr-2 h-4 w-4" />}
                    {copied ? "Instrução copiada" : "Copiar instrução para a IA"}
                </Button>
            </div>
        </div>
    );
}
