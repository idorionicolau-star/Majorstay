"use client";

// Abas de uma secção do menu (ex.: Produtos = Stock | Catálogo; Relatórios = Vendas | Financeiro). Cada aba é uma
// página (o endereço muda), para os atalhos e o botão voltar continuarem a funcionar. Só aparecem as abas que a
// pessoa pode ver; com uma só, não há abas.
import { useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { InventoryContext } from "@/context/inventory-context";
import type { ModulePermission } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SectionTab = { href: string; label: string; perm: ModulePermission; managerOnly?: boolean };

export function SectionTabs({ tabs, label, tourId, className }: { tabs: SectionTab[]; label: string; tourId: string; className?: string }) {
    const pathname = usePathname();
    const ctx = useContext(InventoryContext);
    const canView = ctx?.canView || (() => false);
    const isManager = ctx?.user?.role === "Admin" || ctx?.user?.role === "Dono";
    const visible = tabs.filter((t) => canView(t.perm) && (!t.managerOnly || isManager));
    if (visible.length < 2) return null;
    return (
        <nav data-tour={tourId} aria-label={label} className={cn("grid rounded-xl bg-muted p-1", className)} style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
            {visible.map((t) => {
                const active = pathname === t.href;
                return (
                    <Link
                        key={t.href}
                        href={t.href}
                        data-tour={`${tourId}:${t.href}`}
                        aria-current={active ? "page" : undefined}
                        className={cn("truncate rounded-lg py-2 text-center font-semibold transition-colors", visible.length > 3 ? "px-1 text-xs sm:px-2 sm:text-sm" : "px-2 text-sm", active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}

export const REPORT_TABS: SectionTab[] = [
    { href: "/reports", label: "Vendas", perm: "reports" },
    { href: "/finance", label: "Financeiro", perm: "finance" },
];

/** As abas de Relatórios (topo de /reports e /finance). */
export function ReportsTabs({ className }: { className?: string }) {
    return <SectionTabs tabs={REPORT_TABS} label="Relatórios" tourId="reports-tabs" className={className} />;
}
