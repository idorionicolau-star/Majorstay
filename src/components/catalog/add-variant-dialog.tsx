"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nameKey } from "@/lib/catalog-view";
import { optionsOfFamily, variantName, type VariantValues } from "@/lib/variants";

type Member = { name: string; variantGroup?: string; variantValues?: VariantValues };

/**
 * Acrescenta UMA variação nova a uma família que já existe (ex.: chegou o Pavê em Amarelo).
 * Pede o valor de cada tipo da família e mostra o nome que vai ficar.
 */
export function AddVariantDialog({ group, members, catalogNames, onClose, onCreate }: {
    /** a família (nome base) — null = fechado */
    group: string | null;
    members: Member[];
    catalogNames: string[];
    onClose: () => void;
    onCreate: (values: VariantValues, name: string) => void;
}) {
    const options = useMemo(() => optionsOfFamily(members), [members]);
    const [values, setValues] = useState<VariantValues>({});
    useEffect(() => { if (group) setValues({}); }, [group]);

    const order = options.map((o) => o.name);
    const filled = order.length > 0 && order.every((k) => (values[k] || "").trim());
    const name = group && filled ? variantName(group, values, order) : "";
    const exists = !!name && catalogNames.some((n) => nameKey(n) === nameKey(name));

    return (
        <ResponsiveDialog open={!!group} onOpenChange={(o) => !o && onClose()} title={`Nova variação de ${group || ""}`} description="Preço, custo, unidade e foto vêm do produto; pode editá-los depois.">
            <div className="space-y-4 py-2">
                {options.map((o) => (
                    <div key={o.name} className="space-y-1.5">
                        <Label htmlFor={`v-${o.name}`}>{o.name}</Label>
                        <Input
                            id={`v-${o.name}`}
                            list={`v-list-${o.name}`}
                            value={values[o.name] || ""}
                            onChange={(e) => setValues({ ...values, [o.name]: e.target.value })}
                            placeholder={`Ex.: ${o.values[0] || ""}`}
                            autoComplete="off"
                        />
                        <datalist id={`v-list-${o.name}`}>{o.values.map((v) => <option key={v} value={v} />)}</datalist>
                    </div>
                ))}
                {name && <p className="text-sm" aria-live="polite">Fica: <b>{name}</b>{exists && <span className="ml-1 font-medium text-destructive">— já existe.</span>}</p>}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button type="button" disabled={!filled || exists} onClick={() => onCreate(Object.fromEntries(order.map((k) => [k, values[k].trim()])), name)}>Criar variação</Button>
                </div>
            </div>
        </ResponsiveDialog>
    );
}
