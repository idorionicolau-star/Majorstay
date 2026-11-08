"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ESCALEPAY_REGISTER_PATH, extractEmails } from "@/lib/escalepay-core";
import { cn } from "@/lib/utils";

type Sale = { id: string; email: string; months: number; source: string; createdAt: string; claimedBy: string | null; companyName: string | null; until: string | null };
type Result = { email: string; status: "activated" | "pending" | "duplicate" | "invalid"; companyName?: string; until?: string };

const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }) : "");

async function call(path: string, body?: unknown) {
    const token = await getAuth().currentUser?.getIdToken();
    const r = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { ok: r.ok, json: await r.json().catch(() => ({})) };
}

const STATUS: Record<Result["status"], { label: string; cls: string }> = {
    activated: { label: "Activada", cls: "text-emerald-600" },
    pending: { label: "À espera do registo", cls: "text-sky-600" },
    duplicate: { label: "Já registada hoje", cls: "text-muted-foreground" },
    invalid: { label: "Email inválido", cls: "text-red-600" },
};

/**
 * Super-administrador: vendas da EscalePay. Cola-se a lista de compradores (ou o texto dos emails de venda);
 * cada email activa a empresa do seu administrador por N meses — já, se tiver conta; senão, quando se registar.
 */
export function EscalepayPanel({ ownEmail }: { ownEmail?: string }) {
    const { toast } = useToast();
    const [text, setText] = useState("");
    const [months, setMonths] = useState(1);
    const [off, setOff] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [results, setResults] = useState<Result[] | null>(null);
    const [sales, setSales] = useState<Sale[] | null>(null);
    const [copied, setCopied] = useState(false);

    const found = useMemo(() => extractEmails(text, ownEmail ? [ownEmail] : []), [text, ownEmail]);
    const chosen = found.filter((e) => !off.has(e));
    const link = typeof window !== "undefined" ? `${window.location.origin}${ESCALEPAY_REGISTER_PATH}` : ESCALEPAY_REGISTER_PATH;

    const load = useCallback(async () => {
        const r = await call("/api/escalepay/sale");
        if (r.ok) setSales(r.json.sales || []);
    }, []);
    useEffect(() => { load(); }, [load]);

    const activate = async () => {
        if (!chosen.length || busy) return;
        setBusy(true);
        const r = await call("/api/escalepay/sale", { emails: chosen, months });
        setBusy(false);
        if (!r.ok) { toast({ variant: "destructive", title: "Não foi possível registar", description: r.json.error || "Tente de novo." }); return; }
        const list: Result[] = r.json.results || [];
        setResults(list);
        setText("");
        setOff(new Set());
        const n = list.filter((x) => x.status === "activated").length;
        const w = list.filter((x) => x.status === "pending").length;
        toast({ title: "Vendas registadas", description: [n ? `${n} activada${n === 1 ? "" : "s"}` : "", w ? `${w} à espera do registo` : ""].filter(Boolean).join(" · ") || "Nada de novo." });
        load();
    };

    return (
        <Card data-tour="escalepay-panel">
            <CardHeader>
                <CardTitle>Vendas da EscalePay</CardTitle>
                <CardDescription>
                    Quem compra regista-se pelo link abaixo com o <b>mesmo email da compra</b> e pode usar logo a app (sem aviso de teste) até a compra ser confirmada.
                    Cole aqui a lista de compradores (ou o texto dos emails de venda): cada email activa a empresa — já, se tiver conta; senão, quando se registar.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                        {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />} {copied ? "Copiado" : "Copiar link"}
                    </Button>
                </div>

                <div className="space-y-2">
                    <Textarea aria-label="Compradores da EscalePay" rows={5} value={text} onChange={(e) => { setText(e.target.value); setResults(null); }}
                        placeholder={"Cole aqui os emails dos compradores, um por linha — ou o texto copiado do painel ou dos emails de venda.\nEx.: ana@gmail.com\njoao@hotmail.com"} />
                    {found.length > 0 && (
                        <>
                            <p className="text-xs text-muted-foreground">Encontrados {found.length}. Toque para tirar algum.</p>
                            <div className="flex flex-wrap gap-1.5">
                                {found.map((e) => (
                                    <button key={e} type="button" onClick={() => setOff((s) => { const n = new Set(s); if (n.has(e)) n.delete(e); else n.add(e); return n; })}
                                        className={cn("rounded-full border px-2.5 py-1 text-xs", off.has(e) ? "text-muted-foreground line-through opacity-60" : "border-primary bg-primary/10 text-foreground")}>
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm">
                            Meses por compra
                            <select aria-label="Meses por compra" value={months} onChange={(e) => setMonths(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2">
                                {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </label>
                        <Button type="button" onClick={activate} disabled={!chosen.length || busy} className="ml-auto">
                            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Activar {chosen.length || ""} {chosen.length === 1 ? "compra" : "compras"}
                        </Button>
                    </div>
                </div>

                {results && (
                    <ul className="divide-y rounded-lg border text-sm" data-tour="escalepay-results">
                        {results.map((r) => (
                            <li key={r.email} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                <span className="min-w-0 truncate">{r.email}</span>
                                <span className={cn("text-xs font-medium", STATUS[r.status].cls)}>
                                    {STATUS[r.status].label}{r.companyName ? ` · ${r.companyName}` : ""}{r.until ? ` · até ${fmtDay(r.until)}` : ""}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Últimas vendas</h3>
                        <Button type="button" size="sm" variant="ghost" onClick={load}><RefreshCw className="mr-1 h-4 w-4" /> Actualizar</Button>
                    </div>
                    {sales === null ? <p className="text-sm text-muted-foreground">A carregar…</p>
                        : sales.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há vendas registadas.</p>
                            : (
                                <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border text-sm" data-tour="escalepay-sales">
                                    {sales.map((s) => (
                                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                            <span className="min-w-0">
                                                <span className="block truncate">{s.email}</span>
                                                <span className="text-xs text-muted-foreground">{fmtDay(s.createdAt)} · {s.months} {s.months === 1 ? "mês" : "meses"} · {s.source === "email" ? "pelo email de venda" : "colado no painel"}</span>
                                            </span>
                                            <span className={cn("text-xs font-medium", s.claimedBy ? "text-emerald-600" : "text-sky-600")}>
                                                {s.claimedBy ? `Activa · ${s.companyName || ""}${s.until ? ` · até ${fmtDay(s.until)}` : ""}` : "À espera do registo"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                </div>
            </CardContent>
        </Card>
    );
}
