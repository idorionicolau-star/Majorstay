"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { InventoryContext } from "@/context/inventory-context";
import { sendEmailVerification } from "firebase/auth";
import { useAuth } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { ESCALEPAY_SOURCE } from "@/lib/escalepay-core";

/** Quem chegou pelo link dos afiliados (/register?origem=escalepay): fica aqui até a empresa existir. */
export const ORIGIN_KEY = "majorstockx-origem";

export function saveOrigin(origin: string) {
    try { if (origin) localStorage.setItem(ORIGIN_KEY, origin); } catch { /* ignore */ }
}

/** A empresa veio da EscalePay (marcada no servidor, ou acabou de se registar pelo link neste aparelho)? */
export function useFromEscalepay(): boolean {
    const ctx = useContext(InventoryContext);
    const [flag, setFlag] = useState(false);
    useEffect(() => { try { setFlag(localStorage.getItem(ORIGIN_KEY) === ESCALEPAY_SOURCE); } catch { /* ignore */ } }, []);
    return ctx?.companyData?.source === ESCALEPAY_SOURCE || flag;
}

/**
 * Montado no layout: o administrador abre a app e, se houver uma compra da EscalePay com o email dele ainda por
 * usar, a empresa fica activa (uma vez por sessão; a compra também se aplica logo que é registada, se ele já tiver conta).
 */
export function EscalepayClaim() {
    const ctx = useContext(InventoryContext);
    const auth = useAuth();
    const { toast } = useToast();
    const tried = useRef(false);
    const companyId = ctx?.companyId;
    const role = ctx?.user?.role;

    useEffect(() => {
        if (tried.current || !companyId || !(role === "Admin" || role === "Dono")) return;
        const key = `majorstockx-escalepay-claim-${companyId}`;
        let origin: string | null = null;
        try {
            if (sessionStorage.getItem(key)) return;
            origin = localStorage.getItem(ORIGIN_KEY);
        } catch { /* ignore */ }
        tried.current = true;
        (async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) { tried.current = false; return; }
                const r = await fetch("/api/escalepay/claim", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify(origin === ESCALEPAY_SOURCE ? { source: ESCALEPAY_SOURCE } : {}),
                });
                if (!r.ok) { tried.current = false; return; }
                const j = await r.json().catch(() => ({}));
                if (j.needsVerification) {
                    // há uma compra para este email, mas o email ainda não foi confirmado: envia o link e tenta na próxima visita
                    if (auth.currentUser) sendEmailVerification(auth.currentUser, { url: window.location.origin + "/dashboard" }).catch(() => {});
                    toast({ title: "Confirme o seu email", description: "Enviámos um link para o seu email. Depois de o abrir, a compra da EscalePay fica activa.", duration: 12000 });
                    return;
                }
                try { sessionStorage.setItem(key, "1"); localStorage.removeItem(ORIGIN_KEY); } catch { /* ignore */ }
                if (j.applied > 0) {
                    const until = j.until ? new Date(j.until).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" }) : "";
                    const show = () => toast({ title: "Compra da EscalePay confirmada ✅", description: `A sua conta está activa${until ? ` até ${until}` : ""}. Obrigado!` });
                    // acabado de registar: espera que o aviso "Empresa registada" passe (só se vê um aviso de cada vez)
                    if (origin) setTimeout(show, 4000); else show();
                }
            } catch {
                tried.current = false; // sem rede: tenta outra vez quando voltar
            }
        })();
    }, [companyId, role, auth, toast]);

    return null;
}
