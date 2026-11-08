"use client";

import { haul } from "@/lib/haul";
import { locationLabel } from '@/lib/sites';
import { useMemo, useState } from "react";
import { Edit, Loader2, Search } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useInventory } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { catalogChoices, recipeMaterials, todayMz, validProductionDate, yesterdayMz } from "@/lib/production-core";
import { findRecipe, productionMaterials } from "@/lib/production-materials";
import { isFamilyGroup, variantLabel } from "@/lib/variants";
import type { Production } from "@/lib/types";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/friendly-error";
import { fromDrafts, MaterialsEditor, toDrafts, type MaterialDraft } from "./materials-editor";

/**
 * Editar uma produção já registada: produto, quantidade, dia, local, notas e matéria-prima usada. Ao guardar, o
 * stock do produto e da matéria-prima acerta-se pela diferença (editProduction).
 */
export function ProductionEditor({ production }: { production: Production }) {
    const [open, setOpen] = useState(false);
    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={setOpen}
            title="Editar produção"
            description="Corrija o que for preciso. O stock do produto e da matéria-prima acerta-se pela diferença."
            trigger={
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" aria-label="Editar produção">
                    <Edit className="h-4 w-4" />
                </Button>
            }
        >
            {open && <EditorBody production={production} onDone={() => setOpen(false)} />}
        </ResponsiveDialog>
    );
}

function EditorBody({ production, onDone }: { production: Production; onDone: () => void }) {
    const { catalogProducts, recipes, rawMaterials, locations, isMultiLocation, editProduction } = useInventory();
    const { toast } = useToast();
    const fromOrder = !!production.orderId;
    const [name, setName] = useState(production.productName);
    const [unit, setUnit] = useState(production.unit || "un");
    const [qty, setQty] = useState(String(production.quantity));
    const [day, setDay] = useState((production.date || todayMz()).slice(0, 10));
    const [location, setLocation] = useState(production.location || locations?.[0]?.id || "");
    const [notes, setNotes] = useState(production.notes || "");
    const [materials, setMaterials] = useState<MaterialDraft[]>(() => toDrafts(productionMaterials(production, recipes, rawMaterials)));
    const [picking, setPicking] = useState(false);
    const [term, setTerm] = useState("");
    const [busy, setBusy] = useState(false);

    const n = Number(qty.replace(",", ".")) || 0;
    const recipeLines = useMemo(() => recipeMaterials(findRecipe(recipes, name), n, rawMaterials), [recipes, name, n, rawMaterials]);
    const choices = useMemo(() => catalogChoices(catalogProducts || [], term).slice(0, 12), [catalogProducts, term]);
    const dateOk = validProductionDate(day);

    const pick = (p: { name: string; unit?: string }) => {
        setName(p.name);
        setUnit(p.unit || "un");
        setPicking(false);
        setTerm("");
        // outro produto: a matéria-prima passa a ser a da receita dele
        setMaterials(toDrafts(recipeMaterials(findRecipe(recipes, p.name), n, rawMaterials)));
    };

    const save = async () => {
        if (busy || !(n > 0) || !dateOk) return;
        setBusy(true);
        try {
            await haul("production", "A guardar a produção…", "Produção guardada", () => editProduction(production.id, { productName: name, quantity: n, unit, date: day, location: isMultiLocation ? location : undefined, notes, materialsUsed: fromDrafts(materials) }));
            toast({ title: "Produção corrigida", description: "O stock do produto e da matéria-prima foram acertados." });
            onDone();
        } catch (e) {
            toast({ variant: "destructive", title: "Não foi possível guardar", description: friendlyError(e, "editar Produção, Inventário e Matéria-Prima") });
        } finally {
            setBusy(false);
        }
    };

    const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
        <button type="button" onClick={onClick} aria-pressed={active}
            className={cn("rounded-full border px-3 py-1 text-sm", active ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/60")}>{children}</button>
    );

    return (
        <div className="space-y-4 py-2" data-tour="prod-editor">
            <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produto</p>
                {!picking ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                        <span className="font-medium">{name}</span>
                        {fromOrder
                            ? <span className="text-xs text-muted-foreground">de uma encomenda</span>
                            : <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)}>Mudar</Button>}
                    </div>
                ) : (
                    <div className="space-y-2 rounded-lg border p-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Procurar no catálogo…" aria-label="Procurar produto" className="pl-9" />
                        </div>
                        <div className="max-h-56 space-y-1 overflow-y-auto">
                            {choices.map((c) => isFamilyGroup(c) ? (
                                <div key={c.key} className="px-1 py-1">
                                    <p className="text-sm font-medium">{c.group}</p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {c.members.map((m) => <Chip key={m.name} active={m.name === name} onClick={() => pick(m)}>{variantLabel(m)}</Chip>)}
                                    </div>
                                </div>
                            ) : (
                                <button key={c.name} type="button" onClick={() => pick(c)} className={cn("block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted", c.name === name && "bg-primary/10 font-medium")}>{c.name}</button>
                            ))}
                        </div>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPicking(false)}>Cancelar</Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantidade ({unit})</p>
                    <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantidade produzida" />
                </div>
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dia</p>
                    <Input type="date" value={day} max={todayMz()} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Dia da produção" />
                </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
                <Chip active={day === todayMz()} onClick={() => setDay(todayMz())}>Hoje</Chip>
                <Chip active={day === yesterdayMz()} onClick={() => setDay(yesterdayMz())}>Ontem</Chip>
            </div>
            {!dateOk && <p className="text-xs text-red-600">Escolha um dia até hoje (no máximo um ano atrás).</p>}

            {isMultiLocation && (locations?.length || 0) > 1 && (
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Onde foi produzido</p>
                    <div className="flex flex-wrap gap-1.5">
                        {locations.map((l) => fromOrder && l.id !== location ? null : <Chip key={l.id} active={location === l.id} onClick={() => !fromOrder && setLocation(l.id)}>{locationLabel(l)}</Chip>)}
                    </div>
                </div>
            )}

            <MaterialsEditor value={materials} onChange={setMaterials} rawMaterials={rawMaterials || []} recipe={recipeLines} onUseRecipe={() => setMaterials(toDrafts(recipeLines))} />

            <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas</p>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} aria-label="Notas da produção"
                    placeholder="Ex.: foram usados 3 sacos de cimento; faltou água a meio; turno da tarde." />
            </div>

            <Button type="button" onClick={save} disabled={busy || !(n > 0) || !dateOk} className="h-12 w-full" data-tour="prod-editor-save">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {busy ? "A guardar…" : "Guardar alterações"}
            </Button>
        </div>
    );
}
