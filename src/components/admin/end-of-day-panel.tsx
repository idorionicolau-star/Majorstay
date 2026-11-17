"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Company = { companyId: string; companyName: string; emails: string[]; configuredTime: string; slot: string };
type RunResult = { companyId: string; companyName: string; emails: string[]; configuredTime: string; slot: string; status: "sent" | "failed" | "other-slot"; error?: string };
type Run = { id: string; startedAt: string; slot: string; fatal?: string; sent?: number; failed?: number; noReportCompanies?: number; results?: RunResult[] };

async function call(body?: unknown) {
    const token = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/admin/end-of-day", {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
    });
    return { ok: r.ok, json: await r.json().catch(() => ({})) };
}

const when = (iso: string) => new Date(iso).toLocaleString("pt-PT", { timeZone: "Africa/Maputo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Super-administrador: ver quem recebe o relatório do fim do dia, enviar já e ver o que o cron fez nos últimos dias. */
export function EndOfDayPanel() {
    const { toast } = useToast();
    const [companies, setCompanies] = useState<Company[] | null>(null);
    const [runs, setRuns] = useState<Run[]>([]);
    const [hasApiKey, setHasApiKey] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const r = await call();
        setLoading(false);
        if (!r.ok) { toast({ variant: "destructive", title: "Não foi possível carregar", description: r.json.error || "" }); return; }
        setCompanies(r.json.companies || []);
        setRuns(r.json.runs || []);
        setHasApiKey(r.json.hasApiKey !== false);
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    const sendNow = async (c: Company) => {
        setBusy(c.companyId);
        const r = await call({ companyId: c.companyId });
        setBusy(null);
        if (!r.ok) {
            toast({ variant: "destructive", title: "Não foi enviado", description: r.json.results?.[0]?.error || r.json.error || "Tente de novo." });
            return;
        }
        toast({ title: "Relatório enviado", description: `Para ${c.emails.join(", ")}. Veja também em Spam e Promoções.` });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                    <span>Relatório do fim do dia</span>
                    <Button type="button" size="sm" variant="outline" disabled={loading} onClick={load} aria-label="Atualizar">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                </CardTitle>
                <CardDescription>
                    Empresas com o relatório ligado, a hora escolhida e o resultado das últimas execuções automáticas.
                    {!hasApiKey && <b className="text-destructive"> RESEND_API_KEY não está configurada: nada é enviado.</b>}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div>
                    <p className="mb-2 text-sm font-semibold">Empresas ({companies?.length ?? "…"})</p>
                    {companies && companies.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa tem o relatório ligado.</p>}
                    <ul className="divide-y rounded-lg border text-sm">
                        {(companies || []).map((c) => (
                            <li key={c.companyId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                <span className="min-w-0">
                                    <b>{c.companyName}</b> · {c.configuredTime} (envio {c.slot})
                                    <span className="block truncate text-xs text-muted-foreground">{c.emails.join(", ")}</span>
                                </span>
                                <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => sendNow(c)}>
                                    {busy === c.companyId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Enviar agora
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <p className="mb-2 text-sm font-semibold">Últimas execuções do cron</p>
                    {runs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Ainda não há registos: aparecem a partir da próxima execução automática.</p>
                    ) : (
                        <ul className="divide-y rounded-lg border text-sm">
                            {runs.map((r) => (
                                <li key={r.id} className="px-3 py-2">
                                    <p className="font-medium">{when(r.startedAt)} · envio {r.slot}
                                        {r.fatal ? <span className="ml-2 text-destructive">erro: {r.fatal}</span> : <span className="ml-2 text-muted-foreground">{r.sent ?? 0} enviados{r.failed ? `, ${r.failed} falharam` : ""}</span>}
                                    </p>
                                    {(r.results || []).filter((x) => x.status !== "other-slot").map((x) => (
                                        <p key={x.companyId} className={x.status === "failed" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                                            {x.companyName}: {x.status === "sent" ? "enviado" : `falhou — ${x.error}`}
                                        </p>
                                    ))}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
