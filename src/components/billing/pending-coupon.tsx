"use client";

import { useContext, useEffect, useRef } from "react";
import { InventoryContext } from "@/context/inventory-context";
import { useAuth } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { couponReminder } from "@/lib/coupon-core";
import { formatCurrency } from "@/lib/utils";

/** Código de convite escrito no registo (ou vindo do link ?codigo=…): fica aqui até a empresa existir. */
export const PENDING_COUPON_KEY = "majorstockx-pending-coupon";

export function savePendingCoupon(code: string) {
    try { if (code.trim()) localStorage.setItem(PENDING_COUPON_KEY, code.trim()); } catch { /* ignore */ }
}

/** Montado no layout: assim que a empresa nova abre, aplica o código do convite (uma vez) e avisa. */
export function PendingCoupon() {
    const ctx = useContext(InventoryContext);
    const auth = useAuth();
    const { toast } = useToast();
    const tried = useRef(false);
    const companyId = ctx?.companyId;
    const role = ctx?.user?.role;

    useEffect(() => {
        if (tried.current || !companyId || !(role === "Admin" || role === "Dono")) return;
        let code: string | null = null;
        try { code = localStorage.getItem(PENDING_COUPON_KEY); } catch { /* ignore */ }
        if (!code) return;
        tried.current = true;
        (async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) { tried.current = false; return; }
                const r = await fetch("/api/billing/coupon", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ code }),
                });
                const j = await r.json().catch(() => ({}));
                try { localStorage.removeItem(PENDING_COUPON_KEY); } catch { /* ignore */ }
                if (r.ok && j.coupon) toast({ title: "Código de convite aplicado 🎟", description: `${couponReminder(j.coupon, formatCurrency)}, no plano Mensal — aplica-se quando subscrever.` });
                else if (r.ok) toast({ title: "Código de convite registado 🤝", description: "Obrigado! Quem o convidou fica a saber que chegou." });
                else toast({ variant: "destructive", title: "O código de convite não foi aplicado", description: j.error || "Pode tentar de novo na página de Subscrição." });
            } catch {
                tried.current = false; // sem rede: tenta outra vez quando voltar
            }
        })();
    }, [companyId, role, auth, toast]);

    return null;
}
