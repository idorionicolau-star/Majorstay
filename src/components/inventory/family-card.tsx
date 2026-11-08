"use client";

import Link from "next/link";
import { Layers } from "lucide-react";
import type { Product } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { getStockStatus } from "./columns";
import { familySummary } from "./product-row";

const TONE = { bom: "text-[hsl(var(--chart-2))]", baixo: "text-[hsl(var(--chart-4))]", critico: "text-destructive", "sem-estoque": "text-destructive" } as const;

/** Cartão de uma família de variações: o total e quanto há de cada uma (toque numa para a abrir). */
export function FamilyCard({ group, members, canEdit, label, locationName }: {
    group: string;
    members: Product[];
    canEdit: boolean;
    label: (p: Product) => string;
    locationName?: string;
}) {
    const s = familySummary(members);
    const prices = [...new Set(members.map((p) => p.price || 0))];
    return (
        <Card data-tour="inv-family" className="glass-card flex h-full flex-col p-2 shadow-sm sm:p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold leading-tight" title={group}>
                <Layers className="h-4 w-4 shrink-0 text-primary" /> <span className="line-clamp-2">{group}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{members.length} variações{locationName ? ` · ${locationName}` : ""}</p>
            <div className="mt-2 flex items-baseline justify-center rounded-lg bg-slate-50 py-2 dark:bg-slate-800/50">
                <span className={cn("text-2xl font-black", TONE.bom)}>{s.available}</span>
                <span className="text-[10px] font-bold text-muted-foreground sm:text-xs">/{s.unit} no total</span>
            </div>
            <p className="mt-1 text-center text-xs text-muted-foreground">{prices.length === 1 ? formatCurrency(prices[0]) : `${formatCurrency(Math.min(...prices))} – ${formatCurrency(Math.max(...prices))}`}</p>
            <ul className="mt-2 space-y-1">
                {members.map((p) => {
                    const st = getStockStatus(p);
                    const href = canEdit ? `/inventory/${p.instanceId || p.id}/edit` : `/inventory/history?productName=${encodeURIComponent(p.name)}`;
                    return (
                        <li key={p.instanceId}>
                            <Link href={href} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted">
                                <span className="truncate">{label(p)}</span>
                                <span className={cn("shrink-0 font-bold tabular-nums", TONE[st])}>{p.stock - p.reservedStock}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}
