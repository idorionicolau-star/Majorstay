"use client";

import { useContext, useEffect, useState } from "react";
import { InventoryContext } from "@/context/inventory-context";
import { getAuth } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ALLOWED_EMAILS = ["digitalwarriorguru@gmail.com", "idorionicolau@gmail.com"];

type Item = { id: string; message: string; stack?: string; context?: string; version?: string; source?: string; url?: string; email?: string | null; companyId?: string | null; userAgent?: string; createdAt: number | null };

export default function ErrorLogsPage() {
    const ctx = useContext(InventoryContext);
    const email = (ctx?.firebaseUser?.email || ctx?.user?.email || "").toLowerCase().trim();
    const authorized = ALLOWED_EMAILS.includes(email);
    const [items, setItems] = useState<Item[]>([]);
    const [state, setState] = useState<"loading" | "ok" | "error">("loading");

    const load = async () => {
        setState("loading");
        try {
            const token = await getAuth().currentUser?.getIdToken();
            const res = await fetch("/api/log-error", { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(String(res.status));
            setItems((await res.json()).items || []);
            setState("ok");
        } catch {
            setState("error");
        }
    };

    useEffect(() => { if (authorized) load(); }, [authorized]);

    if (!authorized) return <p className="p-6 text-muted-foreground">Sem acesso.</p>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Erros da aplicação</h1>
                    <p className="text-sm text-muted-foreground">Os últimos 100 erros que apareceram nos ecrãs dos utilizadores.</p>
                </div>
                <Button variant="outline" onClick={load} disabled={state === "loading"}>Actualizar</Button>
            </div>
            {state === "error" && <p className="text-destructive">Não foi possível carregar o registo.</p>}
            {state === "ok" && !items.length && <p className="text-muted-foreground">Sem erros registados. 🎉</p>}
            {items.map((i) => (
                <Card key={i.id}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base break-words">{i.message}</CardTitle>
                        <CardDescription>
                            {i.createdAt ? new Date(i.createdAt).toLocaleString("pt-PT") : "—"} · {i.source} · {i.url} · {i.email || "sem sessão"}{i.version ? ` · versão ${i.version}` : ""}
                        </CardDescription>
                    </CardHeader>
                    {i.stack && (
                        <CardContent>
                            <details><summary className="cursor-pointer text-xs">Detalhes</summary>
                                <pre className="mt-2 max-h-60 overflow-auto text-xs">{i.stack}</pre>
                                {/* o código à volta do erro (⟦ = o sítio exato): os textos dizem de que componente vem */}
                                {i.context && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">{i.context}</pre>}
                            </details>
                        </CardContent>
                    )}
                </Card>
            ))}
        </div>
    );
}
