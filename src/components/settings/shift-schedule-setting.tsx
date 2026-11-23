"use client";

import { useContext, useEffect, useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InventoryContext } from "@/context/inventory-context";
import { authedFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { MAX_SHIFT_SLOTS, sanitizeSchedule, type ShiftSlot } from "@/lib/shift-schedule";

/** Definições → Empresa: os turnos do hotel (ex.: Manhã 07:00–17:00, Noite 17:00–07:00). Cada hotel define os seus. */
export function ShiftScheduleSetting() {
    const ctx = useContext(InventoryContext);
    const { toast } = useToast();
    const companyId = ctx?.companyId;
    const saved = sanitizeSchedule((ctx?.companyData as { shiftSchedule?: unknown } | null | undefined)?.shiftSchedule);
    const savedKey = JSON.stringify(saved);
    const canEdit = ctx?.user?.role === "Admin" || ctx?.user?.role === "Dono";
    const [slots, setSlots] = useState<ShiftSlot[]>([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => { setSlots(JSON.parse(savedKey)); }, [savedKey]);

    if (!ctx || ctx.isGuest || !companyId || !canEdit) return null;

    const change = (i: number, patch: Partial<ShiftSlot>) => setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    const dirty = JSON.stringify(slots) !== savedKey;

    const save = async () => {
        try {
            setBusy(true);
            await authedFetch("/api/company-shifts", "POST", { companyId, schedule: slots });
            toast({ title: "Turnos guardados", description: slots.length ? `${slots.length} turno${slots.length === 1 ? "" : "s"} definido${slots.length === 1 ? "" : "s"}.` : "Sem turnos definidos." });
        } catch (e) {
            toast({ variant: "destructive", title: "Não foi possível guardar", description: e instanceof Error ? e.message : undefined });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card className="glass-card mt-4">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Turnos do hotel</CardTitle>
                <CardDescription>
                    As horas a que os turnos de caixa começam e acabam (ex.: 07:00–17:00, ou 07:00–07:00). Servem para lembrar de abrir o turno e avisar quando um turno passa da hora de fecho. Deixe vazio para não usar.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {slots.map((s, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                        <Input value={s.name} onChange={(e) => change(i, { name: e.target.value })} placeholder="Nome (ex.: Noite)" maxLength={30} aria-label="Nome do turno" />
                        <Input type="time" value={s.start} onChange={(e) => change(i, { start: e.target.value })} className="w-[110px]" aria-label="Início" />
                        <Input type="time" value={s.end} onChange={(e) => change(i, { end: e.target.value })} className="w-[110px]" aria-label="Fim" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))} aria-label="Remover turno"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                ))}
                {slots.length === 0 && <p className="text-sm text-muted-foreground">Nenhum turno definido.</p>}
                <div className="flex flex-wrap justify-between gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={slots.length >= MAX_SHIFT_SLOTS} onClick={() => setSlots((prev) => [...prev, { name: "", start: "07:00", end: "17:00" }])}>
                        <Plus className="mr-1 h-4 w-4" /> Adicionar turno
                    </Button>
                    <Button type="button" onClick={save} disabled={busy || !dirty}>{busy ? "A guardar..." : "Guardar turnos"}</Button>
                </div>
            </CardContent>
        </Card>
    );
}
