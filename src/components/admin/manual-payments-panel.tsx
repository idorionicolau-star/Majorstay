"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MANUAL_METHODS, isManualMethod } from "@/lib/manual-pay-core";
import { PLANS } from "@/lib/plans";
import { tierLabel, type PayTier } from "@/lib/tiers";
import { cn, formatCurrency } from "@/lib/utils";

type ManualPayment = {
    reference: string; companyId: string; companyName?: string; method: string; planId: string; tier?: PayTier; amount: number;
    email?: string | null; createdBy?: string; createdAt: string; status: "pending" | "paid" | "rejected"; until?: string;
};

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "");

async function call(body?: unknown) {
    const token = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/admin/manual-payments", {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { ok: r.ok, json: await r.json().catch(() => ({})) };
}

/** Super-administrador: pagamentos directos por M-Pesa / e-Mola. Confirme depois de ver o dinheiro e o comprovativo. */
export function ManualPaymentsPanel() {
    const { toast } = useToast();
    const [list, setList] = useState<ManualPayment[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        const r = await call();
        if (r.ok) setList(r.json.payments || []);
    }, []);
    useEffect(() => { load(); }, [load]);

    const decide = async (p: ManualPayment, action: "confirm" | "reject") => {
        if (action === "reject" && !window.confirm(`Recusar o pagamento ${p.reference} de ${p.companyName || p.companyId}?`)) return;
        setBusy(p.reference);
        const r = await call({ reference: p.reference, action });
        setBusy(null);
        if (!r.ok) { toast({ variant: "destructive", title: "Não foi possível", description: r.json.error || "Tente de novo." }); return; }
        toast({ title: action === "confirm" ? "Conta activada" : "Pagamento recusado", description: action === "confirm" && r.json.until ? `${p.companyName || p.companyId} activa até ${new Date(r.json.until).toLocaleDateString("pt-PT")}.` : undefined });
        load();
    };

    const pending = list?.filter((p) => p.status === "pending") || [];
    const done = list?.filter((p) => p.status !== "pending").slice(0, 10) || [];

    return (
        <Card data-tour="manual-payments-panel">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                    <CardTitle>Pagamentos por M-Pesa / e-Mola {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-sm text-amber-600">{pending.length} por confirmar</span>}</CardTitle>
                    <CardDescription>
                        Confirme só depois de ver o dinheiro na conta ({MANUAL_METHODS.mpesa.label} {MANUAL_METHODS.mpesa.display} · {MANUAL_METHODS.emola.label} {MANUAL_METHODS.emola.display}) e o comprovativo com a referência. Confirmar activa a conta pelos meses do plano.
                    </CardDescription>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={load}><RefreshCw className="mr-1 h-4 w-4" /> Actualizar</Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {list === null ? <p className="text-sm text-muted-foreground">A carregar…</p>
                    : pending.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pagamento por confirmar.</p>
                        : (
                            <ul className="divide-y rounded-lg border text-sm">
                                {pending.map((p) => (
                                    <li key={p.reference} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                                        <div className="min-w-[14rem] flex-1">
                                            <p className="font-semibold">{p.companyName || p.companyId} · {formatCurrency(p.amount)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {isManualMethod(p.method) ? MANUAL_METHODS[p.method].label : p.method} · {p.tier ? `${tierLabel(p.tier)} · ` : ""}{PLANS.find((x) => x.id === p.planId)?.label || p.planId} · ref. <b>{p.reference}</b>
                                                {p.email ? ` · ${p.email}` : ""} · {fmt(p.createdAt)}
                                            </p>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => decide(p, "reject")}><X className="mr-1 h-4 w-4" /> Recusar</Button>
                                        <Button type="button" size="sm" disabled={!!busy} onClick={() => decide(p, "confirm")} className="bg-emerald-600 text-white hover:bg-emerald-700">
                                            {busy === p.reference ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Confirmar
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                {done.length > 0 && (
                    <div>
                        <h3 className="mb-2 text-sm font-semibold">Últimos tratados</h3>
                        <ul className="divide-y rounded-lg border text-sm">
                            {done.map((p) => (
                                <li key={p.reference} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                    <span className="min-w-0 truncate">{p.companyName || p.companyId} · {formatCurrency(p.amount)} · ref. {p.reference}</span>
                                    <span className={cn("text-xs font-medium", p.status === "paid" ? "text-emerald-600" : "text-red-600")}>
                                        {p.status === "paid" ? `Confirmado${p.until ? ` · até ${new Date(p.until).toLocaleDateString("pt-PT")}` : ""}` : "Recusado"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
