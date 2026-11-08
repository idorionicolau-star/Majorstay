"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useNavTabs } from "@/components/layout/bottom-nav";

/**
 * Mudar de página com um swipe horizontal (só no telemóvel), pela mesma ordem da barra de baixo.
 *
 * - O gesto só conta quando é claramente horizontal; antes disso o scroll vertical manda.
 * - Não arranca dentro de tabelas/carrosséis (que rolam na horizontal), campos de texto, janelas abertas,
 *   nem nas margens do ecrã (gesto de "voltar" do navegador). Também se pode excluir com `data-no-swipe`.
 * - A página acompanha o dedo e sai/entra por transform (placa gráfica). A nova começa SEMPRE no topo
 *   (ou onde o utilizador a deixou da última vez), nunca herda o scroll da anterior.
 * - Só funciona nas páginas-raiz dos separadores; em subpáginas (formulários, editor) fica desligado.
 */
const EDGE = 24;          // px das margens, reservadas ao gesto do navegador
const START = 12;         // px até decidir a direcção
const RATIO = 1.8;        // quanto mais horizontal que vertical
const COMMIT = 0.25;      // fracção da largura que decide a troca
const FLICK = 0.55;       // px/ms: um gesto rápido também troca
const OUT_MS = 170;
const IN_MS = 230;
const BLOCK = 'input, textarea, select, canvas, table, [data-no-swipe], [role="slider"], [data-radix-scroll-area-viewport]';

const POS_KEY = "msx-swipe-pos";
const DIR_KEY = "msx-swipe-dir";
const readPositions = (): Record<string, number> => { try { return JSON.parse(sessionStorage.getItem(POS_KEY) || "{}"); } catch { return {}; } };
const savePositions = (p: Record<string, number>) => { try { sessionStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* sem armazenamento */ } };

const scrollsSideways = (el: HTMLElement | null): boolean => {
    for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 2) {
            const ox = getComputedStyle(n).overflowX;
            if (ox === "auto" || ox === "scroll") return true;
        }
    }
    return false;
};

