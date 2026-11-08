"use client";

// As abas da secção Produtos: o Stock (Inventário), o Catálogo (preços), os Movimentos (histórico) e as Perdas.
import { SectionTabs, type SectionTab } from "@/components/layout/section-tabs";

export const PRODUCT_TABS: SectionTab[] = [
    { href: "/inventory", label: "Stock", perm: "inventory" },
    { href: "/catalog", label: "Catálogo", perm: "settings" },
    { href: "/inventory/history", label: "Movimentos", perm: "inventory" },
    // as Perdas são só para o gestor (a página também o exige)
    { href: "/inventory/perdas", label: "Perdas", perm: "inventory", managerOnly: true },
];

export function ProductsTabs({ className }: { className?: string }) {
    return <SectionTabs tabs={PRODUCT_TABS} label="Produtos" tourId="products-tabs" className={className} />;
}
