"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { BarcodeScanner, cameraScanSupported } from "@/components/scan/barcode-scanner";
import { findBarcodeClash, marginPct } from "@/lib/catalog-view";
import { normalizeBarcode } from "@/lib/barcode";
import { formatCurrency } from "@/lib/utils";

/**
 * Custo (com a margem a aparecer enquanto se escreve) e código de barras (escrito, lido por um leitor USB
 * ou pela câmara). Avisa se o código já pertence a outro produto do catálogo.
 * Usa o formulário que o rodeia (react-hook-form), por isso serve para "adicionar" e "editar".
 */
export function CostBarcodeFields({ catalog, exceptId, noBarcode }: { catalog: { id?: string; name: string; barcode?: string }[]; exceptId?: string; /** produto com variações: cada variação tem o seu código, definido depois */ noBarcode?: boolean }) {
    const form = useFormContext();
    const [scan, setScan] = useState(false);
    const price = Number(form.watch("price")) || 0;
    const cost = Number(form.watch("cost")) || 0;
    const code = String(form.watch("barcode") || "");
    const margin = marginPct(price, cost);
    const clash = code.trim() ? findBarcodeClash(catalog, code, exceptId) : undefined;

    return (
        <>
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="cost" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Custo (opcional)</FormLabel>
                        <FormControl><Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="Quanto lhe custa" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <div className="flex flex-col justify-end pb-2 text-sm" aria-live="polite">
                    {margin === null ? <span className="text-muted-foreground">Margem: indique o custo</span>
                        : margin < 0 ? <span className="font-medium text-destructive">Abaixo do custo ({margin}%)</span>
                            : <span>Margem <b className="tabular-nums">{margin}%</b> <span className="text-muted-foreground">· lucro {formatCurrency(price - cost)}</span></span>}
                </div>
            </div>
            {!noBarcode && <FormField control={form.control} name="barcode" render={({ field }) => (
                <FormItem>
                    <FormLabel>Código de barras (opcional)</FormLabel>
                    <div className="flex gap-2">
                        <FormControl><Input inputMode="text" autoComplete="off" placeholder="Escreva, use o leitor ou a câmara" {...field} value={field.value ?? ""} onBlur={(e) => { field.onBlur(); const n = normalizeBarcode(e.target.value); if (n !== e.target.value) form.setValue("barcode", n, { shouldDirty: true }); }} /></FormControl>
                        {cameraScanSupported() && <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setScan(true)} aria-label="Ler com a câmara"><ScanBarcode className="h-4 w-4" /></Button>}
                    </div>
                    {clash && <p className="text-sm text-destructive">Este código já é de «{clash.name}».</p>}
                    <FormMessage />
                </FormItem>
            )} />}
            <BarcodeScanner open={scan} onClose={() => setScan(false)} onScan={(c) => { form.setValue("barcode", normalizeBarcode(c), { shouldDirty: true }); setScan(false); return "Código lido"; }} />
        </>
    );
}
