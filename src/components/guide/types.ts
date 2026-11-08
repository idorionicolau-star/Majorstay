import type { ReactNode } from "react";

export type GuideStep = {
    /** `data-tour` do elemento a destacar; vários separados por "|" (usa o primeiro que estiver visível). Sem alvo = balão ao centro. */
    target?: string;
    title: string;
    body: ReactNode;
    /** Como se passa ao passo seguinte: botão "Seguinte" (por defeito), tocar no elemento, ou quando `done` ficar verdadeiro. */
    advance?: "next" | "click" | "auto";
    done?: () => boolean;
    /** Com `done`: só avança quando a pessoa parou de escrever há este tempo (ms) — o guia nunca salta a meio de uma palavra. */
    settle?: number;
    /** O que a pessoa tem de fazer (aparece a piscar no lugar do "Seguinte"). */
    hint?: string;
    /** Página onde o passo acontece: o guia navega para lá se for preciso. */
    route?: string;
    /** Botão extra (ex.: começar outro guia, abrir uma página). */
    cta?: { label: string; guide?: string; href?: string };
    /** Se o elemento não estiver no ecrã (ex.: lista vazia, sem permissão), salta o passo. Por defeito: sim nos tutoriais de página. */
    optional?: boolean;
};

export type Guide = {
    id: string;
    title: string;
    steps: GuideStep[];
    /** Guia que começa a seguir a este (ex.: demonstração → catálogo). */
    next?: string;
    /** Tutorial de página: a rota onde aparece o botão "?" e o convite da primeira visita. */
    path?: string;
};

/** O primeiro elemento visível com este `data-tour` (aceita alternativas: "a|b"). */
export function findTarget(names: string): HTMLElement | null {
    if (typeof document === "undefined") return null;
    for (const raw of names.split("|")) {
        const n = raw.trim();
        if (!n) continue;
        const all = document.querySelectorAll<HTMLElement>(`[data-tour="${n}"]`);
        for (const el of Array.from(all)) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) return el;
        }
    }
    return null;
}

/** Condições para `done`: quando um elemento aparece / desaparece do ecrã. */
export const appears = (names: string) => () => !!findTarget(names);
export const disappears = (names: string) => () => !findTarget(names);
/** A pessoa já está nesta página (os passos "abra o menu…" acabam quando ela lá chega pelo próprio toque). */
export const onPage = (path: string) => () => typeof window !== "undefined" && window.location.pathname === path;

/**
 * Passo "abra esta página pelo menu": destaca o item do menu lateral (computador) ou da barra de baixo; se não estiver à
 * vista (telemóvel, dentro do "Mais"), destaca o botão Mais e, quando o menu abre, o item lá dentro.
 */
export function navStep(href: string, label: string, title: string, body: ReactNode): GuideStep {
    return { target: `nav:${href}|nav-more`, advance: "auto", done: onPage(href), hint: `Toque em ${label}`, title, body };
}

/** O campo (input dentro do elemento) já tem pelo menos `min` caracteres — ou, com `positive`, um número maior que zero. */
export const filled = (names: string, min = 1, positive = false) => () => {
    const el = findTarget(names);
    const input = el?.matches("input, textarea") ? (el as HTMLInputElement) : el?.querySelector<HTMLInputElement>("input, textarea");
    const v = (input?.value || "").trim();
    if (positive) return Number(v.replace(/\s/g, "").replace(",", ".")) > 0;
    return v.length >= min;
};
