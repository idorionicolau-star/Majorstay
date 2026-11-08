"use client";

import { haul } from "@/lib/haul";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, PackageCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useInventory } from "@/context/inventory-context";
import type { useShipments } from "@/hooks/use-shipments";
import { pendingFor, receiveResult, STATUS_LABEL, type Shipment } from "@/lib/shipments";
import { cn } from "@/lib/utils";

const fmt = (n: number) => (Number.isInteger(n) ? n : Number(n.toFixed(3))).toLocaleString("pt-PT");
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

type Sh = ReturnType<typeof useShipments>;

/** Um envio para confirmar: a quantidade que chegou de cada produto (por defeito, tudo) e uma nota. */
function ReceiveCard({ s, sh, onCancel }: { s: Shipment; sh: Sh; onCancel?: () => void }) {
    const { toast } = useToast();
    const [got, setGot] = useState<Record<string, string>>({});
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const parsed = useMemo(() => Object.fromEntries(s.items.map((i) => [i.name, got[i.name] === undefined ? i.qty : Number(String(got[i.name]).replace(",", "."))])), [got, s.items]);
    const preview = receiveResult(s.items, parsed);
    const confirm = async () => {
        setBusy(true);
        try {
            const r = await haul("transfer", "A confirmar a receção…", "Receção confirmada", () => sh.receive(s, parsed, note.trim() || undefined));
            toast({
                variant: r.missing.length ? "destructive" : undefined,
                title: r.missing.length ? `Recebido com diferença (${s.code})` : `Recebido (${s.code})`,
                description: r.missing.length ? `Faltaram ${r.missing.map((m) => `${fmt(m.qty)} ${m.unit} ${m.name}`).join(", ")}. A gestão foi avisada.` : `Entrou em ${sh.locName(s.to)}.`,
            });
        } catch (e) {
            toast({ variant: "destructive", title: "Não foi possível confirmar", description: e instanceof Error ? e.message : "Erro" });
        } finally { setBusy(false); }
    };
    return (
        <li className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3" data-testid="receive-card">
            <p className="text-sm font-semibold">{s.code} · {sh.locName(s.from)} <ArrowRight className="inline h-3.5 w-3.5" /> {sh.locName(s.to)}</p>
            <p className="text-xs text-muted-foreground">Enviado por {s.sentByName} · {when(s.sentAt)}{s.note ? ` · “${s.note}”` : ""}</p>
            <ul className="mt-2 space-y-1.5">
                {s.items.map((i) => (
                    <li key={i.name} className="flex items-center gap-2 rounded-xl bg-background px-3 py-2">
                        <span className="min-w-0 flex-1 text-sm"><b>{i.name}</b> <span className="text-muted-foreground">· enviados {fmt(i.qty)} {i.unit}</span></span>
                        <span className="text-xs text-muted-foreground">chegou</span>
                        <Input inputMode="decimal" value={got[i.name] ?? String(i.qty)} onChange={(e) => setGot((g) => ({ ...g, [i.name]: e.target.value }))} onFocus={(e) => e.target.select()}
                            aria-label={`Recebido de ${i.name}`} className="h-9 w-20 text-center" />
                    </li>
                ))}
            </ul>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional): ex.: 2 partidas no camião" className="mt-2 h-10" />
            {preview.missing.length > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" />Falta: {preview.missing.map((m) => `${fmt(m.qty)} ${m.unit} ${m.name}`).join(", ")}</p>
            )}
            <Button onClick={confirm} disabled={busy} className="mt-2 h-11 w-full" data-testid="confirm-receive">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}Confirmar receção
            </Button>
            {onCancel && (
                <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy} className="mt-1 w-full text-muted-foreground">
                    <Undo2 className="mr-1.5 h-4 w-4" />Cancelar envio (volta à origem)
                </Button>
            )}
        </li>
    );
}

