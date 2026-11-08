"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Rec = {
    lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number; processLocally?: boolean;
    start: () => void; stop: () => void; abort: () => void;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
};
type RecCtor = new () => Rec;

const getCtor = (): RecCtor | null => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

/**
 * Ditado do navegador (gratuito, sem IA paga). Tenta reconhecer no próprio aparelho (offline) quando o
 * Chrome tem o pacote de português; senão usa o serviço do navegador, que precisa de internet.
 * O que foi dito NÃO é usado logo: aparece numa janela para a pessoa conferir (e corrigir, se o ditado errou) e só
 * chega a `onResult` quando confirma — com a tecla Enter ou o botão. Quem usa interpreta com `parseVoice`.
 * `review={false}` volta ao comportamento antigo (usar logo o que foi dito).
 */
export function VoiceButton({ onResult, onInterim, onProblem, className, review = true }: {
    onResult: (text: string) => void;
    review?: boolean;
    onInterim?: (text: string) => void;
    onProblem?: (message: string) => void;
    className?: string;
}) {
    const [supported, setSupported] = useState(false);
    const [listening, setListening] = useState(false);
    /** o que foi ouvido, à espera de confirmação (null = nada a conferir) */
    const [heard, setHeard] = useState<string | null>(null);
    const recRef = useRef<Rec | null>(null);
    useEffect(() => setSupported(!!getCtor()), []);
    useEffect(() => () => recRef.current?.abort(), []);

    if (!supported) return null;

    const start = (local: boolean) => {
        const Ctor = getCtor();
        if (!Ctor) return;
        const rec = new Ctor();
        rec.lang = "pt-PT";
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        if (local) rec.processLocally = true; // sem efeito em navegadores que não suportam
        let finalText = "";
        let triedFallback = false;
        rec.onresult = (e) => {
            let text = "";
            for (let i = 0; i < e.results.length; i++) {
                text += e.results[i][0].transcript;
                if (e.results[i].isFinal) finalText = text;
            }
            onInterim?.(text);
        };
        rec.onerror = (e) => {
            if (local && !triedFallback && (e.error === "language-not-supported" || e.error === "service-not-allowed")) {
                triedFallback = true;
                if (typeof navigator !== "undefined" && navigator.onLine === false) {
                    onProblem?.("Sem internet e o português não está instalado para ouvir no aparelho. Escreva, ou tente com internet.");
                } else {
                    start(false);
                }
                return;
            }
            if (e.error === "not-allowed") onProblem?.("O microfone está bloqueado. Permita o microfone nas definições do navegador.");
            else if (e.error === "network") onProblem?.("O ditado precisa de internet neste aparelho. Escreva, ou tente com internet.");
            else if (e.error !== "no-speech" && e.error !== "aborted") onProblem?.("Não consegui ouvir. Tente de novo.");
        };
        rec.onend = () => {
            setListening(false);
            const said = finalText.trim();
            if (!said) return;
            onInterim?.(""); // a linha "A ouvir…" de quem usa desaparece: o texto passa para a janela de confirmação
            if (review) setHeard(said); else onResult(said);
        };
        recRef.current = rec;
        try {
            rec.start();
            setListening(true);
        } catch {
            setListening(false);
        }
    };

    const confirm = () => {
        const text = (heard || "").trim();
        setHeard(null);
        if (text) onResult(text);
    };

    return (
        <>
        <button
            type="button"
            aria-label={listening ? "A ouvir… toque para parar" : "Ditar por voz"}
            title="Diga o produto. Para a quantidade, diga «x 20» (ex.: cimento x 20)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (listening ? recRef.current?.stop() : start(true))}
            className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition", listening ? "animate-pulse border-red-500 bg-red-500/15 text-red-600" : "bg-card text-muted-foreground hover:text-foreground", className)}
        >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <Dialog open={heard !== null} onOpenChange={(o) => { if (!o) setHeard(null); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Mic className="h-4 w-4" /> Foi isto que ouvi</DialogTitle>
                    <DialogDescription>Confira (pode corrigir o texto). Carregue em <b>Enter</b> para usar.</DialogDescription>
                </DialogHeader>
                <Input
                    autoFocus
                    value={heard ?? ""}
                    onChange={(e) => setHeard(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm(); } }}
                    aria-label="O que foi ouvido"
                    className="h-12 text-lg"
                />
                <DialogFooter className="gap-2 sm:justify-between">
                    <Button type="button" variant="ghost" onClick={() => { setHeard(null); start(true); }}><Mic className="mr-1.5 h-4 w-4" /> Falar de novo</Button>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setHeard(null)}>Cancelar</Button>
                        <Button type="button" onClick={confirm} disabled={!(heard || "").trim()}>Usar (Enter)</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
