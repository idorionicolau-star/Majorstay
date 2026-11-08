"use client";

import { useState } from "react";
import { Calendar, Pencil } from "lucide-react";
import { todayMz, validProductionDate } from "@/lib/production-core";

/**
 * A data de uma produção, com um lápis para a corrigir (ex.: registada hoje mas feita ontem). Só muda o dia do
 * registo — o stock não mexe.
 */
export function ProductionDateEdit({ date, canEdit, onChange }: { date: string; canEdit: boolean; onChange: (date: string) => void }) {
    const [editing, setEditing] = useState(false);
    const day = (date || "").slice(0, 10);
    const label = day ? new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-PT", { timeZone: "UTC" }) : "—";
    if (editing) {
        return (
            <input type="date" autoFocus aria-label="Dia da produção" defaultValue={day} max={todayMz()}
                className="rounded border bg-background px-1 text-xs"
                onBlur={() => setEditing(false)}
                onChange={(e) => {
                    const v = e.target.value;
                    if (validProductionDate(v) && v !== day) { onChange(v); setEditing(false); }
                }} />
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5">
            <Calendar size={12} />
            <span>{label}</span>
            {canEdit && (
                <button type="button" onClick={() => setEditing(true)} aria-label="Mudar a data da produção" className="rounded p-0.5 text-muted-foreground hover:text-primary">
                    <Pencil size={11} />
                </button>
            )}
        </span>
    );
}
