"use client";

import { useEffect, useState } from "react";

/** Abaixo disto é a barra do browser a esconder-se, não o teclado. */
const KEYBOARD_MIN = 120;

/**
 * Altura do teclado do telemóvel (0 quando fechado).
 *
 * O Chrome (Android) e o Safari (iOS) não encolhem a página quando o teclado abre:
 * só a parte visível (visualViewport). Um `position: fixed; bottom: 0` fica então
 * escondido atrás do teclado. Com este valor como `bottom`, a barra sobe e fica
 * mesmo por cima do teclado.
 */
export function useKeyboardInset() {
    const [inset, setInset] = useState(0);

    useEffect(() => {
        const vv = typeof window !== "undefined" ? window.visualViewport : null;
        if (!vv) return;
        const update = () => {
            const hidden = window.innerHeight - vv.height - vv.offsetTop;
            const zoomed = (vv.scale || 1) > 1.05; // ampliar com dois dedos também encolhe a parte visível: não é teclado
            setInset(hidden > KEYBOARD_MIN && !zoomed ? Math.round(hidden) : 0);
        };
        update();
        vv.addEventListener("resize", update);
        vv.addEventListener("scroll", update);
        return () => {
            vv.removeEventListener("resize", update);
            vv.removeEventListener("scroll", update);
        };
    }, []);

    return inset;
}

/**
 * Com o teclado aberto, garante que o campo onde se escreve não fica tapado pela
 * barra fixa de baixo (que agora está por cima do teclado).
 */
export function useKeepFocusedAboveBar(keyboardInset: number, barHeight: number) {
    useEffect(() => {
        if (!keyboardInset) return;
        const vv = window.visualViewport;
        const check = () => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || !/^(INPUT|TEXTAREA)$/.test(el.tagName) || !vv) return;
            const visibleBottom = vv.offsetTop + vv.height - barHeight - 8;
            const r = el.getBoundingClientRect();
            if (r.bottom > visibleBottom) window.scrollBy({ top: r.bottom - visibleBottom, behavior: "smooth" });
        };
        const t = setTimeout(check, 50);
        const onFocus = () => setTimeout(check, 300);
        document.addEventListener("focusin", onFocus);
        return () => { clearTimeout(t); document.removeEventListener("focusin", onFocus); };
    }, [keyboardInset, barHeight]);
}
