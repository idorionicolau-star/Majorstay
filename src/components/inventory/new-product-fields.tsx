"use client";

import React, { useState } from "react";
import { AlertTriangle, BookOpen, Check, Plus, Sparkles, Warehouse } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CategorySuggestion, NameMatch } from "@/lib/new-product";

type Props = {
    name: string;
    onName: (v: string) => void;
    matches: NameMatch[];
    /** escolher um produto que já existe em vez de criar outro */
    onUseMatch: (m: NameMatch) => void;
    /** só os "iguais" exigem confirmação para criar mesmo assim */
    ackDuplicate: boolean;
    onAckDuplicate: (v: boolean) => void;
    category: string;
    onCategory: (v: string) => void;
    suggestion: CategorySuggestion;
    categories: string[];
    unit: string;
    onUnit: (v: string) => void;
    units: string[];
    locName: (id: string) => string;
    onEnter: () => void;
    /** Código de barras do produto novo (opcional). Sem `onBarcode` o campo não aparece (ex.: produto com variações). */
    barcode?: string;
    onBarcode?: (v: string) => void;
    /** O código vem de uma leitura que ainda não tinha produto */
    barcodeFromScan?: boolean;
    /** Nome do produto que já tem este código */
    barcodeClash?: string;
};

/** Parte "produto novo" do Stock Rápido: nome, parecidos, categoria e unidade — tudo à vista, sem menus escondidos. */
export function NewProductFields(p: Props) {
    const [creatingCategory, setCreatingCategory] = useState(false);
    const exact = p.matches.find((m) => m.kind === "exact");
    const inList = p.categories.some((c) => c.toLowerCase() === p.category.toLowerCase());
    // sugerida primeiro, depois as já existentes (sem repetir)
    const chips = Array.from(new Set([p.suggestion.category, ...p.categories])).slice(0, 8);

    return (
        <div className="mt-3 space-y-3">
            <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome do produto</label>
                <Input
                    value={p.name}
                    onChange={(e) => p.onName(e.target.value)}
                    className="h-11 rounded-xl text-base font-medium"
                    autoComplete="off"
                    spellCheck={false}
                />
            </div>

            {p.matches.length > 0 && (
                <div className={cn("rounded-xl border p-3 text-sm", exact ? "border-red-500/50 bg-red-500/10" : "border-amber-500/50 bg-amber-500/10")}>
                    <p className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className={cn("h-4 w-4", exact ? "text-red-600" : "text-amber-600")} />
                        {exact ? "Este produto já existe" : "Já existe algo parecido"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Veja se não é o mesmo antes de criar outro.</p>
                    <div className="mt-2 space-y-1.5">
                        {p.matches.map((m) => (
                            <button
                                key={`${m.source}-${m.name}-${m.location || ""}`}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => p.onUseMatch(m)}
                                className="flex w-full items-center gap-2 rounded-lg bg-background/70 px-3 py-2 text-left"
                            >
                                {m.source === "inventory" ? <Warehouse className="h-4 w-4 shrink-0 text-muted-foreground" /> : <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">{m.name}</span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {m.category || "Geral"} · {m.source === "inventory" ? `no stock${m.location ? ` (${p.locName(m.location)})` : ""}` : "só no catálogo"}
                                    </span>
                                </span>
                                <span className="shrink-0 text-xs font-semibold text-primary">É este</span>
                            </button>
                        ))}
                    </div>
                    {exact && (
                        <label className="mt-2 flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={p.ackDuplicate} onChange={(e) => p.onAckDuplicate(e.target.checked)} className="h-4 w-4" />
                            É mesmo diferente — criar outro com este nome
                        </label>
                    )}
                </div>
            )}

            <div>
                <label className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>Categoria</span>
                    {p.suggestion.source !== "none" && (
                        <span className="flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" /> sugerida pelo nome</span>
                    )}
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {chips.map((c) => {
                        const active = c.toLowerCase() === p.category.toLowerCase();
                        const suggested = c === p.suggestion.category && p.suggestion.source !== "none";
                        return (
                            <button
                                key={c}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { setCreatingCategory(false); p.onCategory(c); }}
                                className={cn("flex h-9 items-center gap-1 rounded-full border px-3 text-sm", active ? "border-primary bg-primary text-primary-foreground" : "bg-muted/50")}
                            >
                                {active && <Check className="h-3.5 w-3.5" />}
                                {suggested && !active && <Sparkles className="h-3 w-3 text-primary" />}
                                {c}
                                {suggested && p.suggestion.isNew && <span className="text-[10px] opacity-80">(nova)</span>}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setCreatingCategory(true)}
                        className="flex h-9 items-center gap-1 rounded-full border border-dashed px-3 text-sm text-muted-foreground"
                    >
                        <Plus className="h-3.5 w-3.5" /> Nova
                    </button>
                </div>
                {(creatingCategory || (!inList && p.category && !chips.some((c) => c.toLowerCase() === p.category.toLowerCase()))) && (
                    <Input
                        value={p.category}
                        onChange={(e) => p.onCategory(e.target.value)}
                        placeholder="Nome da nova categoria"
                        autoFocus={creatingCategory}
                        className="mt-2 h-10 rounded-xl"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.onEnter(); } }}
                    />
                )}
                {!inList && p.category && p.category !== "Geral" && (
                    <p className="mt-1 text-xs text-muted-foreground">A categoria “{p.category}” vai ser criada no catálogo.</p>
                )}
            </div>

            <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Unidade</label>
                <div className="flex flex-wrap gap-1.5">
                    {p.units.slice(0, 10).map((u) => (
                        <button
                            key={u}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => p.onUnit(u)}
                            className={cn("h-9 min-w-12 rounded-full border px-3 text-sm", u === p.unit ? "border-primary bg-primary text-primary-foreground" : "bg-muted/50")}
                        >
                            {u}
                        </button>
                    ))}
                </div>
            </div>

            {p.onBarcode && (
                <div data-tour="qs-new-barcode">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Código de barras (opcional)</label>
                    <Input
                        value={p.barcode ?? ""}
                        onChange={(e) => p.onBarcode?.(e.target.value)}
                        inputMode="text"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Escreva ou use o leitor"
                        className="h-11 rounded-xl tabular-nums"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.onEnter(); } }}
                    />
                    {p.barcodeClash
                        ? <p className="mt-1 text-xs font-medium text-red-600">Este código já é de «{p.barcodeClash}».</p>
                        : p.barcodeFromScan && p.barcode && <p className="mt-1 text-xs text-muted-foreground">Lido agora: fica ligado a este produto.</p>}
                </div>
            )}
        </div>
    );
}