export function SwipeNav({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const tabs = useNavTabs();
    const box = useRef<HTMLDivElement>(null);
    const positions = useRef<Record<string, number>>({});
    const entered = useRef(false);
    const pathRef = useRef(pathname);
    const pending = useRef<{ dir: 1 | -1; timer: number } | null>(null);
    const hrefs = tabs.map((t) => t.href).join("|");
    const index = tabs.findIndex((t) => t.href === pathname);

    // guarda o scroll de cada página-raiz para o devolver quando se voltar a ela
    useEffect(() => {
        let last = window.scrollY;
        const onScroll = () => {
            const y = window.scrollY;
            // um salto brusco para o topo é o próprio Next a repor o scroll na página nova, não o utilizador
            if (!(y === 0 && last > 200)) positions.current[pathRef.current] = y;
            last = y;
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const slideIn = useCallback((dir: 1 | -1) => {
        const el = box.current;
        if (!el) return;
        el.style.transition = "none";
        el.style.transform = `translate3d(${dir * 100}%,0,0)`;
        void el.offsetWidth; // fixa a posição inicial antes de animar
        el.style.transition = `transform ${IN_MS}ms cubic-bezier(.22,.8,.3,1)`;
        el.style.transform = "translate3d(0,0,0)";
        window.setTimeout(() => { el.style.transition = ""; el.style.transform = ""; }, IN_MS + 30);
    }, []);

    // ao mudar de página: scroll certo e, se veio de um swipe, a entrada animada
    useEffect(() => {
        pathRef.current = pathname;
        // primeira carga desta instância: recupera o que a página anterior guardou (navegação completa, sem rede)
        if (!entered.current) {
            entered.current = true;
            positions.current = { ...readPositions(), ...positions.current };
        }
        const saved = tabs.some((t) => t.href === pathname) ? positions.current[pathname] ?? 0 : 0;
        // a página pode ainda estar a carregar (curta demais para esse scroll): insiste até 1,5 s
        window.scrollTo(0, saved);
        if (saved > 0) {
            const t0 = performance.now();
            const again = () => {
                if (pathRef.current !== pathname || Math.abs(window.scrollY - saved) < 2 || performance.now() - t0 > 1500) return;
                window.scrollTo(0, saved);
                requestAnimationFrame(again);
            };
            requestAnimationFrame(again);
        }
        let dir: 1 | -1 | 0 = 0;
        const p = pending.current;
        if (p) { window.clearTimeout(p.timer); pending.current = null; dir = p.dir; }
        else { try { const d = sessionStorage.getItem(DIR_KEY); if (d) { sessionStorage.removeItem(DIR_KEY); dir = d === "1" ? 1 : -1; } } catch { /* ignore */ } }
        if (dir) slideIn(dir);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    // páginas vizinhas já carregadas: a troca fica imediata
    useEffect(() => {
        if (index < 0 || !navigator.onLine) return;
        [tabs[index - 1], tabs[index + 1]].forEach((t) => t && router.prefetch(t.href));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, hrefs]);

    const reset = useCallback((animate: boolean) => {
        const el = box.current;
        if (!el) return;
        el.style.transition = animate ? `transform ${OUT_MS}ms ease-out` : "";
        el.style.transform = animate ? "translate3d(0,0,0)" : "";
        if (animate) window.setTimeout(() => { el.style.transition = ""; el.style.transform = ""; }, OUT_MS + 30);
    }, []);

    useEffect(() => {
        const el = box.current;
        if (!el || index < 0) return;
        const mq = window.matchMedia("(max-width: 767px)");
        if (!mq.matches) return;

        let sx = 0, sy = 0, st = 0, mode: "idle" | "wait" | "h" | "v" = "idle", dx = 0;
        const canGo = (d: number) => !!tabs[index + d];

        const down = (e: TouchEvent) => {
            mode = "idle";
            if (e.touches.length !== 1 || pending.current) return;
            const t = e.touches[0];
            const target = e.target as HTMLElement;
            if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
            if (target.closest(BLOCK) || scrollsSideways(target)) return;
            if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
            sx = t.clientX; sy = t.clientY; st = e.timeStamp; dx = 0; mode = "wait";
        };
        const move = (e: TouchEvent) => {
            if (mode === "idle" || mode === "v") return;
            const t = e.touches[0];
            const mx = t.clientX - sx, my = t.clientY - sy;
            if (mode === "wait") {
                if (Math.abs(my) > START && Math.abs(my) * RATIO > Math.abs(mx)) { mode = "v"; return; } // é scroll vertical
                if (Math.abs(mx) > START && Math.abs(mx) > Math.abs(my) * RATIO) { mode = "h"; el.style.transition = "none"; }
                else return;
            }
            if (e.cancelable) e.preventDefault();
            // sem página desse lado: resistência, para não parecer partido
            dx = canGo(mx < 0 ? 1 : -1) ? mx : mx * 0.25;
            el.style.transform = `translate3d(${dx}px,0,0)`;
        };
        const up = (e: TouchEvent) => {
            if (mode !== "h") { mode = "idle"; return; }
            mode = "idle";
            const dir = (dx < 0 ? 1 : -1) as 1 | -1; // 1 = próxima página
            const speed = Math.abs(dx) / Math.max(1, e.timeStamp - st);
            const far = Math.abs(dx) > window.innerWidth * COMMIT || speed > FLICK;
            if (!far || !canGo(dir)) { reset(true); return; }
            const next = tabs[index + dir];
            positions.current[pathname] = window.scrollY;
            el.style.transition = `transform ${OUT_MS}ms ease-in`;
            el.style.transform = `translate3d(${-dir * 100}%,0,0)`;
            // sem rede o router do Next não navega: usa uma navegação normal, servida pela cópia guardada
            const hardGo = () => { try { sessionStorage.setItem(DIR_KEY, String(dir)); } catch { /* ignore */ } savePositions(positions.current); window.location.assign(next.href); };
            if (!navigator.onLine) { window.setTimeout(hardGo, OUT_MS); return; }
            // rede a falhar sem o navegador saber: se a página não chegar a tempo, tenta a navegação normal
            pending.current = { dir, timer: window.setTimeout(() => { pending.current = null; hardGo(); }, 2500) };
            window.setTimeout(() => router.push(next.href), OUT_MS);
        };
        const cancel = () => { if (mode === "h") reset(true); mode = "idle"; };

        el.addEventListener("touchstart", down, { passive: true });
        el.addEventListener("touchmove", move, { passive: false });
        el.addEventListener("touchend", up, { passive: true });
        el.addEventListener("touchcancel", cancel, { passive: true });
        return () => {
            el.removeEventListener("touchstart", down);
            el.removeEventListener("touchmove", move);
            el.removeEventListener("touchend", up);
            el.removeEventListener("touchcancel", cancel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, hrefs, reset, router, pathname]);

    return <div ref={box} className="main-content p-4 pb-24 sm:p-6 md:p-8 md:pb-8">{children}</div>;
}
