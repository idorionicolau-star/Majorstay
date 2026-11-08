"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { Check, ChevronDown, Copy, Handshake, Loader2, MessageCircle, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_COMMISSION_MONTHS, DEFAULT_COMMISSION_PCT, suggestCode, type Affiliate } from "@/lib/affiliate-core";
import { cn, formatCurrency } from "@/lib/utils";

type Row = Affiliate & {
    link: string;
    companies: { id: string; name: string; status: string; linkedAt: string; paying: boolean; paidTotal: number; commission: number; thisMonth: number; endsAt: string | null }[];
    totals: { companies: number; paying: number; paidTotal: number; commission: number; thisMonth: number };
};

async function call(method: "GET" | "POST" | "PATCH", body?: unknown) {
    const token = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/admin/affiliates", {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { ok: r.ok, json: await r.json().catch(() => ({})) };
}

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-PT") : "—");
/** "84 123 4567" → "258841234567" (para o wa.me). */
const waNumber = (phone: string) => { const d = phone.replace(/\D/g, ""); return d.length === 9 ? `258${d}` : d; };

/** Super-administrador: afiliados — quem são, o link de cada um, as empresas que trouxeram e a comissão a pagar. */
export function AffiliatesPanel() {
    const { toast } = useToast();
    const [rows, setRows] = useState<Row[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState<string | null>(null);
    const empty = { name: "", phone: "", code: "", clientPrice: "", clientMonths: "3", commissionPct: String(DEFAULT_COMMISSION_PCT), commissionMonths: String(DEFAULT_COMMISSION_MONTHS) };
    const [form, setForm] = useState(empty);
    const [codeTouched, setCodeTouched] = useState(false);
    const taken = useMemo(() => new Set((rows || []).map((r) => r.code)), [rows]);

    const load = useCallback(async () => {
        setLoading(true);
        const r = await call("GET");
        setLoading(false);
        if (r.ok) setRows(r.json.affiliates || []);
        else toast({ variant: "destructive", title: "Não foi possível ler os afiliados", description: r.json.error || "" });
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    const setName = (name: string) => setForm((f) => ({ ...f, name, code: codeTouched ? f.code : (name.trim().length >= 2 ? suggestCode(name, taken) : "") }));

    const create = async () => {
        setBusy(true);
        const r = await call("POST", form);
        setBusy(false);
        if (!r.ok) { toast({ variant: "destructive", title: "Afiliado não criado", description: r.json.error || "" }); return; }
        toast({ title: `Afiliado ${r.json.affiliate.name} criado`, description: `Código ${r.json.affiliate.code}. Envie-lhe o link.` });
        setForm(empty); setCodeTouched(false); setAdding(false);
        load();
    };

    const toggle = async (a: Row) => {
        const r = await call("PATCH", { code: a.code, active: !a.active });
        if (r.ok) load(); else toast({ variant: "destructive", title: "Não foi possível mudar", description: r.json.error || "" });
    };

    const copy = async (text: string) => {
        try { await navigator.clipboard.writeText(text); toast({ title: "Link copiado" }); } catch { toast({ title: "Copie à mão", description: text }); }
    };
    const waText = (a: Row) => `Olá ${a.name.split(" ")[0]}! Este é o seu link de afiliado da MajorStockX: ${a.link}\nO seu código: ${a.code}. Ganha ${a.commissionPct}% do que cada cliente pagar durante ${a.commissionMonths} meses.`;

    const field = (key: keyof typeof form, label: string, extra?: Partial<React.ComponentProps<typeof Input>>) => (
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>{label}</span>
            <Input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} {...extra} />
        </label>
    );

    return (
        <Card data-tour="affiliates-panel">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div>
                    <CardTitle className="flex items-center gap-2"><Handshake className="h-5 w-5 text-primary" /> Afiliados</CardTitle>
                    <CardDescription>Cada afiliado tem um código e um link. As empresas que entram por ele ficam ligadas, e recebe um email.</CardDescription>
                </div>
                <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={load} disabled={loading} aria-label="Actualizar"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
                    {!adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" /> Novo</Button>}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {adding && (
                    <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3" data-tour="affiliate-form">
                        <div className="grid gap-2 sm:grid-cols-3">
                            <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>Nome</span>
                                <Input autoFocus value={form.name} onChange={(e) => setName(e.target.value)} placeholder="Nome do afiliado" aria-label="Nome do afiliado" /></label>
                            {field("phone", "Telefone", { inputMode: "tel", placeholder: "84 123 4567", "aria-label": "Telefone do afiliado" })}
                            <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>Código</span>
                                <Input value={form.code} onChange={(e) => { setCodeTouched(true); setForm((f) => ({ ...f, code: e.target.value.toUpperCase() })); }} aria-label="Código do afiliado" className="font-mono" /></label>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {field("commissionPct", "Comissão (%)", { inputMode: "decimal", "aria-label": "Comissão em percentagem" })}
                            {field("commissionMonths", "Durante (meses)", { inputMode: "numeric", "aria-label": "Meses de comissão" })}
                            {field("clientPrice", "Desconto: MT/mês (opcional)", { inputMode: "decimal", placeholder: "sem desconto", "aria-label": "Preço com desconto para o cliente" })}
                            {field("clientMonths", "Meses com desconto", { inputMode: "numeric", disabled: !form.clientPrice, "aria-label": "Meses com desconto" })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">A comissão conta a partir do 1.º pagamento de cada cliente, sobre o que ele pagar de facto. Sem desconto, o cliente paga o preço normal.</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setForm(empty); setCodeTouched(false); }} disabled={busy}>Cancelar</Button>
                            <Button size="sm" onClick={create} disabled={busy}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Criar afiliado</Button>
                        </div>
                    </div>
                )}

                {rows === null ? <p className="text-sm text-muted-foreground">A carregar…</p> : rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ainda não há afiliados. Toque em <b>Novo</b> para criar o primeiro.</p>
                ) : rows.map((a) => (
                    <div key={a.code} className={cn("rounded-xl border p-3", !a.active && "opacity-60")} data-tour="affiliate-row">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="font-semibold">{a.name} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{a.code}</span>{!a.active && <span className="ml-1 text-xs text-red-600">desactivado</span>}</p>
                                <p className="text-xs text-muted-foreground"><a href={`tel:${a.phone}`} className="underline">{a.phone}</a> · {a.commissionPct}% durante {a.commissionMonths} meses{a.clientPrice ? ` · cliente paga ${formatCurrency(a.clientPrice)}/mês nos ${a.clientMonths} primeiros meses` : ""}</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <Button size="sm" variant="outline" onClick={() => copy(a.link)}><Copy className="mr-1 h-3.5 w-3.5" /> Link</Button>
                                <Button size="sm" variant="outline" asChild><a href={`https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(waText(a))}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp</a></Button>
                                <Button size="sm" variant="ghost" onClick={() => toggle(a)}>{a.active ? "Desactivar" : "Activar"}</Button>
                            </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4" data-tour="affiliate-totals">
                            <div className="rounded-lg bg-muted/50 p-2"><p className="text-lg font-bold">{a.totals.companies}</p><p className="text-[11px] text-muted-foreground">empresas</p></div>
                            <div className="rounded-lg bg-muted/50 p-2"><p className="text-lg font-bold text-emerald-600">{a.totals.paying}</p><p className="text-[11px] text-muted-foreground">a pagar</p></div>
                            <div className="rounded-lg bg-muted/50 p-2"><p className="text-lg font-bold">{formatCurrency(a.totals.thisMonth)}</p><p className="text-[11px] text-muted-foreground">comissão deste mês</p></div>
                            <div className="rounded-lg bg-muted/50 p-2"><p className="text-lg font-bold">{formatCurrency(a.totals.commission)}</p><p className="text-[11px] text-muted-foreground">comissão total</p></div>
                        </div>
                        {a.companies.length > 0 && (
                            <>
                                <button type="button" onClick={() => setOpen(open === a.code ? null : a.code)} className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
                                    <ChevronDown className={cn("h-3.5 w-3.5 transition", open === a.code && "rotate-180")} /> Ver empresas
                                </button>
                                {open === a.code && (
                                    <ul className="mt-1 divide-y rounded-lg border text-sm">
                                        {a.companies.map((c) => (
                                            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                                <span className="min-w-0">
                                                    <b>{c.name}</b>
                                                    <span className="block text-xs text-muted-foreground">entrou {fmtDate(c.linkedAt)}{c.endsAt ? ` · comissão até ${fmtDate(c.endsAt)}` : " · ainda não pagou"}</span>
                                                </span>
                                                <span className="text-right text-xs">
                                                    {c.paying ? <span className="font-semibold text-emerald-600"><Check className="inline h-3.5 w-3.5" /> a pagar</span> : <span className="text-muted-foreground">{c.status || "—"}</span>}
                                                    <span className="block">pagou {formatCurrency(c.paidTotal)} → {formatCurrency(c.commission)}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
