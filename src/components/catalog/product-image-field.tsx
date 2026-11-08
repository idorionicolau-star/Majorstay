"use client";

import { useContext, useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { uploadProductImage } from "@/lib/upload-product-image";
import { makeStudioPhoto } from "@/lib/studio-photo-canvas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Foto do produto: comprime e envia para o Vercel Blob; o formulário guarda só o endereço (`imageUrl`).
 * Antes de enviar oferece a "foto de estúdio" (fundo branco), feita no próprio telemóvel, sem IA nem internet.
 */
export function ProductImageField({ value, onChange }: { value?: string; onChange: (url: string) => void }) {
    const inv = useContext(InventoryContext);
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);
    const [picked, setPicked] = useState<File | null>(null);
    const [studio, setStudio] = useState<{ state: "working" | "done" | "failed"; blob?: Blob } | null>(null);
    const [urls, setUrls] = useState<{ original?: string; studio?: string }>({});
    const [id] = useState(() => `product-image-${Math.random().toString(36).slice(2, 8)}`);

    // pré-visualizações (e libertar a memória quando deixam de ser precisas)
    useEffect(() => {
        const original = picked ? URL.createObjectURL(picked) : undefined;
        const st = studio?.blob ? URL.createObjectURL(studio.blob) : undefined;
        setUrls({ original, studio: st });
        return () => { if (original) URL.revokeObjectURL(original); if (st) URL.revokeObjectURL(st); };
    }, [picked, studio?.blob]);

    const upload = async (file: File) => {
        if (!inv?.companyId) return;
        setBusy(true);
        try {
            onChange(await uploadProductImage(file, getAuth(), inv.companyId));
        } catch (e: any) {
            toast({ variant: "destructive", title: "Não foi possível enviar a foto", description: e.message });
        } finally {
            setBusy(false);
        }
    };

    const pick = (file: File) => {
        setPicked(file);
        setStudio({ state: "working" });
        // deixa o ecrã mostrar "a preparar…" antes do trabalho pesado
        setTimeout(() => {
            makeStudioPhoto(file)
                .then((blob) => setStudio(blob ? { state: "done", blob } : { state: "failed" }))
                .catch(() => setStudio({ state: "failed" }));
        }, 50);
    };

    const close = () => { setPicked(null); setStudio(null); };
    const choose = async (which: "studio" | "original") => {
        const file = which === "studio" && studio?.blob ? new File([studio.blob], "produto-estudio.jpg", { type: "image/jpeg" }) : picked;
        close();
        if (file) await upload(file);
    };

    return (
        <div className="flex items-center gap-3">
            {value ? (
                <div className="relative">
                    <img src={value} alt="Foto do produto" className="h-16 w-16 rounded-lg border bg-white object-cover" />
                    <button type="button" onClick={() => onChange("")} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground" aria-label="Remover foto">
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground"><ImagePlus className="h-6 w-6" /></div>
            )}
            <Label htmlFor={id} className="cursor-pointer">
                <Button type="button" variant="outline" size="sm" asChild>
                    <span>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}{value ? "Alterar foto" : "Adicionar foto"}</span>
                </Button>
            </Label>
            <input id={id} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />

            <Dialog open={!!picked} onOpenChange={(o) => { if (!o) close(); }}>
                <DialogContent data-testid="studio-photo">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Foto de estúdio</DialogTitle>
                        <DialogDescription>Fundo branco feito no telemóvel, sem internet. Escolha a que prefere.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                        <figure className="space-y-1">
                            <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
                                {urls.original && <img src={urls.original} alt="Original" className="h-full w-full object-cover" />}
                            </div>
                            <figcaption className="text-center text-xs text-muted-foreground">Original</figcaption>
                        </figure>
                        <figure className="space-y-1">
                            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-white">
                                {studio?.state === "working" && <span className="flex flex-col items-center gap-2 text-xs text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /> A preparar…</span>}
                                {studio?.state === "done" && urls.studio && <img src={urls.studio} alt="Fundo branco" data-testid="studio-result" className="h-full w-full object-contain" />}
                                {studio?.state === "failed" && <span className="p-3 text-center text-xs text-slate-500">Não consegui separar o produto do fundo.</span>}
                            </div>
                            <figcaption className="text-center text-xs text-muted-foreground">Fundo branco</figcaption>
                        </figure>
                    </div>
                    {studio?.state === "failed" && (
                        <p className="text-xs text-muted-foreground">Dica: produto ao centro e a ocupar boa parte da foto, num fundo de cor diferente da dele.</p>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row-reverse">
                        <Button type="button" className="h-11 flex-1" disabled={studio?.state !== "done"} onClick={() => choose("studio")}>
                            <Sparkles className="mr-2 h-4 w-4" /> Usar fundo branco
                        </Button>
                        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => choose("original")}>Usar a original</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
