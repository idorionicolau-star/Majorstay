"use client";

import { useContext, useState } from "react";
import { AlertTriangle, CalendarCheck, Loader2, Rocket } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Count = { id: string; label: string; count: number; examples?: string[] };

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

async function call(body: Record<string, unknown>) {
    const { getAuth } = await import("firebase/auth");
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) throw new Error("Sessão expirada. Entre de novo.");
    const res = await fetch("/api/reset-before-today", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
    return json;
}

/**
 * Arranque oficial do programa: apaga, uma só vez, tudo o que foi registado antes de hoje
 * (vendas, movimentos, produção, encomendas, despesas, notificações e, se escolhido, os produtos).
 */
export function StartFresh() {
    const inv = useContext(InventoryContext);
    const { toast } = useToast();
    const [includeProducts, setIncludeProducts] = useState(true);
    const [preview, setPreview] = useState<{ counts: Count[]; keptProducts?: number } | null>(null);
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState<"" | "preview" | "run">("");
    const [progress, setProgress] = useState("");

    if (!inv) return null;
    const { user, companyId, companyData, confirmAction } = inv;
    if (user?.role !== "Admin" && user?.role !== "Dono") return null;

    const cutoff = startOfToday();
    const todayLabel = cutoff.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });

    if (companyData?.dataResetAt) {
        return (
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-emerald-600" /> Arranque oficial feito</CardTitle>
                    <CardDescription>
                        Os registos anteriores foram apagados em {new Date(companyData.dataResetAt).toLocaleString("pt-PT")}. Isto só se faz uma vez.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const loadPreview = async (withProducts = includeProducts) => {
        setBusy("preview");
        try {
            setPreview(await call({ companyId, cutoff: cutoff.toISOString(), mode: "preview", includeProducts: withProducts }));
        } catch (e: any) {
            toast({ variant: "destructive", title: "Não foi possível ver os dados", description: e.message });
        } finally {
            setBusy("");
        }
    };

    const total = preview?.counts.reduce((t, c) => t + c.count, 0) || 0;

    const run = async () => {
        setBusy("run");
        try {
            // 1. cópia de segurança de tudo o que vai ser apagado
            setProgress("A descarregar a cópia de segurança…");
            const { backup } = await call({ companyId, cutoff: cutoff.toISOString(), mode: "backup", includeProducts });
            const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `copia-antes-do-arranque-${cutoff.toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);

            // 2. apaga por partes até acabar
            let done = 0;
            for (let i = 0; i < 100; i++) {
                setProgress(`A apagar… ${done} de ${total}`);
                const r = await call({ companyId, cutoff: cutoff.toISOString(), mode: "delete", includeProducts });
                done += Object.values(r.deleted as Record<string, number>).reduce((t, n) => t + n, 0);
                if (!r.more) break;
            }

            // o servidor acerta o stock reservado no fim (só as vendas que ficaram)
            toast({ title: "Arranque feito", description: `${done} registos anteriores a hoje foram apagados. A cópia ficou nas transferências.` });
            setPreview(null);
            setTyped("");
        } catch (e: any) {
            toast({ variant: "destructive", title: "A limpeza parou a meio", description: `${e.message} — pode carregar outra vez para continuar.` });
        } finally {
            setBusy("");
            setProgress("");
        }
    };

    const ask = () => confirmAction(run, "Apagar registos anteriores a hoje",
        `Vai apagar ${total} registos criados antes de ${todayLabel}. Não se pode desfazer. Confirme com a sua palavra-passe.`);

    return (
        <Card className="glass-card border-destructive/40">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" /> Arranque oficial — começar a partir de hoje</CardTitle>
                <CardDescription>
                    Apaga, uma só vez, tudo o que foi registado <b>antes de {todayLabel}</b>: vendas, movimentos de stock, produção,
                    encomendas, despesas e notificações. Fica tudo o que foi registado hoje. Clientes, catálogo, funcionários e
                    definições ficam sempre.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <label className="flex items-start gap-3 rounded-xl border p-3">
                    <Checkbox checked={includeProducts} onCheckedChange={(v) => { setIncludeProducts(!!v); setPreview(null); }} className="mt-0.5" />
                    <span className="text-sm">
                        <b>Apagar também os produtos registados antes de hoje</b> (com o stock e as reservas deles).
                        <span className="block text-muted-foreground">Ficam só os produtos criados hoje. Um produto antigo em que só mexeu hoje também sai.</span>
                    </span>
                </label>

                {!preview ? (
                    <Button variant="outline" onClick={() => loadPreview()} disabled={!!busy}>
                        {busy === "preview" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Ver o que vai ser apagado
                    </Button>
                ) : (
                    <div className="space-y-3">
                        <ul className="divide-y rounded-xl border text-sm">
                            {preview.counts.map((c) => (
                                <li key={c.id} className="flex items-start justify-between gap-3 px-3 py-2">
                                    <span>
                                        {c.label}
                                        {c.examples && c.examples.length > 0 && <span className="block text-xs text-muted-foreground">Ex.: {c.examples.join(", ")}</span>}
                                    </span>
                                    <b className="tabular-nums">{c.count}</b>
                                </li>
                            ))}
                        </ul>
                        {includeProducts && preview.keptProducts !== undefined && (
                            <p className={preview.keptProducts === 0 ? "flex items-center gap-1.5 text-sm font-semibold text-red-600" : "text-sm text-muted-foreground"}>
                                {preview.keptProducts === 0 && <AlertTriangle className="h-4 w-4" />}
                                {preview.keptProducts === 0
                                    ? "Não fica nenhum produto: terá de registar os produtos e o stock de novo."
                                    : `Ficam ${preview.keptProducts} produtos registados hoje.`}
                            </p>
                        )}
                        {total === 0 ? (
                            <p className="text-sm text-emerald-600">Não há nada anterior a hoje para apagar.</p>
                        ) : (
                            <>
                                <p className="text-sm">Antes de apagar, o programa descarrega uma cópia de segurança com tudo o que sai. Escreva <b>APAGAR</b> para confirmar:</p>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="APAGAR" className="sm:max-w-40" autoCapitalize="characters" />
                                    <Button variant="destructive" onClick={ask} disabled={!!busy || typed.trim().toUpperCase() !== "APAGAR"}>
                                        {busy === "run" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Apagar {total} registos anteriores a hoje
                                    </Button>
                                </div>
                                {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
                            </>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
