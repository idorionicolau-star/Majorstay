"use client";

// Botão "Fechar teclado": aparece por cima do teclado do telemóvel enquanto se escreve, em qualquer página, janela
// ou gaveta. Fecha só o teclado — nunca a janela onde se está a escrever (por isso o toque nele não conta como
// "toque fora" para o Radix/Vaul, não rouba o foco e funciona com a janela modal aberta).
//
// Há dois modelos de teclado: (A) Chrome/Safari recentes encolhem só a parte visível (visualViewport) — o botão sobe
// pelo `inset`; (B) Huawei, Samsung, WebViews e Chrome antigo encolhem a página toda (innerHeight) — aí o fundo da
// página já é o topo do teclado e o botão fica colado ao fundo. Sem detetar o B, o botão nunca aparecia nesses aparelhos.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Keyboard } from "lucide-react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { hideKeyboard, isTouchDevice, keyboardIsOpenFor, watchKeyboardIntent } from "@/lib/keyboard";

export function KeyboardDismiss() {
    const inset = useKeyboardInset();
    const [editing, setEditing] = useState(false);
    const [touch, setTouch] = useState(false);
    const [shrunk, setShrunk] = useState(false);

    useEffect(() => {
        setTouch(isTouchDevice());
        // Modelo B: a altura da página caiu mais de 120 px em relação à maior já vista (a barra do browser mexe menos)
        let baseline = window.innerHeight;
        let width = window.innerWidth;
        const measure = () => {
            if (window.innerWidth !== width) { width = window.innerWidth; baseline = window.innerHeight; } // rodou o ecrã
            else if (window.innerHeight > baseline) baseline = window.innerHeight;
            setShrunk(baseline - window.innerHeight > 120);
        };
        window.addEventListener("resize", measure);
        const stopWatching = watchKeyboardIntent();
        // activeElement só muda depois do evento: espera um instante
        const sync = () => setTimeout(() => setEditing(keyboardIsOpenFor()), 0);
        document.addEventListener("focusin", sync);
        document.addEventListener("focusout", sync);
        sync();
        return () => {
            window.removeEventListener("resize", measure);
            stopWatching();
            document.removeEventListener("focusin", sync);
            document.removeEventListener("focusout", sync);
        };
    }, []);

    // O botão não pode roubar o foco (senão o teclado fechava sozinho antes do toque acabar) nem chegar ao
    // `document`, onde as janelas/gavetas escutam "toquei fora" para se fecharem.
    const hold = useCallback((node: HTMLButtonElement | null) => {
        if (!node) return;
        const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
        node.addEventListener("pointerdown", stop);
        node.addEventListener("mousedown", stop);
    }, []);

    if (!touch || !(inset || shrunk) || !editing) return null;

    return createPortal(
        <button
            ref={hold}
            type="button"
            tabIndex={-1}
            data-tour="keyboard-dismiss"
            aria-label="Fechar o teclado"
            onClick={hideKeyboard}
            // pointer-events: as janelas modais desligam-nos no resto da página
            style={{ bottom: (inset || 0) + 10, pointerEvents: "auto" }}
            className="fixed right-3 z-[200] flex h-10 items-center gap-1.5 rounded-full border bg-foreground px-3.5 text-sm font-semibold text-background shadow-lg active:scale-95"
        >
            <Keyboard className="h-4 w-4" />
            Fechar
            <ChevronDown className="h-4 w-4" />
        </button>,
        document.body,
    );
}
