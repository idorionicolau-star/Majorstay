"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parentPath } from "@/lib/back-nav";
import { inventoryReturnUrl } from "@/lib/deep-links";
import { cn } from "@/lib/utils";

// A página anterior dentro da app (neste separador). Sem ela — página aberta por um link de email, por exemplo —
// a seta vai à página mãe em vez de sair da app. Guarda-se o caminho (e não um contador) para não contar a mesma
// página duas vezes; as de entrar/registar não contam como "anterior".
const CUR_KEY = "majorstockx-nav-current";
const PREV_KEY = "majorstockx-nav-prev";
const read = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };

/** Regista cada mudança de página (fica no cabeçalho, que está em todas). */
export function useNavTracker() {
    const pathname = usePathname();
    useEffect(() => {
        try {
            const cur = sessionStorage.getItem(CUR_KEY);
            if (cur === pathname) return;
            if (cur && !["/login", "/register", "/"].includes(cur)) sessionStorage.setItem(PREV_KEY, cur);
            sessionStorage.setItem(CUR_KEY, pathname);
        } catch { /* sem storage: volta sempre à mãe */ }
    }, [pathname]);
}

/** Seta "voltar" das sub-páginas: à página anterior, ou à mãe (o inventário volta com o filtro que tinha). */
export function BackButton({ className }: { className?: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const parent = parentPath(pathname);
    if (!parent) return null;
    const goBack = () => {
        if (read(PREV_KEY) && window.history.length > 1) router.back();
        else router.push(parent === "/inventory" ? inventoryReturnUrl() : parent);
    };
    return (
        <Button type="button" variant="ghost" size="icon" onClick={goBack} aria-label="Voltar" data-tour="back-button"
            className={cn("h-9 w-9 shrink-0 rounded-full", className)}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
    );
}
