"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

/** "Ver todas as opções" / "Menu simples": no fim do menu, para quem começa com o essencial. */
export function MenuModeToggle({ simple, hiddenCount, onChange }: { simple: boolean; hiddenCount: number; onChange: (simple: boolean) => void }) {
    if (hiddenCount === 0) return null;
    return (
        <button
            type="button"
            onClick={() => onChange(!simple)}
            className="mx-1 mt-1 flex items-center gap-2 rounded-xl px-4 py-2 text-left text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-primary dark:hover:bg-slate-800/50"
        >
            {simple ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            {simple ? `Ver todas as opções (+${hiddenCount})` : "Menu simples"}
        </button>
    );
}
