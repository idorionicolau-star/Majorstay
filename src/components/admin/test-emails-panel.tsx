"use client";

import { useState } from "react";
import { getAuth } from "firebase/auth";
import { Eye, Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FOLLOWUP_CATALOG } from "@/lib/followups-core";
import { cn } from "@/lib/utils";

type Planned = { companyId: string; companyName?: string; type: string; to: string[] };

const LABEL: Record<string, string> = Object.fromEntries([...FOLLOWUP_CATALOG.map((f) => [f.type, f.label]), ["manual-payment", "Pagamento a confirmar (para si)"]]);

async function call(body?: unknown) {
    const token = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/admin/test-email", {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { ok: r.ok, json: await r.json().catch(() => ({})) };
}

/** Super-administrador: enviar a si próprio um exemplo de cada email automático e ver quem os receberia hoje. */
export function TestEmailsPanel({ ownEmail }: { ownEmail?: string }) {
    const { toast } = useToast();
    const [busy, setBusy] = useState<string | null>(null);
    const [planned, setPlanned] = useState<Planned[] | null>(null);
    const [loadingPlan, setLoadingPlan] = useState(false);

    const send = async (type: string) => {
        setBusy(type);
        const r = await call({ type });
        setBusy(null);
        if (!r.ok) { toast({ variant: "destructive", title: "Não foi enviado", description: r.json.error || r.json.failed?.[0]?.error || "Tente de novo." }); return; }
        const n = r.json.sent?.length || 0;
        const f = r.json.failed?.length || 0;
        toast({ title: n === 1 ? "Email de teste enviado" : `${n} emails de teste enviados`, description: `Para ${r.json.to}${f ? ` · ${f} falharam` : ""}. Veja também em Spam e Promoções.` });
    };

    const preview = async () => {
        setLoadingPlan(true);
        const r = await call();
        setLoadingPlan(false);
        if (!r.ok) { toast({ variant: "destructive", title: "Não foi possível ver", description: r.json.error || "" }); return; }
        setPlanned(r.json.planned || []);
    };

    return (
        <Card data-tour="test-emails-panel">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> Emails automáticos</CardTitle>
                <CardDescription>
                    Envie a si próprio{ownEmail ? <> (<b>{ownEmail}</b>)</> : null} um exemplo de cada email, com dados de exemplo e “[TESTE]” no assunto.
                    Os emails de dicas trazem o link “Não quero receber” — se tocar nele, desliga as dicas da sua empresa (volta a ligar em Ajustes → Empresa).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid gap-2 sm:grid-cols-2">
                    {[...FOLLOWUP_CATALOG, { type: "manual-payment", kind: "account", label: LABEL["manual-payment"], when: "quando um cliente pede para pagar por M-Pesa / e-Mola" }].map((f) => (
                        <div key={f.type} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">
                                    {f.label}
                                    <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", f.kind === "tips" ? "bg-sky-500/15 text-sky-700 dark:text-sky-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
                                        {f.kind === "tips" ? "dica" : "conta"}
                                    </span>
                                </p>
                                <p className="text-xs text-muted-foreground">{f.when}</p>
                            </div>
                            <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => send(f.type)} aria-label={`Testar: ${f.label}`}>
                                {busy === f.type ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={!!busy} onClick={() => send("all")}>
                        {busy === "all" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Enviar todos para mim
                    </Button>
                    <Button type="button" variant="outline" disabled={loadingPlan} onClick={preview}>
                        {loadingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />} Quem receberia hoje?
                    </Button>
                </div>
                {planned && (
                    <div data-tour="test-emails-plan">
                        <p className="mb-2 text-sm font-semibold">Se o envio fosse agora (nada foi enviado):</p>
                        {planned.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém — nenhuma empresa precisa de email hoje.</p> : (
                            <ul className="divide-y rounded-lg border text-sm">
                                {planned.map((p) => (
                                    <li key={p.companyId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                        <span className="min-w-0 truncate"><b>{p.companyName || p.companyId}</b> · {p.to.join(", ")}</span>
                                        <span className="text-xs font-medium text-primary">{LABEL[p.type] || p.type}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">O envio automático é todos os dias às 18:30 (Maputo), a seguir ao relatório do fim do dia.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
