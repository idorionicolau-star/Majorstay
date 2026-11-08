"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getAfterSale, setAfterSale, type AfterSale } from "@/lib/after-sale";

/** Definições → Documentos: depois de cada venda, perguntar o que fazer ou imprimir logo (só neste aparelho). */
export function AfterSaleSetting() {
    const [value, setValue] = useState<AfterSale>("ask");
    useEffect(() => { setValue(getAfterSale()); }, []);
    const change = (v: string) => { const next: AfterSale = v === "print" ? "print" : "ask"; setValue(next); setAfterSale(next); };
    return (
        <Card className="glass-card mb-4">
            <CardHeader>
                <CardTitle>Depois de cada venda</CardTitle>
                <CardDescription>Só neste aparelho. Num balcão com impressora pode imprimir logo; nos outros, a app pergunta.</CardDescription>
            </CardHeader>
            <CardContent>
                <RadioGroup value={value} onValueChange={change} className="gap-3" data-testid="after-sale-setting">
                    <Label className="flex cursor-pointer items-center gap-3 font-normal"><RadioGroupItem value="ask" />Perguntar o que fazer (WhatsApp, imprimir, PDF…)</Label>
                    <Label className="flex cursor-pointer items-center gap-3 font-normal"><RadioGroupItem value="print" />Imprimir logo, sem perguntar</Label>
                </RadioGroup>
            </CardContent>
        </Card>
    );
}
