"use client";

import { useContext, useEffect, useState } from "react";
import { Wifi } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InventoryContext } from "@/context/inventory-context";
import { authedFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

/** Definições → Empresa: nome e senha do Wi-Fi que o hóspede vê no QR do quarto (depois de pôr o PIN). */
export function WifiSetting() {
    const ctx = useContext(InventoryContext);
    const { toast } = useToast();
    const companyId = ctx?.companyId;
    const data = ctx?.companyData as { wifiSsid?: string; wifiPassword?: string } | null | undefined;
    const canEdit = ctx?.user?.role === "Admin" || ctx?.user?.role === "Dono";
    const [ssid, setSsid] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setSsid(data?.wifiSsid || "");
        setPassword(data?.wifiPassword || "");
    }, [data?.wifiSsid, data?.wifiPassword]);

    if (!ctx || ctx.isGuest || !companyId || !canEdit) return null;

    const save = async () => {
        try {
            setBusy(true);
            await authedFetch("/api/company-wifi", "POST", { companyId, wifiSsid: ssid, wifiPassword: password });
            toast({ title: "Wi-Fi guardado", description: ssid ? `Os hóspedes verão a rede "${ssid.trim()}" no QR.` : "O Wi-Fi deixou de aparecer no QR." });
        } catch (e) {
            toast({ variant: "destructive", title: "Não foi possível guardar", description: e instanceof Error ? e.message : undefined });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card className="glass-card mt-4">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wifi className="h-4 w-4" /> Wi-Fi do hotel</CardTitle>
                <CardDescription>O hóspede vê isto no QR do quarto, só depois de pôr o PIN. Deixe vazio para não mostrar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="wifiSsid">Nome da rede</Label>
                    <Input id="wifiSsid" value={ssid} onChange={(e) => setSsid(e.target.value)} maxLength={64} autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="wifiPassword">Senha</Label>
                    <Input id="wifiPassword" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={64} autoComplete="off" />
                </div>
                <div className="flex justify-end">
                    <Button type="button" onClick={save} disabled={busy}>{busy ? "A guardar..." : "Guardar Wi-Fi"}</Button>
                </div>
            </CardContent>
        </Card>
    );
}