export function ShipmentsInbox({ sh }: { sh: Sh }) {
    const { user } = useInventory();
    const { toast } = useToast();
    const isManager = user?.role === "Admin";
    const toReceive = pendingFor(sh.shipments, sh.mine);
    // os que eu (ou o meu ponto) enviei e ainda ninguém confirmou: posso cancelar (volta à origem)
    const waiting = sh.shipments.filter((s) => s.status === "em_transito" && !sh.mine.has(s.to));
    const [busy, setBusy] = useState("");
    const cancel = async (s: Shipment) => {
        setBusy(s.id);
        try { await haul("transfer", "A cancelar o envio…", "Envio cancelado", () => sh.cancel(s)); toast({ title: `Envio ${s.code} cancelado`, description: `Voltou a ${sh.locName(s.from)}.` }); }
        catch (e) { toast({ variant: "destructive", title: "Não foi possível cancelar", description: e instanceof Error ? e.message : "Erro" }); }
        finally { setBusy(""); }
    };
    return (
        <div className="space-y-4">
            <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Para confirmar ({toReceive.length})</p>
                {toReceive.length === 0
                    ? <p className="rounded-2xl border p-4 text-sm text-muted-foreground">Nenhum envio à espera de confirmação aqui.</p>
                    : <ul className="space-y-3">{toReceive.map((s) => <ReceiveCard key={s.id} s={s} sh={sh} onCancel={isManager || s.sentBy === user?.id ? () => cancel(s) : undefined} />)}</ul>}
            </section>
            {waiting.length > 0 && (
                <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enviados, à espera do destino ({waiting.length})</p>
                    <ul className="space-y-2">
                        {waiting.map((s) => (
                            <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-2xl border p-3 text-sm">
                                <span className="min-w-0 flex-1"><b>{s.code}</b> · {sh.locName(s.from)} → {sh.locName(s.to)}<span className="block text-xs text-muted-foreground">{s.items.map((i) => `${fmt(i.qty)} ${i.unit} ${i.name}`).join(", ")} · {when(s.sentAt)}</span></span>
                                {(isManager || s.sentBy === user?.id) && (
                                    <Button size="sm" variant="outline" onClick={() => cancel(s)} disabled={busy === s.id}><Undo2 className="mr-1.5 h-4 w-4" />Cancelar envio</Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

/** Histórico dos envios, com as diferenças à vista (o que a gestora confere). */
export function ShipmentsHistory({ sh }: { sh: Sh }) {
    const [onlyDiff, setOnlyDiff] = useState(false);
    const list = sh.shipments.filter((s) => !onlyDiff || s.status === "com_diferenca");
    const diffs = sh.shipments.filter((s) => s.status === "com_diferenca").length;
    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <Button size="sm" variant={onlyDiff ? "outline" : "default"} onClick={() => setOnlyDiff(false)}>Todos ({sh.shipments.length})</Button>
                <Button size="sm" variant={onlyDiff ? "destructive" : "outline"} onClick={() => setOnlyDiff(true)} data-testid="only-diff">Com diferença ({diffs})</Button>
            </div>
            {list.length === 0 ? <p className="rounded-2xl border p-4 text-sm text-muted-foreground">Nada para mostrar.</p> : (
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                    {list.map((s) => (
                        <li key={s.id} className="px-4 py-3 text-sm" data-testid="shipment-row">
                            <div className="flex flex-wrap items-center gap-2">
                                <b>{s.code}</b>
                                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold",
                                    s.status === "recebido" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                        : s.status === "com_diferenca" ? "bg-red-500/15 text-red-700 dark:text-red-400"
                                            : s.status === "cancelado" ? "bg-muted text-muted-foreground" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
                                    {STATUS_LABEL[s.status]}
                                </span>
                                <span className="text-muted-foreground">{sh.locName(s.from)} → {sh.locName(s.to)}</span>
                            </div>
                            <ul className="mt-1 text-xs">
                                {s.items.map((i) => (
                                    <li key={i.name} className={cn(i.received !== undefined && i.received < i.qty && "font-semibold text-red-600")}>
                                        {i.name}: enviados {fmt(i.qty)} {i.unit}{i.received !== undefined ? ` · recebidos ${fmt(i.received)}` : ""}
                                        {i.received !== undefined && i.received < i.qty ? ` · faltam ${fmt(+(i.qty - i.received).toFixed(4))}` : ""}
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                                Enviou {s.sentByName} ({when(s.sentAt)}){s.receivedByName ? ` · ${s.status === "cancelado" ? "cancelou" : "recebeu"} ${s.receivedByName} (${when(s.receivedAt)})` : ""}
                                {s.note ? ` · “${s.note}”` : ""}{s.receiveNote ? ` · “${s.receiveNote}”` : ""}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
            {sh.shipments.length > 0 && <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Check className="h-3 w-3" />Cada envio tem quem enviou e quem recebeu: as faltas ficam com nome e data.</p>}
        </div>
    );
}
