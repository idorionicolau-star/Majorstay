"use client";

import { useContext, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { InventoryContext } from "@/context/inventory-context";

/**
 * Avisa o servidor, no máximo uma vez por dia e por empresa, de que a app foi usada (emails de "falta de uso").
 * Sem internet, tenta de novo quando a ligação voltar. O servidor conta também as vendas e movimentos sincronizados.
 */
export function ActivityPing() {
    const inv = useContext(InventoryContext);
    const companyId = inv?.companyId;
    const uid = inv?.firebaseUser?.uid;
    useEffect(() => {
        if (!companyId || !uid) return;
        const key = `majorstockx-active-${companyId}-${uid}`;
        const today = new Date().toISOString().slice(0, 10);
        const done = () => { try { return localStorage.getItem(key) === today; } catch { return false; } };
        if (done()) return;
        const ping = async () => {
            if (done() || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
            try {
                const token = await getAuth().currentUser?.getIdToken();
                if (!token) return;
                const r = await fetch("/api/activity", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                if (r.ok) { try { localStorage.setItem(key, today); } catch { /* ignore */ } }
            } catch { /* offline: tenta quando a ligação voltar */ }
        };
        const t = setTimeout(ping, 3000);
        // aberta sem internet: avisa assim que a ligação voltar, sem ter de fechar e abrir a app
        window.addEventListener("online", ping);
        return () => { clearTimeout(t); window.removeEventListener("online", ping); };
    }, [companyId, uid]);
    return null;
}
