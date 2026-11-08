"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { mainNavItems, NAV_GROUPS } from "@/lib/data";
import { InventoryContext } from "@/context/inventory-context";
import type { ModulePermission, NavItem } from "@/lib/types";
import { ADVANCED_HREFS, menuMode } from "@/lib/onboarding";
import { companyHas, featureForPath } from "@/lib/tiers";
import { saveNavHint } from "@/lib/nav-hint";
import { useNavHint } from "@/hooks/use-nav-hint";

// Só quem fabrica usa produção, encomendas e matéria-prima.
const MANUFACTURING_ONLY = new Set(["production", "orders", "raw-materials"]);

/**
 * Menu por tarefa (Vender, Stock, Pessoas, Dinheiro, Ajustes), com as sub-páginas
 * à vista e sem os módulos que a empresa não usa. Partilhado pelo menu lateral e
 * pelo menu "Mais" do telemóvel.
 */
export function useNavGroups() {
    const pathname = usePathname();
    const { canView, companyData, companyId, sales, user, loading } = useContext(InventoryContext) || { canView: () => false, companyData: null, companyId: null, sales: [], user: null, loading: true };
    // a recarregar, antes de se saber quem é: o menu da última vez (ver lib/nav-hint.ts)
    const hint = useNavHint();
    const fromHint = !user && !!hint;
    // Funcionários e Subscrição: só o Dono e o Administrador (as páginas também o exigem)
    const isManager = user?.role === "Admin" || user?.role === "Dono";
    const reseller = companyData?.businessType === "reseller";

    // Menu simples: uma empresa nova (sem vendas) começa só com o essencial; um toque mostra tudo e a escolha fica guardada.
    const storageKey = `majorstockx-menu-${companyId || "x"}`;
    const [saved, setSaved] = useState<string | null>(null);
    useEffect(() => { try { setSaved(localStorage.getItem(storageKey)); } catch { setSaved(null); } }, [storageKey]);
    const simple = fromHint ? hint.simple : menuMode(saved, sales?.length || 0) === "simple";
    const setSimple = useCallback((on: boolean) => {
        const v = on ? "simple" : "full";
        setSaved(v);
        try { localStorage.setItem(storageKey, v); } catch { /* ignore */ }
    }, [storageKey]);

    const tier = companyData?.tier;
    const status = companyData?.status;
    const allowed = useMemo(() => mainNavItems.flatMap((item): NavItem[] => {
        // fora do plano: fica no menu com cadeado (é assim que se descobre o que o plano seguinte dá)
        const open = (href: string) => { const f = featureForPath(href); return !f || companyHas({ tier, status }, f); };
        const withLock = (i: NavItem): NavItem => {
            if (open(i.href)) return i;
            // a página principal não está no plano mas outra aba da secção está (Relatórios → Financeiro): abre essa
            const other = i.also?.find((h) => open(h) && (!i.fallback || h !== i.fallback.href || canView(i.fallback.id)));
            return other ? { ...i, href: other } : { ...i, locked: true };
        };
        if (reseller && MANUFACTURING_ONLY.has(item.id)) return [];
        if (item.adminOnly && !isManager) return [];
        if (canView(item.id as ModulePermission)) return [withLock(item)];
        // sem acesso à página principal da secção mas com acesso a outra aba (ex.: só Financeiro): abre essa
        if (item.fallback && canView(item.fallback.id)) return [withLock({ ...item, href: item.fallback.href })];
        return [];
    }), [canView, reseller, isManager, tier, status]);
    const shown = useMemo(() => !fromHint ? allowed : hint.items.flatMap((h): NavItem[] => {
        const item = mainNavItems.find((i) => i.title === h.title);
        return item ? [{ ...item, href: h.href, locked: h.locked }] : [];
    }), [fromHint, hint, allowed]);
    // guarda o menu para a próxima recarga (só com tudo carregado, para não guardar um menu a meio)
    useEffect(() => {
        if (!user || loading) return;
        saveNavHint({ items: allowed.map((i) => ({ title: i.title, id: String(i.id), href: i.href, ...(i.locked ? { locked: true } : {}) })), simple, name: user.username, email: user.email, ...(user.profilePictureUrl ? { photo: user.profilePictureUrl } : {}) });
    }, [user, loading, allowed, simple]);
    const hiddenCount = shown.filter((i) => ADVANCED_HREFS.has(i.href)).length;

    const groups = useMemo(() => {
        const visible = simple ? shown.filter((i) => !ADVANCED_HREFS.has(i.href)) : shown;
        return NAV_GROUPS
            .map((g) => ({ ...g, items: visible.filter((i) => (i.group || "ajustes") === g.id) }))
            .filter((g) => g.items.length > 0);
    }, [shown, simple]);

    // A página activa é a entrada mais específica que corresponde ao endereço
    // (em /inventory/quick acende "Stock Rápido", não também "Inventário").
    const activeHref = useMemo(() => {
        const under = (path: string) => pathname === path || pathname.startsWith(path + "/");
        const matches = mainNavItems.flatMap((i) => [i.href, ...(i.also || [])].filter(under).map((path) => ({ path, href: i.href })));
        return matches.sort((a, b) => b.path.length - a.path.length)[0]?.href || null;
    }, [pathname]);

    const isActive = (item: NavItem) => item.href === activeHref || (!!activeHref && mainNavItems.some((i) => i.href === activeHref && i.also?.includes(item.href)));

    return { groups, isActive, simple, hiddenCount, setSimple };
}
