"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ACCENT_PRESETS, DOC_THEMES, hexToRgb, rgbToHex, themeById, type DocThemeId } from "@/lib/doc-themes";
import type { DocModel } from "@/lib/doc-model";

const SAMPLE: DocModel = {
    type: "Factura", number: "FT-000042", issueDate: new Date().toISOString(), dueDate: new Date(Date.now() + 14 * 864e5).toISOString(),
    client: { name: "Construtora Sol, Lda", taxId: "400987654", address: "Rua das Acácias 12, Matola" },
    items: [
        { id: "1", description: "Bloco 15 x 40", quantity: 500, unit: "un", unitPrice: 35 },
        { id: "2", description: "Cimento Cola 25kg", quantity: 20, unit: "saco", unitPrice: 650 },
        { id: "3", description: "Passadeira 8 Pistões", quantity: 12.5, unit: "m²", unitPrice: 650 },
    ],
    discount: 500, vat: 0, notes: "Entrega no estaleiro até sexta-feira.", paymentMethod: "M-Pesa", operator: "Exemplo",
};

/** Definições → Documentos: o aspecto por defeito dos documentos exportados (tema, cor, rodapé, assinaturas), com pré-visualização. */
export function DocumentsStyle() {
    const inv = useContext(InventoryContext);
    const { toast } = useToast();
    const company = inv?.companyData || null;
    const [theme, setTheme] = useState<DocThemeId>("classico");
    const [accent, setAccent] = useState<string>("");
    const [footer, setFooter] = useState("");
    const [place, setPlace] = useState("");
    const [showSig, setShowSig] = useState(true);
    const [showClient, setShowClient] = useState(false);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState("");
    const [busy, setBusy] = useState(false);
    const loaded = useRef(false);

    useEffect(() => {
        if (!company || loaded.current) return;
        loaded.current = true;
        setTheme((company.documentTheme as DocThemeId) || "classico");
        setAccent(company.documentAccent || "");
        setFooter(company.documentFooterNote || "");
        setPlace(company.documentSignaturePlace || "");
        setShowSig(company.documentShowSignatures !== false);
        setShowClient(company.documentShowClientSignature === true);
    }, [company]);

    const t = themeById(theme);
    const effectiveAccent = accent || rgbToHex(t.defaultAccent);

    // Pré-visualização do PDF verdadeiro, actualizada pouco depois de cada alteração.
    useEffect(() => {
        if (!company) return;
        let cancelled = false;
        const timer = setTimeout(async () => {
            setBusy(true);
            try {
                const { renderDocPDF } = await import("@/lib/doc-pdf");
                const doc = await renderDocPDF({ ...SAMPLE, style: { theme, accent: accent || undefined, footerNote: footer || undefined, signaturePlace: place || undefined, showSignatures: showSig, showClientSignature: showClient } }, company);
                const url = URL.createObjectURL(doc.output("blob"));
                if (cancelled) { URL.revokeObjectURL(url); return; }
                setPreview((old) => { if (old) URL.revokeObjectURL(old); return url; });
            } catch (e) {
                console.error("Pré-visualização falhou", e);
            } finally {
                if (!cancelled) setBusy(false);
            }
        }, 450);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [company, theme, accent, footer, place, showSig, showClient]);

    const save = async () => {
        if (!inv?.updateCompany) return;
        setSaving(true);
        try {
            await inv.updateCompany({
                documentTheme: theme,
                documentAccent: accent || "",
                documentFooterNote: footer.trim(),
                documentSignaturePlace: place.trim(),
                documentShowSignatures: showSig,
                documentShowClientSignature: showClient,
            });
            toast({ title: "Aspecto dos documentos guardado", description: "Aplica-se a todos os documentos que exportar a partir de agora." });
        } finally {
            setSaving(false);
        }
    };

    const swatches = useMemo(() => ACCENT_PRESETS.map((p) => ({ ...p, hex: rgbToHex(p.rgb) })), []);

    return (
        <Card className="glass-card">
            <CardHeader>
                <CardTitle>Aspecto dos documentos</CardTitle>
                <CardDescription>Escolha o tema e a cor das facturas, cotações, recibos e guias que exporta em PDF ou imprime.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label>Tema</Label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {DOC_THEMES.map((th) => (
                                <button key={th.id} type="button" onClick={() => setTheme(th.id)} data-testid={`theme-${th.id}`}
                                    className={cn("overflow-hidden rounded-xl border p-2 text-left transition", theme === th.id ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/50")}>
                                    {/* miniatura: o PDF verdadeiro do tema, com a cor do tema */}
                                    <img src={`/doc-themes/${th.id}.jpg`} alt="" loading="lazy" className="mb-2 aspect-[210/297] w-full rounded-md border bg-white object-cover object-top" />
                                    <span className="flex items-center gap-2 text-sm font-semibold">
                                        <span className="h-3 w-3 rounded-full" style={{ background: accent || rgbToHex(th.defaultAccent) }} />{th.name}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">{th.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Cor de destaque</Label>
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => setAccent("")} className={cn("rounded-full border px-3 py-1 text-xs", !accent && "border-primary bg-primary/10 font-semibold")}>Do tema</button>
                            {swatches.map((s) => (
                                <button key={s.hex} type="button" title={s.name} aria-label={s.name} onClick={() => setAccent(s.hex)}
                                    className={cn("h-7 w-7 rounded-full border-2 transition", accent.toLowerCase() === s.hex ? "border-foreground scale-110" : "border-transparent")}
                                    style={{ background: s.hex }} />
                            ))}
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <input type="color" value={effectiveAccent} onChange={(e) => setAccent(e.target.value)} className="h-7 w-9 cursor-pointer rounded border bg-transparent p-0" aria-label="Escolher outra cor" />
                                outra
                            </label>
                        </div>
                        {accent && !hexToRgb(accent) && <p className="text-xs text-red-600">Cor inválida.</p>}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="doc-place">Local das assinaturas</Label>
                            <Input id="doc-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ex.: Maputo" />
                        </div>
                        <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 sm:mt-6">
                            <span className="text-sm">Mostrar espaço para assinaturas</span>
                            <Switch checked={showSig} onCheckedChange={setShowSig} />
                        </label>
                        {showSig && (
                            <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                                <span className="text-sm">Assinatura do cliente <span className="text-muted-foreground">(opcional)</span></span>
                                <Switch checked={showClient} onCheckedChange={setShowClient} data-testid="doc-client-sig" />
                            </label>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="doc-footer">Texto do rodapé</Label>
                        <Input id="doc-footer" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Em branco = nome da empresa · Processado por computador" />
                    </div>

                    <Button onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar aspecto
                    </Button>
                    <p className="text-xs text-muted-foreground">O logótipo e a assinatura da empresa definem-se em Definições → Empresa.</p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Pré-visualização {busy && <Loader2 className="ml-1 inline h-3.5 w-3.5 animate-spin" />}</Label>
                        {preview && <a href={preview} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> abrir</a>}
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-muted/30">
                        {preview ? <iframe key={preview} src={`${preview}#toolbar=0&navpanes=0&view=FitH`} title="Pré-visualização do documento" className="h-[560px] w-full bg-white" />
                            : <div className="flex h-[560px] items-center justify-center text-sm text-muted-foreground">A preparar…</div>}
                    </div>
                    <p className="text-xs text-muted-foreground">Exemplo com dados fictícios. Se a pré-visualização não aparecer no telemóvel, toque em "abrir".</p>
                </div>
            </CardContent>
        </Card>
    );
}
