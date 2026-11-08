"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { holeFor, keyboardOpen, placePopover, routeMatches, shadesAround, type Box } from "@/lib/guide-layout";
import { GUIDES } from "./guides";
import { guideStore, markGuideDone, useGuideState } from "./guide-store";
import { findTarget } from "./types";

/** O que se vê do elemento: cortado pelas caixas que deslizam (overflow) onde está metido. */
function clippedRect(el: HTMLElement, r: DOMRect) {
    let top = r.top, left = r.left, right = r.right, bottom = r.bottom;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        const cx = cs.overflowX !== "visible", cy = cs.overflowY !== "visible";
        if (!cx && !cy) continue;
        const pr = p.getBoundingClientRect();
        if (cx) { left = Math.max(left, pr.left); right = Math.min(right, pr.right); }
        if (cy) { top = Math.max(top, pr.top); bottom = Math.min(bottom, pr.bottom); }
    }
    return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top), bottom, right };
}

const sameBox = (a: Box | null, b: Box) => !!a && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

/**
 * Mostra o guia activo por cima da app: escurece o ecrã, deixa um "buraco" com um anel a piscar à volta do
 * elemento onde a pessoa tem de mexer (o resto fica bloqueado) e um balão com o que fazer.
 * Passa ao passo seguinte com o botão, ao tocar no elemento, ou sozinho quando a condição do passo se cumpre.
 * Montado uma vez no layout; funciona por cima das janelas (Radix) e no telemóvel.
 */
