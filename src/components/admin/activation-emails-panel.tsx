"use client";

import { useState } from "react";
import { getAuth } from "firebase/auth";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Item = { companyId: string; name: string; sent: boolean; reason?: string; to?: string[] };

async function call(dry: boolean) {
    const token = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/admin/activation-emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dry }),
    });
    return { ok: r.ok, json: await r.json().catch(() => ({})) };
}

/** Super-administrador: confirmação de subscrição ativada às empresas ativadas hoje (uma só vez cada). */
export function ActivationEmailsPanel() {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<Item[] | null>(null);

    const run = async () => {
        setBusy(true);
        setDone(null);
        const preview = await call(true);
        if (!preview.ok) { setBusy(false); toast({ variant: "destructive", title: "Erro", description: preview.json.error || "" }); return; }
        const items: Item[] = preview.json.results || [];
        const ready = items.filter((i) => i.reason === "dry" && i.to?.length);
        if (!ready.length) {
            setBusy(false);
            toast({ title: "Nada para enviar", description: "Nenhuma empresa ativada hoje está à espera de confirmação." });
            return;
        }
        const ok = window.confirm(`Enviar a confirmação de subscrição a:\n\n${ready.map((i) => `${i.name} → ${i.to!.join(", ")}`).join("\n")}`);
        if (!ok) { setBusy(false); return; }
        const r = await call(false);
        setBusy(false);
        if (!r.ok) { toast({ variant: "destructive", title: "Erro ao enviar", description: r.json.error || "" }); return; }
        setDone(r.json.results || []);
        toast({ title: `${r.json.sent} email${r.json.sent === 1 ? "" : "s"} enviado${r.json.sent === 1 ? "" : "s"}` });
    };

    return (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><MailCheck className="h-4 w-4" /> Confirmação de subscrição</CardTitle>
                <CardDescription>
                    Cada empresa recebe 1 email quando a subscrição é ativada (automático daqui para a frente). Este botão envia agora às que foram ativadas hoje e ainda não receberam.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <Button onClick={run} disabled={busy} variant="outline">
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
                    Enviar aos ativados hoje
                </Button>
                {done && (
                    <ul className="text-sm">
                        {done.map((i) => (
                            <li key={i.companyId}>{i.name}: {i.sent ? `enviado para ${i.to?.join(", ")}` : `não enviado (${i.reason})`}</li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
