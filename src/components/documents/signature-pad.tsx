"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Assinatura desenhada com o dedo, o rato ou a caneta. Guarda uma imagem PNG pequena (data URL) e chama `onChange`
 * quando se levanta o dedo; "Limpar" apaga. `value` mostra a assinatura já guardada.
 */
export function SignaturePad({ value, onChange, disabled, label }: { value?: string; onChange: (dataUrl: string) => void; disabled?: boolean; label: string }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [empty, setEmpty] = useState(!value);

    // desenha a assinatura guardada (ao abrir, ao desfazer/refazer)
    useEffect(() => {
        const c = ref.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        setEmpty(!value);
        if (!value) return;
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
        img.src = value;
    }, [value]);

    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const c = ref.current!;
        const r = c.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
    };
    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        const ctx = ref.current!.getContext("2d")!;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        const { x, y } = pos(e);
        ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111827";
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.01, y); ctx.stroke();
        setEmpty(false);
    };
    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        const ctx = ref.current!.getContext("2d")!;
        const { x, y } = pos(e);
        ctx.lineTo(x, y); ctx.stroke();
    };
    const end = () => {
        if (!drawing.current) return;
        drawing.current = false;
        onChange(ref.current!.toDataURL("image/png"));
    };
    const clear = () => {
        const c = ref.current!;
        c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
        setEmpty(true);
        onChange("");
    };
    const upload = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const c = ref.current!;
                const ctx = c.getContext("2d")!;
                ctx.clearRect(0, 0, c.width, c.height);
                const r = Math.min(c.width / img.width, c.height / img.height);
                ctx.drawImage(img, (c.width - img.width * r) / 2, (c.height - img.height * r) / 2, img.width * r, img.height * r);
                setEmpty(false);
                onChange(c.toDataURL("image/png"));
            };
            img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{label}</span>
                {!disabled && (
                    <div className="flex items-center gap-1">
                        <label className="cursor-pointer">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
                            <span className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted"><ImagePlus className="h-3.5 w-3.5" /> Imagem</span>
                        </label>
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clear} disabled={empty}><Eraser className="mr-1 h-3.5 w-3.5" /> Limpar</Button>
                    </div>
                )}
            </div>
            <div className="relative rounded-lg border bg-white">
                <canvas ref={ref} width={420} height={150} className="h-[110px] w-full touch-none rounded-lg"
                    onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} />
                {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-400">{disabled ? "Sem assinatura" : "Assine aqui"}</span>}
                <span className="pointer-events-none absolute inset-x-6 bottom-5 border-b border-dashed border-zinc-300" />
            </div>
        </div>
    );
}
