"use client";

import { useState } from "react";
import { getAuth } from "firebase/auth";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Diag = {
    env: Record<string, boolean>;
    ready?: boolean;
    missing?: string[];
    environment?: string;
    scopes?: string[];
    wallets?: Record<string, { wallet_id: string; wallet_code: string; name: string }[]>;
    webhook?: { url: string; events: string[]; is_active: boolean } | null;
    error?: string;
};
type Evt = { id: string; receivedAt: string; event: string; matched?: string | null; outcome?: Record<string, unknown>; payload?: string; error?: string };

async function call(path: string) {
    const token = await getAuth().currentUser?.getIdToken();
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
}

const Row = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
    <li className="flex items-start gap-2 text-sm">
        {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
        <span>{children}</span>
    </li>
);

/** Para o super-administrador: confirma a ligação à ZumboPay e mostra os últimos webhooks recebidos. */
export function ZumboPayCheck() {
    const [busy, setBusy] = useState(false);
    const [diag, setDiag] = useState<Diag | null>(null);
    const [events, setEvents] = useState<Evt[] | null>(null);
    const [problem, setProblem] = useState("");

    const run = async () => {
        setBusy(true);
        setProblem("");
        try {
            const d = await call("/api/billing/diagnose");
            if (d.status === 403) { setProblem("A sua conta não é super-administrador (campo superAdmin em users/<o seu id>)."); setDiag(null); return; }
            setDiag(d.json as Diag);
            const e = await call("/api/billing/events");
            setEvents(e.ok ? (e.json.events as Evt[]) : []);
        } catch (e: any) {
            setProblem(e?.message || "Erro ao verificar.");
        } finally {
            setBusy(false);
        }
    };

    const expectedHook = typeof window !== "undefined" ? `${window.location.origin}/api/billing/webhook` : "";
    const missingEnv = diag ? Object.entries(diag.env).filter(([, v]) => !v).map(([k]) => k) : [];

    return (
        <Card className="glass-panel border-white/10">
            <CardHeader>
                <CardTitle className="text-lg">Pagamentos — ZumboPay</CardTitle>
                <CardDescription>Confirma as chaves, as carteiras e o webhook, e mostra os últimos eventos recebidos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={run} disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verificar ligação
                </Button>
                {problem && <p className="text-sm text-red-600">{problem}</p>}

                {diag && (
                    <ul className="space-y-1.5">
                        <Row ok={missingEnv.length === 0}>
                            Variáveis na Vercel: {missingEnv.length === 0 ? "as 4 estão definidas" : <>faltam <b>{missingEnv.join(", ")}</b></>}
                        </Row>
                        {diag.error ? (
                            <Row ok={false}>A ZumboPay recusou o pedido: <code className="text-xs">{diag.error}</code></Row>
                        ) : (
                            <>
                                <Row ok={!!diag.ready}>
                                    Conta pronta{diag.environment ? ` (${diag.environment})` : ""}
                                    {diag.missing?.length ? <> — falta: <b>{diag.missing.join(", ")}</b></> : null}
                                </Row>
                                <Row ok={!!diag.scopes?.includes("payments:write")}>Permissões da chave: {diag.scopes?.join(", ") || "—"}</Row>
                                {Object.entries(diag.wallets || {}).map(([m, list]) => (
                                    <Row key={m} ok={list.length > 0}>
                                        Carteira {m}: {list.length ? list.map((w) => `${w.wallet_code} (${w.name})`).join(", ") : "nenhuma activa"}
                                    </Row>
                                ))}
                                <Row ok={!!diag.webhook?.is_active && diag.webhook?.url === expectedHook}>
                                    Webhook: {diag.webhook ? <>{diag.webhook.url} {diag.webhook.is_active ? "(activo)" : "(inactivo)"}</> : "não configurado"}
                                    {diag.webhook && diag.webhook.url !== expectedHook && <> — devia ser <b>{expectedHook}</b></>}
                                </Row>
                            </>
                        )}
                    </ul>
                )}

                {events && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Últimos webhooks recebidos ({events.length})</h3>
                        {events.length === 0 && <p className="text-sm text-muted-foreground">Ainda nenhum. Faça um pagamento de teste e volte a verificar.</p>}
                        {events.map((e) => (
                            <details key={e.id} className="rounded-lg border p-2 text-sm">
                                <summary className="cursor-pointer">
                                    {new Date(e.receivedAt).toLocaleString("pt-PT")} · <b>{e.event || "(sem nome)"}</b> · {e.error ? <span className="text-red-600">erro</span> : e.matched ? <span className="text-emerald-600">{String((e.outcome as any)?.ok === false ? (e.outcome as any)?.reason : "tratado")}</span> : <span className="text-muted-foreground">não é nosso</span>}
                                </summary>
                                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">{e.error || e.payload}</pre>
                            </details>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
