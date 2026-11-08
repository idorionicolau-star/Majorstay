"use client";

import { useContext, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Count = { id: string; label: string; count: number };

const call = (body: Record<string, unknown>) => authedFetch("/api/reset-company", "POST", body);

/**
 * Apagar tudo e recomeçar do zero: todos os registos da empresa (vendas, histórico, movimentos,
 * produtos, clientes, catálogo, produção, encomendas, despesas…) e, se escolhido, os funcionários.
 * Ao contrário da lixeira, isto apaga mesmo da base de dados.
 */
export function FullReset() {
    const inv = useContext(InventoryContext);
    const { toast } = useToast();
    const [includeEmployees, setIncludeEmployees] = useState(false);
    const [preview, setPreview] = useState<{ counts: Count[]; steps: string[] } | null>(null);
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState<"" | "preview" | "run">("");
    const [progress, setProgress] = useState("");

    if (!inv) return null;
    const { user, companyId, confirmAction } = inv;
    if (user?.role !== "Admin" && user?.role !== "Dono") return null;

    const total = preview?.counts.reduce((t, c) => t + c.count, 0) || 0;

    const loadPreview = async (withEmployees = includeEmployees) => {
        setBusy("preview");
        try {
            setPreview(await call({ companyId, mode: "preview", includeEmployees: withEmployees }));
        } catch (e: any) {
            toast({ variant: "destructive", title: "Não foi possível ver os dados", description: e.message });
        } finally {
            setBusy("");
        }
    };

    const run = async () => {
        if (!preview) return;
        setBusy("run");
        try {
            setProgress("A descarregar a cópia de segurança…");
            const { backup } = await call({ companyId, mode: "backup", includeEmployees });
            const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `copia-antes-de-apagar-tudo-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);

            let done = 0;
            for (const step of preview.steps) {
                const label = preview.counts.find((c) => c.id === step)?.label || step;
                setProgress(`A apagar ${label.toLowerCase()}…`);
                const r = await call({ companyId, mode: "delete", step, includeEmployees });
                done += r.deleted || 0;
            }

            toast({ title: "Tudo apagado", description: `${done} registos apagados. A cópia ficou nas transferências.` });
            // recarrega para limpar o que a app tinha guardado em memória
            setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
            toast({ variant: "destructive", title: "A limpeza parou a meio", description: `${e.message} — pode carregar outra vez para continuar.` });
        } finally {
            setBusy("");
            setProgress("");
        }
    };

    const ask = () => confirmAction(run, "Apagar TODOS os dados da empresa",
        `Vai apagar ${total} registos para sempre, sem lixeira. Confirme com a sua palavra-passe.`);

    return (
        <Card className="glass-card border-destructive/60">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /> Apagar todos os dados da empresa</CardTitle>
                <CardDescription>
                    Apaga de vez (não vai para a lixeira) vendas, histórico, movimentos de stock, produtos, clientes, catálogo, produção,
                    encomendas, despesas e matéria-prima, e volta a numeração das vendas a zero. Ficam a empresa, a subscrição e a sua conta.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <label className="flex items-start gap-3 rounded-xl border p-3">
                    <Checkbox checked={includeEmployees} onCheckedChange={(v) => { setIncludeEmployees(!!v); setPreview(null); }} className="mt-0.5" />
                    <span className="text-sm">
                        <b>Apagar também os funcionários</b> e as suas contas de acesso.
                        <span className="block text-muted-foreground">A sua conta e a do fundador da empresa ficam sempre.</span>
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
                                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                    <span>{c.label}</span>
                                    <b className="tabular-nums">{c.count}</b>
                                </li>
                            ))}
                        </ul>
                        <p className="text-sm">Antes de apagar, o programa descarrega uma cópia de segurança. Escreva <b>APAGAR TUDO</b> para confirmar:</p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="APAGAR TUDO" className="sm:max-w-48" autoCapitalize="characters" />
                            <Button variant="destructive" onClick={ask} disabled={!!busy || typed.trim().toUpperCase() !== "APAGAR TUDO"}>
                                {busy === "run" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Apagar tudo ({total} registos)
                            </Button>
                        </div>
                        {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
