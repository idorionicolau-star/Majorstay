"use client";

import { useContext, useState } from "react";
import Link from "next/link";
import { Layers, Lock, Plus, X } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { companyHas, tierFor } from "@/lib/tiers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn, formatCurrency } from "@/lib/utils";
import { cleanOptions, countCombinations, MAX_VARIANTS, planVariants, SUGGESTED_OPTIONS, SUGGESTED_VALUES, type VariantOption } from "@/lib/variants";

export type VariantsState = { enabled: boolean; options: VariantOption[]; /** preço por variação (nome → texto); vazio = o preço do produto */ prices: Record<string, string> };
export const EMPTY_VARIANTS: VariantsState = { enabled: false, options: [{ name: "Cor", values: [] }], prices: {} };

const MAX_OPTIONS = 3;

/** Campo para escrever valores um a um (Enter ou vírgula) e vê-los como etiquetas. */
function ValuesInput({ values, suggestions, onChange }: { values: string[]; suggestions: string[]; onChange: (v: string[]) => void }) {
    const [text, setText] = useState("");
    const add = (raw: string) => {
        const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
        if (!parts.length) return;
        const have = new Set(values.map((v) => v.toLowerCase()));
        const next = [...values];
        for (const p of parts) if (!have.has(p.toLowerCase())) { next.push(p); have.add(p.toLowerCase()); }
        onChange(next);
        setText("");
    };
    const open = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {values.map((v) => (
                    <span key={v} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-2.5 pr-1 text-sm">
                        {v}
                        <button type="button" aria-label={`Tirar ${v}`} className="rounded-full p-0.5 hover:bg-muted" onClick={() => onChange(values.filter((x) => x !== v))}><X className="h-3 w-3" /></button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <Input
                    value={text}
                    onChange={(e) => { const t = e.target.value; if (t.includes(",")) add(t); else setText(t); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(text); } }}
                    onBlur={() => add(text)}
                    placeholder="Escreva e carregue em Enter (ex.: Vermelho)"
                    aria-label="Novo valor"
                />
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => add(text)} aria-label="Adicionar valor"><Plus className="h-4 w-4" /></Button>
            </div>
            {open.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {open.slice(0, 9).map((s) => (
                        <button key={s} type="button" onClick={() => onChange([...values, s])} className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground">+ {s}</button>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * "Este produto tem variações?" — o utilizador escolhe os tipos (Cor, Textura…), os valores de cada um e vê já
 * as variações que vão ser criadas (cada uma com o seu stock), podendo pôr preços diferentes.
 */
export function VariantsEditor({ state, onChange, baseName, basePrice, existingNames, quantities, onQuantities, unit, valueHints, hideSwitch, usedValues }: {
    state: VariantsState;
    onChange: (s: VariantsState) => void;
    baseName: string;
    basePrice: number;
    existingNames: string[];
    /** Stock Rápido: cada variação leva também a quantidade que entra (nome da variação → texto). */
    quantities?: Record<string, string>;
    onQuantities?: (q: Record<string, string>) => void;
    unit?: string;
    /** Valores já usados pela família (aparecem como sugestões antes das habituais). */
    valueHints?: Record<string, string[]>;
    /** Sem o interruptor: a pessoa já escolheu criar variações (ex.: "Nova variação de…"). */
    hideSwitch?: boolean;
    /** Valores que a família já tem (por tipo): não aparecem nas sugestões — acrescentam-se variações novas. */
    usedValues?: Record<string, string[]>;
}) {
    const set = (patch: Partial<VariantsState>) => onChange({ ...state, ...patch });
    const setOption = (i: number, patch: Partial<VariantOption>) => set({ options: state.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
    const cleaned = cleanOptions(state.options);
    const total = countCombinations(cleaned);
    const plan = planVariants(baseName || "Produto", cleaned, existingNames);
    // variações novas: plano Pro (a quem já tem famílias, "Nova variação de…" continua a funcionar)
    const companyData = useContext(InventoryContext)?.companyData;
    if (!hideSwitch && !state.enabled && !companyHas(companyData, "variants")) {
        return (
            <p className="flex flex-wrap items-center gap-1.5 rounded-xl border p-3 text-xs text-muted-foreground" data-testid="variants-locked">
                <Lock className="h-3.5 w-3.5" /> Variações (cores, tamanhos…) estão no plano <b>{tierFor("variants").label}</b>.
                <Link href="/billing" className="font-semibold text-primary underline">Mudar de plano</Link>
            </p>
        );
    }

    return (
        <section className="rounded-xl border p-3" aria-label="Variações">
            {!hideSwitch && <div className="flex items-start justify-between gap-3">
                <Label htmlFor="has-variants" className="flex cursor-pointer items-start gap-2">
                    <Layers className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                        <span className="block font-medium">Este produto tem variações?</span>
                        <span className="block text-xs font-normal text-muted-foreground">Por exemplo cores ou texturas. Cada variação tem o seu stock e preço.</span>
                    </span>
                </Label>
                <Switch id="has-variants" checked={state.enabled} onCheckedChange={(enabled) => set({ enabled })} />
            </div>}

            {state.enabled && (
                <div className="mt-3 space-y-4">
                    {state.options.map((o, i) => (
                        <div key={i} className="space-y-2 rounded-lg bg-muted/30 p-3">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={o.name}
                                    list="variant-option-names"
                                    onChange={(e) => setOption(i, { name: e.target.value })}
                                    placeholder="Tipo (ex.: Cor)"
                                    aria-label="Tipo de variação"
                                    className="h-9 max-w-[180px] font-medium"
                                />
                                {state.options.length > 1 && (
                                    <Button type="button" variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => set({ options: state.options.filter((_, j) => j !== i) })}>Tirar este tipo</Button>
                                )}
                            </div>
                            <ValuesInput values={o.values} suggestions={Array.from(new Set([...(valueHints?.[o.name.trim()] || []), ...(SUGGESTED_VALUES[o.name.trim()] || [])])).filter((v) => !(usedValues?.[o.name.trim()] || []).some((u) => u.toLowerCase() === v.toLowerCase()))} onChange={(values) => setOption(i, { values })} />
                        </div>
                    ))}
                    <datalist id="variant-option-names">{SUGGESTED_OPTIONS.map((n) => <option key={n} value={n} />)}</datalist>
                    {state.options.length < MAX_OPTIONS && (
                        <Button type="button" variant="outline" size="sm" onClick={() => set({ options: [...state.options, { name: state.options.some((o) => o.name === "Textura") ? "Tamanho" : "Textura", values: [] }] })}>
                            <Plus className="mr-1.5 h-4 w-4" /> Outro tipo de variação
                        </Button>
                    )}

                    <div aria-live="polite" className="text-sm">
                        {total === 0 ? <p className="text-muted-foreground">Acrescente pelo menos um valor para ver as variações.</p>
                            : plan.tooMany ? <p className="font-medium text-destructive">São {total} variações — o máximo de uma vez é {MAX_VARIANTS}. Tire alguns valores.</p>
                                : <p><b>{plan.create.length}</b> variaç{plan.create.length === 1 ? "ão vai" : "ões vão"} ser criada{plan.create.length === 1 ? "" : "s"}{plan.existing.length > 0 && <span className="text-muted-foreground"> · {plan.existing.length} já existe{plan.existing.length === 1 ? "" : "m"} e fica{plan.existing.length === 1 ? "" : "m"} como está</span>}.</p>}
                    </div>

                    {plan.create.length > 0 && (
                        <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border text-sm" aria-label="Variações a criar">
                            {plan.create.map((v) => (
                                <li key={v.name} className="flex items-center gap-2 px-3 py-1.5">
                                    {/* o que distingue a variação ("Branco"), por inteiro — o nome todo cortado ("Tinta - …") não dizia qual era */}
                                    <span className="min-w-0 flex-1 break-words font-medium leading-tight" title={v.name}>{Object.values(v.values).join(" / ") || v.name}</span>
                                    {quantities && onQuantities && (
                                        <Input
                                            type="number" step="any" min="0" inputMode="decimal"
                                            value={quantities[v.name] ?? ""}
                                            onChange={(e) => onQuantities({ ...quantities, [v.name]: e.target.value })}
                                            placeholder={unit || "Qtd"}
                                            aria-label={`Quantidade de ${v.name}`}
                                            className="h-8 w-16 shrink-0 text-center sm:w-24 font-semibold tabular-nums"
                                        />
                                    )}
                                    <Input
                                        type="number" step="0.01" min="0" inputMode="decimal"
                                        value={state.prices[v.name] ?? ""}
                                        onChange={(e) => set({ prices: { ...state.prices, [v.name]: e.target.value } })}
                                        placeholder={basePrice ? formatCurrency(basePrice) : "Preço"}
                                        aria-label={`Preço de ${v.name}`}
                                        className={cn("h-8 w-24 shrink-0 text-right tabular-nums sm:w-28")}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-xs text-muted-foreground">{quantities ? "Só as variações com quantidade entram no lote. " : ""}Deixe o preço vazio para usar o preço do produto. O código de barras de cada variação define-se depois, ao editá-la.</p>
                </div>
            )}
        </section>
    );
}