export function GuideHost() {
    const st = useGuideState();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [box, setBox] = useState<Box | null>(null);
    const [vp, setVp] = useState({ w: 1024, h: 768 });
    /** a parte do ecrã que se vê (com o teclado do telemóvel aberto, a de baixo fica tapada) */
    const [visible, setVisible] = useState({ top: 0, height: 768 });
    const [missing, setMissing] = useState(false);
    const [popH, setPopH] = useState(220);
    const targetRef = useRef<HTMLElement | null>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    /** para que lado se ia quando um passo opcional é saltado (Anterior volta para trás) */
    const dirRef = useRef<1 | -1>(1);

    const guide = st ? GUIDES[st.id] : undefined;
    const index = st?.index ?? 0;
    const step = guide?.steps[Math.min(index, (guide?.steps.length ?? 1) - 1)];
    const total = guide?.steps.length ?? 0;
    const stepKey = st ? `${st.id}:${index}` : "";

    useEffect(() => setMounted(true), []);
    // guia que já não existe (ex.: guardado de uma versão antiga) → termina
    useEffect(() => { if (st && !guide) guideStore.stop(); }, [st, guide]);

    const finish = useCallback(() => {
        if (!guide) return;
        markGuideDone(guide.id);
        if (guide.next && GUIDES[guide.next]) guideStore.start(guide.next);
        else guideStore.stop();
    }, [guide]);

    const next = useCallback(() => {
        dirRef.current = 1;
        const s = guideStore.get();
        if (!s || !guide) return;
        if (s.index >= guide.steps.length - 1) finish();
        else guideStore.go(s.index + 1);
    }, [guide, finish]);

    const prev = useCallback(() => {
        const s = guideStore.get();
        if (s && s.index > 0) { dirRef.current = -1; guideStore.go(s.index - 1); }
    }, []);

    const quit = useCallback(() => {
        if (guide) markGuideDone(guide.id);
        guideStore.stop();
    }, [guide]);

    // O passo é noutra página → vai para lá. Se a pessoa sair da página a meio (voltar atrás, outro menu), o guia termina.
    const arrivedRef = useRef("");
    // Guia que vinha de antes de recarregar a página (sessionStorage): só continua se a pessoa ainda estiver na
    // página dele — quem escreveu outro endereço não é puxado de volta.
    const bootRef = useRef(typeof window !== "undefined" ? guideStore.get() : null);
    useEffect(() => {
        if (!guide || !step) return;
        // o estado pode já ter mudado (ex.: o guia acabou de ser parado) — decide sempre pelo estado actual
        const live = guideStore.get();
        if (!live || live.id !== st?.id || live.index !== st?.index) return;
        const want = step.route || guide.path;
        const boot = bootRef.current;
        bootRef.current = null;
        if (boot && boot.id === st?.id && boot.index === st?.index && want && !routeMatches(want, window.location.pathname, window.location.search)) {
            guideStore.stop();
            return;
        }
        if (!want) return;
        if (routeMatches(want, window.location.pathname, window.location.search)) {
            arrivedRef.current = stepKey;
            return;
        }
        if (arrivedRef.current === stepKey) {
            guideStore.stop();
            return;
        }
        router.push(want);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepKey, pathname]);

    // segue o elemento (muda de sítio quando se rola, quando o teclado abre, quando a janela abre…)
    useEffect(() => {
        if (!step) return;
        let alive = true;
        let raf = 0;
        let scrolled = false;
        let blurred = false;
        let lastKb = false;
        let lastEl: HTMLElement | null = null;
        const t0 = Date.now();
        let onPageAt = 0; // quando chegou à página do passo (a página pode demorar a abrir)
        let grace = 1200; // já estava na página quando o passo começou → o elemento ou existe já, ou não existe: espera pouco
        // nos tutoriais de página, um elemento que não existe (lista vazia, sem permissão, só no computador…) salta-se
        const optional = step.optional ?? (!!guide?.path && !!step.target && step.advance !== "auto" && step.advance !== "click");
        targetRef.current = null;
        setBox(null);
        setMissing(false);
        const tick = () => {
            if (!alive) return;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            setVp((p) => (p.w === vw && p.h === vh ? p : { w: vw, h: vh }));
            const vv = window.visualViewport;
            const vis = vv ? { top: Math.round(vv.offsetTop), height: Math.round(vv.height) } : { top: 0, height: vh };
            setVisible((p) => (p.top === vis.top && p.height === vis.height ? p : vis));
            const kb = keyboardOpen(vh, vis);
            const el = step.target ? findTarget(step.target) : null;
            targetRef.current = el;
            if (el && el !== lastEl) {
                // o destaque mudou de elemento (ex.: o botão Mais → o item dentro do menu): volta a pô-lo à vista
                lastEl = el;
                scrolled = false;
            }
            if (el) {
                // um campo de outro passo ainda com o teclado aberto → fecha-o (senão o teclado tapa o passo novo)
                if (!blurred) {
                    blurred = true;
                    const a = document.activeElement as HTMLElement | null;
                    if (a && a !== document.body && !el.contains(a) && !rootRef.current?.contains(a) && a.matches("input, textarea, select, [contenteditable='true']")) a.blur();
                }
                const full = el.getBoundingClientRect();
                const r = clippedRect(el, full);
                const vTop = vis.top;
                const vBottom = vis.top + vis.height;
                if (!scrolled) {
                    scrolled = true;
                    const offV = full.top < vTop + 72 || full.bottom > vBottom - 96;
                    // escondido para o lado (ex.: no fim de uma faixa de filtros que desliza na horizontal)
                    const offH = r.width < Math.min(full.width, vw) - 2 || full.left < 0 || full.right > vw;
                    if (offV || offH) el.scrollIntoView({ block: offV ? (full.height > vis.height * 0.6 ? "start" : "center") : "nearest", inline: offH ? "center" : "nearest", behavior: "smooth" });
                }
                // o teclado abriu ou fechou e o elemento ficou fora do que se vê → volta a mostrá-lo
                if (kb !== lastKb) {
                    lastKb = kb;
                    if (r.bottom < vTop + 8 || r.top > vBottom - 8) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }
                const b = { top: r.top, left: r.left, width: r.width, height: r.height };
                setBox((p) => (sameBox(p, b) ? p : b));
                setMissing(false);
            } else {
                setBox((p) => (p === null ? p : null));
                const want = step.route || guide?.path;
                const onPage = !want || routeMatches(want, window.location.pathname, window.location.search);
                if (onPage && !onPageAt) { onPageAt = Date.now(); if (onPageAt - t0 < 50) grace = 300; }
                if (optional && onPageAt && Date.now() - onPageAt > grace) {
                    alive = false;
                    if (dirRef.current === -1 && index > 0) prev();
                    else next();
                    return;
                }
                if (step.target && Date.now() - t0 > 2500) setMissing(true);
            }
            raf = requestAnimationFrame(tick);
        };
        tick();
        return () => {
            alive = false;
            cancelAnimationFrame(raf);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepKey]);

    // passa sozinho quando a condição se cumpre (ex.: o produto entrou no carrinho). Com `settle`, espera que a
    // pessoa pare de escrever: antes, uma letra bastava para o guia saltar e fechar o teclado a meio da palavra.
    useEffect(() => {
        if (!step?.done) return;
        let lastTyped = 0;
        const typed = () => { lastTyped = Date.now(); };
        document.addEventListener("input", typed, true);
        const id = window.setInterval(() => {
            try {
                if (step.settle && Date.now() - lastTyped < step.settle) return;
                if (step.done!()) next();
            } catch {
                /* condição falhou: espera pelo botão */
            }
        }, 250);
        return () => { window.clearInterval(id); document.removeEventListener("input", typed, true); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepKey, next]);

    // passa quando se toca no elemento destacado
    useEffect(() => {
        if (step?.advance !== "click") return;
        const on = (e: Event) => {
            const t = targetRef.current;
            if (t && e.target instanceof Node && t.contains(e.target)) window.setTimeout(next, 150);
        };
        document.addEventListener("click", on, true);
        return () => document.removeEventListener("click", on, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepKey, next]);

    // Esc sai do guia
    useEffect(() => {
        if (!st) return;
        const on = (e: KeyboardEvent) => { if (e.key === "Escape") quit(); };
        window.addEventListener("keydown", on);
        return () => window.removeEventListener("keydown", on);
    }, [st, quit]);

    // As janelas (Radix) escondem do leitor de ecrã tudo o que está fora delas (aria-hidden) — o guia tem de continuar
    // acessível, porque é ele que diz o que fazer.
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const clean = () => { if (el.getAttribute("aria-hidden")) el.removeAttribute("aria-hidden"); if (el.hasAttribute("inert")) el.removeAttribute("inert"); };
        clean();
        const mo = new MutationObserver(clean);
        mo.observe(el, { attributes: true, attributeFilter: ["aria-hidden", "inert"] });
        return () => mo.disconnect();
    }, [stepKey, mounted]);

    // mede o balão para o pôr no sítio certo (só muda o estado se a altura mudar de facto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const h = popRef.current?.offsetHeight;
        if (h && Math.abs(h - popH) > 4) setPopH(h);
    });

    if (!mounted || !guide || !step) return null;

    const hole = box ? holeFor(box, vp.w, vp.h) : null;
    // passo opcional ainda à procura do elemento: não mostra o balão (ou aparece, ou o passo é saltado)
    const optionalNow = step.optional ?? (!!guide.path && !!step.target && step.advance !== "auto" && step.advance !== "click");
    const searching = optionalNow && !hole;
    const place = placePopover(hole, vp.w, vp.h, popH, 360, visible);
    const kbOpen = keyboardOpen(vp.h, visible);
    const action = (step.advance === "click" || step.advance === "auto") && !missing && !!step.target;
    const last = index >= total - 1;
    // As janelas (Radix) fecham-se com um toque fora delas: o toque no guia não pode chegar ao documento.
    const keep = (e: React.SyntheticEvent) => e.stopPropagation();
    // Tocar nos botões do balão não tira o foco ao campo (o teclado não fecha e o ecrã não salta).
    const keepFocus = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
    // passo "abra pelo menu" no telemóvel: primeiro o destaque está no botão Mais
    const hintNow = targetRef.current?.dataset.tour === "nav-more" ? "Toque em Mais" : step.hint || "Aqui";
    const badgeTop = hole ? (hole.top > 44 ? hole.top - 34 : hole.top + hole.height + 8) : 0;

    return createPortal(
        <div ref={rootRef} className="contents" data-guide-overlay onPointerDown={keep} onMouseDown={keep} onTouchStart={keep} onClick={keep}>
            {hole
                ? shadesAround(hole, vp.w, vp.h).map((s, k) => <div key={k} className="pointer-events-auto fixed z-[300] bg-slate-950/70" style={s} />)
                : <div className="pointer-events-auto fixed inset-0 z-[300] bg-slate-950/70" />}
            {hole && (
                <div aria-hidden className="pointer-events-none fixed z-[301] rounded-xl ring-4 ring-primary shadow-[0_0_0_8px_rgba(59,130,246,0.25)] motion-safe:animate-pulse" style={hole} />
            )}
            {hole && action && (
                <div aria-hidden className="pointer-events-none fixed z-[301] rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-lg motion-safe:animate-bounce" style={{ top: badgeTop, left: Math.min(Math.max(8, hole.left + 8), vp.w - 180) }}>
                    👆 {hintNow}
                </div>
            )}
            {!searching && <div
                ref={popRef}
                role="dialog"
                aria-modal="false"
                aria-label={step.title}
                data-guide-popover
                onMouseDown={keepFocus}
                className={cn("pointer-events-auto fixed z-[302] overflow-y-auto overscroll-contain rounded-2xl border border-primary/30 bg-card text-card-foreground shadow-2xl", kbOpen ? "p-3" : "p-4")}
                style={{ top: place.top, bottom: place.bottom, left: place.left, width: place.width, maxHeight: Math.max(120, visible.height - 16) }}
            >
                <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-semibold uppercase tracking-wide text-primary">
                        <GraduationCap className="h-3.5 w-3.5 shrink-0" /> {guide.title} · {index + 1} de {total}
                    </p>
                    <button type="button" onClick={quit} aria-label="Sair do guia" className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
                </div>
                <h3 className="mt-2.5 text-base font-bold leading-snug">{step.title}</h3>
                <div className="mt-1 space-y-1.5 text-sm text-muted-foreground [&_b]:text-foreground">{step.body}</div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={prev} disabled={index === 0} className="px-2">
                        <ChevronLeft className="mr-0.5 h-4 w-4" /> Anterior
                    </Button>
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                        {step.cta && (
                            <Button
                                type="button"
                                size="sm"
                                variant={action ? "default" : "outline"}
                                onClick={() => {
                                    const cta = step.cta!;
                                    markGuideDone(guide.id);
                                    if (cta.guide && GUIDES[cta.guide]) guideStore.start(cta.guide);
                                    else {
                                        guideStore.stop();
                                        if (cta.href) router.push(cta.href);
                                    }
                                }}
                            >
                                {step.cta.label}
                            </Button>
                        )}
                        {action ? (
                            <span className="text-sm font-semibold text-primary motion-safe:animate-pulse">{targetRef.current ? hintNow : step.hint || "Faça no ecrã"}</span>
                        ) : (
                            <Button type="button" size="sm" onClick={next}>
                                {last ? (guide.next ? "Continuar" : "Terminar") : "Seguinte"}
                            </Button>
                        )}
                    </div>
                </div>
                {action && (
                    <button type="button" onClick={next} className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:underline">
                        Saltar este passo
                    </button>
                )}
            </div>}
        </div>,
        document.body,
    );
}
