"use client";

import { Layers, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type VariantOptionRow = { key: string; label: string; sub?: string; right?: string; disabled?: boolean };

/**
 * "Qual cor?": quando se escreve só o nome da família ("pavê 20") e há várias variações.
 * Toca-se numa (ou carrega-se 1–9); Esc fecha.
 */
export function VariantChooser({ group, kind, qty, options, onPick, onClose }: {
    group: string;
    /** o tipo de variação a perguntar ("cor", "textura"…) */
    kind?: string;
    qty?: string;
    options: VariantOptionRow[];
    onPick: (key: string) => void;
    onClose: () => void;
}) {
    return (
        <div data-tour="variant-chooser" role="dialog" aria-label={`Qual ${kind || "variação"} de ${group}?`} className="mt-2 overflow-hidden rounded-2xl border-2 border-primary/40 bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b bg-primary/5 px-4 py-2">
                <p className="flex min-w-0 items-center gap-1.5 text-sm">
                    <Layers className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate"><b>{group}</b>{qty ? <> × {qty}</> : null} — qual {kind || "variação"}?</span>
                </p>
                <button type="button" aria-label="Fechar" onClick={onClose} className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
                {options.map((o, i) => (
                    <button
                        key={o.key}
                        type="button"
                        disabled={o.disabled}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onPick(o.key)}
                        className={cn("flex min-h-14 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition hover:border-primary hover:bg-primary/5 disabled:opacity-40")}
                    >
                        <span className="flex w-full items-center justify-between gap-2">
                            <span className="truncate font-semibold">{i < 9 && <span className="mr-1.5 text-xs text-muted-foreground">{i + 1}</span>}{o.label}</span>
                            {o.right && <span className="shrink-0 text-xs font-semibold tabular-nums">{o.right}</span>}
                        </span>
                        {o.sub && <span className={cn("text-xs", o.disabled ? "text-red-500" : "text-muted-foreground")}>{o.sub}</span>}
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Teclas 1–9 escolhem; Esc fecha. Devolve true se tratou a tecla. */
export function chooserKey(e: React.KeyboardEvent, options: VariantOptionRow[], onPick: (key: string) => void, onClose: () => void): boolean {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return true; }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 9 && options[n - 1] && !options[n - 1].disabled) {
        e.preventDefault();
        onPick(options[n - 1].key);
        return true;
    }
    return false;
}
