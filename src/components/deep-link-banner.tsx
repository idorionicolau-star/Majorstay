"use client";

import { Crosshair, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Faixa que aparece quando se chega a uma página por um aviso: diz o que está a ser mostrado e deixa ver tudo. */
export function DeepLinkBanner({ title, hint, count, onClear, children }: {
    title: string;
    hint?: string;
    count?: number;
    onClear: () => void;
    children?: React.ReactNode;
}) {
    return (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 md:p-4">
            <Crosshair className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-[12rem] flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">A mostrar só</p>
                <p className="font-semibold leading-snug">{title}</p>
                {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
                {count === 0 && <p className="text-sm text-emerald-600">Já não há nada por resolver aqui. 🎉</p>}
            </div>
            {children}
            <Button type="button" variant="outline" size="sm" onClick={onClear} className="shrink-0">
                <X className="mr-1 h-4 w-4" /> Limpar filtro
            </Button>
        </div>
    );
}
