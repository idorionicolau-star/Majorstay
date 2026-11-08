"use client";

import { useState } from "react";
import { FlaskConical, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInventory } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { checkNewMaterial, type MaterialLine } from "@/lib/production-core";
import type { RawMaterial } from "@/lib/types";

/** Linha em edição: a quantidade fica como texto enquanto se escreve ("2," a meio de "2,5"). */
export type MaterialDraft = { rawMaterialId: string; name: string; qty: string; unit?: string };

export const toDrafts = (lines: MaterialLine[]): MaterialDraft[] => lines.map((l) => ({ rawMaterialId: l.rawMaterialId, name: l.name, unit: l.unit, qty: String(l.quantity) }));
export const fromDrafts = (drafts: MaterialDraft[]): MaterialLine[] =>
    drafts.map((d) => ({ rawMaterialId: d.rawMaterialId, name: d.name, unit: d.unit, quantity: Number(String(d.qty).replace(",", ".")) || 0 }));

/**
 * A matéria-prima gasta numa produção (sacos de cimento, areia, tinta…): vem da receita e pode ser corrigida,
 * acrescentada ou tirada. O stock de matéria-prima desconta exactamente o que ficar aqui.
 */
export function MaterialsEditor({ value, onChange, rawMaterials, recipe, onUseRecipe }: {
    value: MaterialDraft[];
    onChange: (v: MaterialDraft[]) => void;
    rawMaterials: RawMaterial[];
    /** a lista que a receita daria (para o botão "Usar a receita") */
    recipe?: MaterialLine[];
    onUseRecipe?: () => void;
}) {
    const inv = useInventory();
    const { toast } = useToast();
    // matéria-prima que ainda não existe: cria-se aqui mesmo (com o que há em stock), sem sair da produção
    const canCreate = !!inv?.canEdit?.("raw-materials") && !inv?.isReadOnly;
    const units = inv?.availableUnits?.length ? inv.availableUnits : ["un"];
    const defaultUnit = units.includes("un") ? "un" : units[0] || "un";
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ name: "", unit: defaultUnit, stock: "" });
    const [formError, setFormError] = useState("");
    const [busy, setBusy] = useState(false);
    const used = new Set(value.map((v) => v.rawMaterialId));
    const free = rawMaterials.filter((r) => !used.has(r.id)).sort((a, b) => a.name.localeCompare(b.name, "pt"));
    const stockOf = (id: string) => rawMaterials.find((r) => r.id === id);
    const set = (i: number, patch: Partial<MaterialDraft>) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));
    const join = (line: MaterialDraft) => onChange(value.some((v) => v.rawMaterialId === line.rawMaterialId) ? value : [...value, line]);
    const openForm = () => { setForm({ name: "", unit: defaultUnit, stock: "" }); setFormError(""); setCreating(true); };

    const createAndJoin = async () => {
        if (busy) return;
        const c = checkNewMaterial(form, rawMaterials);
        if (c.kind === "error") { setFormError(c.error); return; }
        if (c.kind === "existing") {
            const r = rawMaterials.find((x) => x.id === c.id);
            join({ rawMaterialId: c.id, name: c.name, unit: r?.unit, qty: "1" });
            toast({ title: `"${c.name}" já existia`, description: "Foi junta à produção." });
            setCreating(false);
            return;
        }
        setBusy(true);
        try {
            const id = await inv.createRawMaterial({ name: c.value.name, unit: c.value.unit, stock: c.value.stock, lowStockThreshold: 0 });
            join({ rawMaterialId: id, name: c.value.name, unit: c.value.unit, qty: "1" });
            toast({ title: "Matéria-prima criada", description: `${c.value.name}: ${c.value.stock} ${c.value.unit} em stock. Ajuste quanto foi gasto.` });
            setCreating(false);
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Não foi possível criar. Tente de novo.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-2" data-tour="prod-materials">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><FlaskConical className="h-3.5 w-3.5" /> Matéria-prima usada</p>
                {onUseRecipe && recipe && recipe.length > 0 && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onUseRecipe}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Usar a receita</Button>
                )}
            </div>
            {value.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma — o stock de matéria-prima não mexe.</p>}
            {value.map((m, i) => {
                const r = stockOf(m.rawMaterialId);
                return (
                    <div key={m.rawMaterialId} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{m.name}</p>
                            {r && <p className="text-[11px] text-muted-foreground">Em stock: {r.stock} {r.unit}</p>}
                            {r && Number(String(m.qty).replace(",", ".")) > r.stock && (
                                <p className="text-[11px] font-semibold text-red-600">Falta {Math.round((Number(String(m.qty).replace(",", ".")) - r.stock) * 1000) / 1000} {r.unit} — dê entrada antes ou corrija.</p>
                            )}
                        </div>
                        <Input inputMode="decimal" value={m.qty} onChange={(e) => set(i, { qty: e.target.value })} onFocus={(e) => e.target.select()}
                            aria-label={`Quantidade de ${m.name}`} className="h-9 w-20 text-center" />
                        <span className="w-12 truncate text-xs text-muted-foreground">{m.unit || r?.unit || ""}</span>
                        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Tirar ${m.name}`}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                );
            })}
            {(free.length > 0 || canCreate) && !creating && (
                <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <select aria-label="Juntar matéria-prima" value="" className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                        onChange={(e) => {
                            if (e.target.value === "__new__") { openForm(); return; }
                            const r = rawMaterials.find((x) => x.id === e.target.value);
                            if (r) join({ rawMaterialId: r.id, name: r.name, unit: r.unit, qty: "1" });
                        }}>
                        <option value="">Juntar matéria-prima…</option>
                        {free.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.stock} {r.unit})</option>)}
                        {canCreate && <option value="__new__">＋ Nova matéria-prima (não está na lista)</option>}
                    </select>
                </div>
            )}
            {canCreate && !creating && (
                <button type="button" onClick={openForm} className="text-xs font-medium text-primary underline-offset-4 hover:underline" data-tour="prod-material-new">
                    + Falta alguma? Criar nova matéria-prima
                </button>
            )}
            {creating && (
                <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3" data-tour="prod-material-form">
                    <p className="text-sm font-semibold">Nova matéria-prima</p>
                    <Input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome (ex.: Areia grossa, Saco de cimento)" aria-label="Nome da nova matéria-prima" />
                    <div className="flex gap-2">
                        <Input inputMode="decimal" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} placeholder="Em stock agora" aria-label="Quanto há em stock agora" className="min-w-0 flex-1" />
                        <select aria-label="Unidade" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className="h-10 w-28 shrink-0 rounded-md border bg-background px-2 text-sm">
                            {units.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Quanto há no armazém <b>antes</b> desta produção — a produção desconta daqui o que for gasto.</p>
                    {formError && <p className="text-xs text-red-600">{formError}</p>}
                    <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)} disabled={busy}>Cancelar</Button>
                        <Button type="button" size="sm" onClick={createAndJoin} disabled={busy}>
                            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Criar e juntar
                        </Button>
                    </div>
                </div>
            )}
            {rawMaterials.length === 0 && !canCreate && <p className="text-xs text-muted-foreground">Ainda não há matéria-prima registada. Peça a quem gere a Matéria-Prima para a registar.</p>}
            {rawMaterials.length > 0 && !canCreate && <p className="text-[11px] text-muted-foreground">Falta alguma na lista? Peça a quem gere a Matéria-Prima para a registar.</p>}
        </div>
    );
}
