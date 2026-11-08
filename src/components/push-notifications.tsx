"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, X } from "lucide-react";
import { useInventory } from "@/context/inventory-context";
import { useAuth } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "majorstockx-push-prompt-dismissed";

/** Small banner shown once per device until the user enables or dismisses it. */
export function PushPrompt() {
    const { companyId, user } = useInventory();
    const { status, enable, busy } = usePushNotifications(companyId, user, { listen: true });
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
    }, []);

    if (dismissed || status !== "default" || !user) return null;

    const close = () => {
        setDismissed(true);
        try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    };

    return (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <BellRing className="h-5 w-5 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 text-sm">Receber alertas de vendas e stock crítico neste aparelho?</p>
            <Button size="sm" onClick={enable} disabled={busy} className="shrink-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activar"}
            </Button>
            <button type="button" aria-label="Agora não" onClick={close} className="shrink-0 p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
    );
}

/** Settings card: current state on this device + how to fix it. */
export function PushSettingsCard() {
    const { companyId, user } = useInventory();
    const { status, enable, busy, error } = usePushNotifications(companyId, user);
    const auth = useAuth();
    const { toast } = useToast();
    const [testing, setTesting] = useState(false);

    const sendTest = async () => {
        setTesting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const r = await fetch("/api/push", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ companyId, includeSelf: true, title: "🔔 Teste do MajorStockX", body: "As notificações estão a funcionar neste aparelho.", link: "/dashboard" }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.details || j.error);
            if (!j.devices) {
                toast({ variant: "destructive", title: "Nenhum aparelho registado", description: "Este telemóvel ainda não está ligado aos alertas. Toque em Activar, aceite o pedido do navegador e repita o teste." });
            } else if (!j.sent) {
                toast({ variant: "destructive", title: "O envio falhou", description: `${j.errorCode || "erro"}: ${j.errorMessage || "o Firebase recusou a mensagem"}` });
            } else {
                toast({ title: "Teste enviado", description: `Enviado para ${j.sent} aparelho(s). Se a app estiver aberta, aparece aqui; fechada, aparece na barra do telemóvel.` });
            }
        } catch (e) {
            toast({ variant: "destructive", title: "O teste falhou", description: e instanceof Error ? e.message : "Erro desconhecido" });
        } finally {
            setTesting(false);
        }
    };

    const info: Record<string, { icon: React.ElementType; tone: string; title: string; text: string }> = {
        enabled: { icon: Bell, tone: "text-emerald-600", title: "Activas neste aparelho", text: "Vai receber alertas de vendas e de stock crítico." },
        default: { icon: BellRing, tone: "text-primary", title: "Desligadas neste aparelho", text: "Toque em Activar e aceite o pedido do navegador." },
        denied: { icon: BellOff, tone: "text-red-500", title: "Bloqueadas pelo navegador", text: "No Android: toque no cadeado ao lado do endereço (ou mantenha o ícone da app premido → Info da app) → Notificações → Permitir. Depois volte aqui." },
        unsupported: { icon: BellOff, tone: "text-muted-foreground", title: "Este navegador não suporta", text: "Use o Chrome no Android. No iPhone é preciso instalar a app no ecrã principal (iOS 16.4 ou mais recente)." },
        "no-key": { icon: BellOff, tone: "text-amber-600", title: "Falta configurar o servidor", text: "A chave VAPID (NEXT_PUBLIC_VAPID_KEY) não está definida na Vercel." },
        error: { icon: BellOff, tone: "text-amber-600", title: "Não foi possível activar", text: `Verifique a ligação à internet e tente de novo.${error ? ` (motivo: ${error})` : ""}` },
    };
    const s = info[status] || info.default;
    const Icon = s.icon;

    return (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-4">
            <Icon className={cn("h-6 w-6 shrink-0", s.tone)} />
            <div className="min-w-[12rem] flex-1">
                <p className="font-semibold">Notificações · {s.title}</p>
                <p className="text-sm text-muted-foreground">{s.text}</p>
            </div>
            {(status === "default" || status === "error") && (
                <Button onClick={enable} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activar"}</Button>
            )}
            {status === "enabled" && (
                <Button variant="outline" onClick={sendTest} disabled={testing}>{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar teste"}</Button>
            )}
        </div>
    );
}
