"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Flashlight, Plus, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createScanGate, isGoodRead, UNKNOWN_CODE } from "@/lib/scan-gate";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = { new (opts?: { formats?: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

export const cameraScanSupported = () =>
    typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

function beep() {
    try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 1100;
        g.gain.value = 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.09);
        setTimeout(() => ctx.close().catch(() => {}), 300);
    } catch { /* sem som */ }
    try { navigator.vibrate?.(40); } catch { /* sem vibração */ }
}

/**
 * Leitor de código de barras com a câmara. Usa o leitor do próprio telemóvel (Chrome/Android):
 * grátis, sem internet, sem IA. Fica aberto para ler vários artigos seguidos.
 * `onScan` devolve o texto a mostrar ("✓ Cimento × 2" = leitura boa, "✗ …" = recusada), `UNKNOWN_CODE` (código que não
 * conhece: o leitor fica aberto e pede para tentar de novo; `onUnknown` deixa associá-lo a um produto) ou `undefined`.
 * O mesmo artigo mantido à frente da câmara conta uma só vez; "Ler outra vez" junta mais um igual.
 */
export function BarcodeScanner({ open, onClose, onScan, onUnknown, unknownLabel = "Associar a um produto", title = "Aponte ao código de barras" }: {
    open: boolean;
    onClose: () => void;
    onScan: (code: string) => string | void | Promise<string | void>;
    /** Código que não conhece: o que fazer quando a pessoa toca no botão (ex.: associar a um produto). */
    onUnknown?: (code: string) => void;
    unknownLabel?: string;
    title?: string;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const trackRef = useRef<MediaStreamTrack | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [flash, setFlash] = useState<string | null>(null);
    const [reads, setReads] = useState<string[]>([]); // leituras boas desta vez (a mais recente primeiro)
    const [lastCode, setLastCode] = useState<string | null>(null); // código da última leitura boa
    const [torch, setTorch] = useState<boolean | null>(null);
    const [unknown, setUnknown] = useState<string | null>(null); // último código que não conhece // null = o telemóvel não tem lanterna controlável
    const onScanRef = useRef(onScan);
    useEffect(() => { onScanRef.current = onScan; }, [onScan]);

    const handle = useCallback(async (code: string) => {
        beep();
        const msg = await onScanRef.current(code);
        if (msg === UNKNOWN_CODE) {
            setUnknown(code);
            setFlash(null);
            return;
        }
        setUnknown(null);
        if (msg) setFlash(msg);
        if (isGoodRead(msg)) {
            setReads((r) => [msg, ...r]);
            setLastCode(code);
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        let stop = false;
        let stream: MediaStream | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        setError(null);
        setFlash(null);
        setReads([]);
        setLastCode(null);
        setTorch(null);
        setUnknown(null);

        (async () => {
            if (!cameraScanSupported()) {
                setError("Este navegador não lê códigos com a câmara. Use o Chrome no Android, ou um leitor USB/Bluetooth (funciona como teclado), ou escreva o código.");
                return;
            }
            try {
                // resolução por defeito da câmara: imagens maiores tornavam cada leitura bem mais lenta
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
                if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
                const track = stream.getVideoTracks()[0];
                trackRef.current = track ?? null;
                const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
                if (caps.torch) setTorch(false);
                const v = videoRef.current;
                if (!v) return;
                v.srcObject = stream;
                await v.play();
                const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
                const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"] });
                const gate = createScanGate();
                const tick = async () => {
                    if (stop) return;
                    try {
                        // o leitor do telemóvel já lê o código em qualquer posição (vertical, de lado)
                        const found = await detector.detect(v);
                        const code = found[0]?.rawValue;
                        if (code && gate.seen(code, Date.now())) await handle(code);
                    } catch { /* frame sem código */ }
                    timer = setTimeout(tick, 80);
                };
                tick();
            } catch (e) {
                const name = (e as { name?: string })?.name;
                setError(name === "NotAllowedError" ? "A câmara está bloqueada. Permita o acesso à câmara nas definições do navegador." : "Não foi possível abrir a câmara.");
            }
        })();

        return () => {
            stop = true;
            if (timer) clearTimeout(timer);
            stream?.getTracks().forEach((t) => t.stop());
            trackRef.current = null;
        };
    }, [open, handle]);

    const toggleTorch = () => {
        const on = !torch;
        trackRef.current?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).then(() => setTorch(on)).catch(() => setTorch(null));
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white" role="dialog" aria-label="Leitor de código de barras">
            <div className="flex items-center justify-between gap-2 p-4">
                <p className="flex min-w-0 items-center gap-2 font-semibold"><Camera className="h-5 w-5 shrink-0" /> {title}</p>
                {torch !== null && (
                    <Button type="button" variant="secondary" size="sm" onClick={toggleTorch} aria-pressed={torch} className={cn(torch && "bg-amber-300 text-black hover:bg-amber-200")}>
                        <Flashlight className="mr-1 h-4 w-4" /> {torch ? "Apagar" : "Lanterna"}
                    </Button>
                )}
            </div>
            {error ? (
                <p className="m-4 rounded-xl bg-red-500/20 p-4 text-sm">{error}</p>
            ) : (
                <div className="relative mx-auto w-full max-w-xl flex-1 overflow-hidden">
                    <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                    <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                </div>
            )}
            {/* em baixo, ao alcance do polegar */}
            <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="min-h-7 text-center" aria-live="polite">
                    {unknown
                        ? <p className="text-base font-bold text-amber-300">Não reconheci este código. Posicione bem e tente de novo.</p>
                        : flash
                        ? <p className={cn("flex items-center justify-center gap-2 text-lg font-bold", flash.startsWith("✗") ? "text-red-300" : "text-emerald-300")}><Zap className="h-5 w-5" /> {flash}</p>
                        : <p className="text-sm text-white/70">Leia vários artigos seguidos. Cada artigo conta uma vez.</p>}
                </div>
                {reads.length > 1 && (
                    <ul className="max-h-20 space-y-0.5 overflow-y-auto text-center text-xs text-white/60">
                        {reads.slice(1, 6).map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                )}
                {unknown && onUnknown && (
                    <Button type="button" variant="secondary" onClick={() => onUnknown(unknown)} className="h-10 w-full rounded-xl">
                        {unknownLabel} <span className="ml-1 font-mono text-xs opacity-70">{unknown}</span>
                    </Button>
                )}
                <div className="flex gap-2">
                    {lastCode && (
                        <Button type="button" variant="secondary" onClick={() => handle(lastCode)} className="h-12 flex-1 rounded-xl text-base">
                            <Plus className="mr-1 h-5 w-5" /> Ler outra vez
                        </Button>
                    )}
                    <Button type="button" onClick={onClose} className={cn("h-12 flex-1 rounded-xl text-base", reads.length ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-white/15 text-white hover:bg-white/25")}>
                        {reads.length ? <><Check className="mr-1 h-5 w-5" /> Confirmar ({reads.length})</> : <><X className="mr-1 h-4 w-4" /> Fechar</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}
