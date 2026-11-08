"use client";

import { ReservedBadge } from "./reserved-dialog";
import Link from "next/link";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import type { Product } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { getStockStatus } from "./columns";

const STOCK_TONE = {
    bom: "text-[hsl(var(--chart-2))]",
    baixo: "text-[hsl(var(--chart-4))]",
    critico: "text-destructive",
    "sem-estoque": "text-destructive",
} as const;

const STATUS_LABEL = { baixo: "Baixo", critico: "Crítico", "sem-estoque": "Esgotado" } as const;

/** Linha compacta do inventário — mostra 3 a 4 vezes mais produtos por ecrã do que os cartões. */
export function ProductRow({ product, canEdit, locationName }: { product: Product; canEdit: boolean; locationName?: string }) {
    const status = getStockStatus(product);
    const available = product.stock - product.reservedStock;
    const noCost = product.cost === undefined || product.cost <= 0;
    const href = canEdit
        ? `/inventory/${product.instanceId || product.id}/edit`
        : `/inventory/history?productName=${encodeURIComponent(product.name)}`;

    return (
        <Link href={href} className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 hover:bg-muted/50 active:bg-muted">
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{product.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                    {formatCurrency(product.price)}
                    {product.category && ` · ${product.category}`}
                    {locationName && ` · ${locationName}`}
                    {noCost && <span className="text-amber-600 dark:text-amber-400"> · sem custo</span>}
                    {product.reservedStock > 0 && <> · <ReservedBadge product={product} className="text-primary underline decoration-dotted underline-offset-2">{product.reservedStock} reservado{product.reservedStock === 1 ? "" : "s"}</ReservedBadge></>}
                </p>
            </div>
            <div className="shrink-0 text-right">
                <p className={cn("text-base font-black leading-none", STOCK_TONE[status])}>
                    {available}<span className="ml-0.5 text-[10px] font-bold text-muted-foreground">{product.unit || "un"}</span>
                </p>
                {status !== "bom" && (
                    <p className={cn("mt-0.5 text-[9px] font-black uppercase tracking-wider", STOCK_TONE[status])}>{STATUS_LABEL[status]}</p>
                )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        </Link>
    );
}

const STATUS_RANK = { bom: 0, baixo: 1, critico: 2, "sem-estoque": 3 } as const;

/** Resumo de uma família de variações: total disponível, o pior estado e quanto há de cada variação. */
export function familySummary(members: Product[]) {
    const available = members.reduce((t, p) => t + (p.stock - p.reservedStock), 0);
    type Status = keyof typeof STATUS_RANK;
    const worst = members.map((p) => getStockStatus(p) as Status).reduce<Status>((w, s) => (STATUS_RANK[s] > STATUS_RANK[w] ? s : w), "bom");
    const flagged = members.filter((p) => getStockStatus(p) !== "bom").length;
    return { available, worst, flagged, unit: members[0]?.unit || "un" };
}

/** Uma família de variações numa só linha: toca-se para ver cada variação. */
export function FamilyRow({ group, members, expanded, onToggle, locationName, label }: {
    group: string;
    members: Product[];
    expanded: boolean;
    onToggle: () => void;
    locationName?: string;
    label: (p: Product) => string;
}) {
    const s = familySummary(members);
    return (
        <button type="button" data-tour="inv-family" onClick={onToggle} aria-expanded={expanded}
            className="flex w-full items-center gap-3 border-b border-border/60 bg-primary/[0.03] px-3 py-2.5 text-left hover:bg-muted/50 active:bg-muted">
            <Layers className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{group} <span className="font-normal text-muted-foreground">· {members.length} variações</span></p>
                <p className="truncate text-[11px] text-muted-foreground">
                    {members.map((p) => `${label(p)} ${p.stock - p.reservedStock}`).join(" · ")}
                    {locationName && ` · ${locationName}`}
                </p>
            </div>
            <div className="shrink-0 text-right">
                <p className={cn("text-base font-black leading-none", STOCK_TONE.bom)}>
                    {s.available}<span className="ml-0.5 text-[10px] font-bold text-muted-foreground">{s.unit}</span>
                </p>
                {s.flagged > 0 && <p className={cn("mt-0.5 text-[9px] font-black uppercase tracking-wider", STOCK_TONE[s.worst])}>{s.flagged} {s.worst === "bom" ? "" : STATUS_LABEL[s.worst].toLowerCase()}</p>}
            </div>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform", expanded && "rotate-180")} />
        </button>
    );
}
