"use client";

// "Puxar para atualizar" da própria app. O do Chrome recarregava a app inteira (círculo azul, animação de carregar,
// menu e avatar a piscar) só para ir buscar dados que já chegam sozinhos em tempo real. Este não recarrega: refaz a
// ligação ao servidor (resolve as vezes em que a ligação do telemóvel fica "presa") e só diz "Atualizado" quando o
// servidor confirma as vendas e os produtos (~1 s). O indicador mostra o objecto da página (carrinho nas vendas,
// armazém nos produtos, camião nas entregas, betoneira na produção, portátil nos números): os que andam entram
// enquanto se puxa e correm ao largar; o portátil abre e o armazém levanta a porta. Só no topo da página, nunca com uma janela aberta nem dentro de uma lista já com scroll; o deslizar para os lados
// (entre páginas, swipe-nav) continua a ser dele.
import { useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { collection, disableNetwork, enableNetwork, onSnapshot, type Firestore, type Unsubscribe } from "firebase/firestore";
import { Check, WifiOff } from "lucide-react";
import { useFirestore } from "@/firebase/provider";
import { InventoryContext } from "@/context/inventory-context";
import { cn } from "@/lib/utils";
import { PULL_MAX, PULL_START, PULL_TRIGGER, isPullDown, pullDistance, pullObjectFor, refreshMessage, type PullObject, type RefreshResult } from "@/lib/pull-refresh";

const BLOCK = 'input, textarea, select, canvas, [data-no-pull], [role="slider"]';
const OPEN = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-vaul-drawer]';
/** quanto tempo fica a mensagem no fim */
const SHOW_MS = 1300;
/** o indicador escondido fica por baixo do cabeçalho */
const HIDDEN = -56;

/** dentro de uma lista com scroll que não está no topo: o gesto é dela */
const scrolledInside = (el: HTMLElement | null): boolean => {
    for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
        if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight + 2) {
            const oy = getComputedStyle(n).overflowY;
            if (oy === "auto" || oy === "scroll") return true;
        }
    }
    return false;
};

const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

/**
 * Espera que o servidor confirme as vendas e os produtos. São as mesmas colecções que a app já tem abertas
 * (core.ts): o Firestore partilha a escuta, por isso não há leituras a mais. O `onSnapshotsInSync` não servia: só
 * avisa quando alguma lista muda, e sem novidades no servidor ficava à espera para nada.
 */
function serverConfirmed(firestore: Firestore, companyId: string, stops: Unsubscribe[]) {
    return Promise.all(["products", "sales"].map((name) => new Promise<void>((resolve) => {
        stops.push(onSnapshot(collection(firestore, `companies/${companyId}/${name}`), { includeMetadataChanges: true },
            (snap) => { if (!snap.metadata.fromCache) resolve(); },
            () => resolve())); // sem permissão para essa lista (ex.: funcionário sem vendas): não conta
    })));
}

export function PullToRefresh() {
    const firestore = useFirestore();
    const companyId = useContext(InventoryContext)?.companyId;
    const isGuest = !!useContext(InventoryContext)?.isGuest;
    const box = useRef<HTMLDivElement>(null);
    const obj = useRef<HTMLDivElement>(null);
    const busy = useRef(false);
    const [phase, setPhase] = useState<"idle" | "refreshing" | RefreshResult>("idle");
    const kind = pullObjectFor(usePathname() || "");
    const { Svg, drives } = OBJECTS[kind];
    const drivesRef = useRef(drives);
    drivesRef.current = drives;

    const place = (y: number, animate: boolean) => {
        const el = box.current;
        if (!el) return;
        el.style.transition = animate ? "transform .3s cubic-bezier(.22,1,.36,1), opacity .3s" : "none";
        el.style.transform = `translate3d(-50%,${y}px,0)`;
        el.style.opacity = y <= HIDDEN ? "0" : String(Math.min(1, (y - HIDDEN) / 50));
    };

    const refresh = async () => {
        busy.current = true;
        setPhase("refreshing");
        place(PULL_TRIGGER + HIDDEN + 40, true);
        const started = Date.now();
        // a partir daqui mandam as animações (a correr, a abrir…)
        if (obj.current) { obj.current.style.transform = ""; obj.current.style.setProperty("--msx-ptr-k", "1"); }
        let result: RefreshResult = "updated";
        if (!navigator.onLine) result = "offline";
        else {
            const stops: Unsubscribe[] = [];
            try {
                // refaz a ligação (as listas voltam a sincronizar sozinhas) e espera que o servidor as confirme
                // convidado: os dados estão no aparelho, não há servidor a confirmar
                if (!isGuest) {
                    await disableNetwork(firestore);
                    await enableNetwork(firestore);
                }
                if (companyId && !isGuest) await Promise.race([serverConfirmed(firestore, companyId, stops), timeout(10000)]);
            } catch {
                result = navigator.onLine ? "unreachable" : "offline";
                enableNetwork(firestore).catch(() => {});
            } finally {
                stops.forEach((stop) => stop());
            }
        }
        // não piscar: o "A atualizar…" fica pelo menos meio segundo
        await new Promise((r) => setTimeout(r, Math.max(0, 500 - (Date.now() - started))));
        setPhase(result);
        await new Promise((r) => setTimeout(r, result === "updated" ? SHOW_MS : SHOW_MS * 2));
        place(HIDDEN, true);
        setTimeout(() => { setPhase("idle"); busy.current = false; }, 300);
    };
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;

    useEffect(() => {
        // desliga o "puxar para atualizar" do navegador (recarregava a app): este faz o mesmo sem recarregar
        const html = document.documentElement, body = document.body;
        html.style.overscrollBehaviorY = "contain";
        body.style.overscrollBehaviorY = "contain";

        let sx = 0, sy = 0, mode: "idle" | "wait" | "pull" = "idle", dist = 0;
        const move = (e: TouchEvent) => {
            if (mode === "idle") return;
            const t = e.touches[0];
            const dx = t.clientX - sx, dy = t.clientY - sy;
            if (mode === "wait") {
                if (isPullDown(dx, dy)) mode = "pull";
                else if (Math.abs(dx) > PULL_START || dy < -PULL_START) { stop(); return; }
                else return;
            }
            if (e.cancelable) e.preventDefault();
            dist = pullDistance(dy);
            place(HIDDEN + dist, false);
            box.current?.toggleAttribute("data-ready", dist >= PULL_TRIGGER);
            // os que andam entram da esquerda à medida que se puxa (as rodas giram com a distância); os outros crescem
            // e abrem (--msx-ptr-k: tampa do portátil, porta do armazém)
            const c = obj.current;
            if (c) {
                const k = Math.min(1, dist / PULL_TRIGGER);
                c.style.transform = drivesRef.current
                    ? `translate3d(${(k - 1) * 46}px,0,0) rotate(${dist >= PULL_TRIGGER ? -4 : 0}deg)`
                    : `scale(${0.6 + 0.4 * k})`;
                c.style.setProperty("--msx-ptr-k", String(k));
                c.style.setProperty("--msx-ptr-turn", `${(dist / PULL_MAX) * 720}deg`);
            }
        };
        const stop = () => {
            mode = "idle";
            window.removeEventListener("touchmove", move);
        };
        const down = (e: TouchEvent) => {
            if (busy.current || e.touches.length !== 1 || window.scrollY > 0) return;
            const target = e.target as HTMLElement;
            if (target.closest(BLOCK) || document.querySelector(OPEN) || document.body.hasAttribute("data-scroll-locked") || scrolledInside(target)) return;
            sx = e.touches[0].clientX; sy = e.touches[0].clientY; dist = 0; mode = "wait";
            // só escuta o arrastar quando pode ser puxar para atualizar (não pesa no scroll do resto da app)
            window.addEventListener("touchmove", move, { passive: false });
        };
        const up = () => {
            const was = mode;
            stop();
            if (was !== "pull") return;
            box.current?.removeAttribute("data-ready");
            if (dist >= PULL_TRIGGER) refreshRef.current();
            else place(HIDDEN, true);
        };

        window.addEventListener("touchstart", down, { passive: true });
        window.addEventListener("touchend", up, { passive: true });
        window.addEventListener("touchcancel", up, { passive: true });
        return () => {
            stop();
            window.removeEventListener("touchstart", down);
            window.removeEventListener("touchend", up);
            window.removeEventListener("touchcancel", up);
            html.style.overscrollBehaviorY = "";
            body.style.overscrollBehaviorY = "";
        };
    }, []);

    const label = phase === "refreshing" ? "A atualizar…" : phase === "idle" ? "" : refreshMessage(phase);
    const failed = phase === "offline" || phase === "unreachable";
    return (
        <div
            ref={box}
            data-testid="pull-refresh"
            data-phase={phase}
            className="msx-ptr pointer-events-none fixed left-1/2 z-[29] flex flex-col items-center gap-2"
            style={{ top: "calc(env(safe-area-inset-top) + 64px)", transform: `translate3d(-50%,${HIDDEN}px,0)`, opacity: 0 }}
            role="status"
            aria-live="polite"
        >
            <style dangerouslySetInnerHTML={{ __html: PTR_CSS }} />
            <div className="relative flex h-11 w-[120px] items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-background shadow-xl ring-4 ring-background/60">
                {failed ? <WifiOff className="h-5 w-5 text-amber-500" /> : (
                    // a pista: o que anda some suavemente nas pontas (a máscara fica aqui dentro, o fundo do cartão fica sólido)
                    <div className={cn("absolute inset-0 flex items-center justify-center", drives && "msx-ptr-road")}>
                        <div ref={obj} key={kind} data-testid="pull-object" data-kind={kind} className={cn("msx-ptr-obj relative", drives ? "msx-ptr-drives" : "msx-ptr-stays")}
                            style={{ transform: drives ? "translate3d(-46px,0,0)" : "scale(.6)" }}>
                            <Svg />
                            {phase === "updated" && (
                                <span className="msx-ptr-ok absolute -right-3 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {label && <span className={cn("rounded-full border border-primary/20 bg-background px-3 py-1 text-xs font-semibold shadow-lg", failed ? "text-amber-600" : "text-foreground")}>{label}</span>}
        </div>
    );
}

// Os que andam: atravessam a pista enquanto esperam pelo servidor e no fim travam ao centro. O portátil e o armazém
// ficam ao centro: as barras crescem e a porta sobe e desce. No fim, o visto verde.
const PTR_CSS = `@keyframes msx-ptr-run{0%{transform:translate3d(-62px,0,0) rotate(-3deg)}100%{transform:translate3d(62px,0,0) rotate(-3deg)}}
@keyframes msx-ptr-brake{0%{transform:translate3d(-40px,0,0) rotate(-3deg)}70%{transform:translate3d(4px,0,0) rotate(4deg)}100%{transform:translate3d(0,0,0) rotate(0)}}
@keyframes msx-ptr-settle{0%{transform:scale(1)}40%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes msx-ptr-spin{to{transform:rotate(360deg)}}
@keyframes msx-ptr-pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes msx-ptr-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
@keyframes msx-ptr-bar{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@keyframes msx-ptr-door{0%,100%{transform:scaleY(.85)}50%{transform:scaleY(.2)}}
.msx-ptr-road{-webkit-mask-image:linear-gradient(90deg,transparent 4%,#000 26%,#000 74%,transparent 96%);mask-image:linear-gradient(90deg,transparent 4%,#000 26%,#000 74%,transparent 96%)}
.msx-ptr-obj{--msx-ink:#253238;--msx-ink-2:#3a4a52;will-change:transform}
.dark .msx-ptr-obj{--msx-ink:#cbd5e1;--msx-ink-2:#94a3b8}
.msx-ptr-wheel,.msx-ptr-drum{transform-box:fill-box;transform-origin:center;transform:rotate(var(--msx-ptr-turn,0deg))}
.msx-ptr-speed{opacity:0}
.msx-ptr-lid{transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(calc(.08 + .92 * var(--msx-ptr-k,0)))}
.msx-ptr-bar{transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(var(--msx-ptr-k,0))}
.msx-ptr-door{transform-box:fill-box;transform-origin:50% 0;transform:scaleY(calc(1 - .7 * var(--msx-ptr-k,0)))}
.msx-ptr[data-phase=refreshing] .msx-ptr-drives{animation:msx-ptr-run .75s linear infinite}
.msx-ptr[data-phase=refreshing] .msx-ptr-wheel,.msx-ptr[data-phase=refreshing] .msx-ptr-drum{animation:msx-ptr-spin .3s linear infinite}
.msx-ptr[data-phase=refreshing] .msx-ptr-drum{animation-duration:.6s}
.msx-ptr[data-phase=refreshing] .msx-ptr-speed{opacity:.9}
.msx-ptr[data-phase=refreshing] .msx-ptr-load{animation:msx-ptr-bounce .25s ease-in-out infinite}
.msx-ptr[data-phase=refreshing] .msx-ptr-bar{animation:msx-ptr-bar .6s ease-in-out infinite}
.msx-ptr[data-phase=refreshing] .msx-ptr-bar:nth-of-type(2){animation-delay:-.15s}
.msx-ptr[data-phase=refreshing] .msx-ptr-bar:nth-of-type(3){animation-delay:-.3s}
.msx-ptr[data-phase=refreshing] .msx-ptr-bar:nth-of-type(4){animation-delay:-.45s}
.msx-ptr[data-phase=refreshing] .msx-ptr-door{animation:msx-ptr-door .9s ease-in-out infinite}
.msx-ptr[data-phase=updated] .msx-ptr-drives{animation:msx-ptr-brake .45s cubic-bezier(.12,.75,.3,1) both}
.msx-ptr[data-phase=updated] .msx-ptr-stays{animation:msx-ptr-settle .4s ease-out both}
.msx-ptr-ok{animation:msx-ptr-pop .3s cubic-bezier(.34,1.56,.64,1) .3s both}`;

const GRAD = (
    <defs>
        <linearGradient id="msx-ptr-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#f8ad00" /><stop offset=".4" stopColor="#e13333" /><stop offset=".72" stopColor="#7c6cae" /><stop offset="1" stopColor="#3992fe" />
        </linearGradient>
    </defs>
);
const INK = { fill: "var(--msx-ink)" }, INK_STROKE = { stroke: "var(--msx-ink)" };
const Speed = () => <g className="msx-ptr-speed" stroke="#9aa4ad" strokeWidth="5" strokeLinecap="round"><path d="M-4 32h-22" /><path d="M0 46h-28" /></g>;
const Wheel = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
    <g className="msx-ptr-wheel">
        <circle cx={cx} cy={cy} r={r} style={INK} />
        <path d={`M${cx - r * 0.75} ${cy}h${r * 1.5}`} stroke="#fff" strokeWidth="2.2" opacity=".75" />
    </g>
);

/** os desenhos do ecrã de carregamento (app-loader.tsx) e do cartão da produção (progress-haul.tsx), em pequeno */
function MiniCart() {
    return (
        <svg viewBox="-30 0 150 80" width="54" height="29" className="overflow-visible" aria-hidden>
            {GRAD}<Speed />
            <rect x="38" y="12" width="17" height="16" rx="2" fill="#f8ad00" />
            <rect x="58" y="6" width="14" height="22" rx="2" fill="#e13333" />
            <circle cx="86" cy="19" r="9" fill="#3992fe" />
            <path d="M6 12h13l11 42" fill="none" style={INK_STROKE} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 24h88l-11 30H33z" fill="url(#msx-ptr-grad)" />
            <path d="M31 56l-2 8h72" fill="none" style={INK_STROKE} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
            <Wheel cx={36} cy={71} r={8} /><Wheel cx={90} cy={71} r={8} />
        </svg>
    );
}

function MiniTruck() {
    return (
        <svg viewBox="-30 0 150 80" width="54" height="29" className="overflow-visible" aria-hidden>
            {GRAD}<Speed />
            <g className="msx-ptr-load">
                <rect x="4" y="12" width="72" height="47" rx="4" fill="url(#msx-ptr-grad)" />
                <g fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="3" strokeLinejoin="round"><path d="M30 28h20v16H30z" /><path d="M40 28v16" /></g>
                <path d="M78 28h20l15 15v16H78z" style={INK} />
                <path d="M84 33h12l10 10H84z" fill="#cfe3ff" />
                <rect x="4" y="57" width="110" height="5" rx="2" style={INK} />
            </g>
            <Wheel cx={26} cy={67} r={10} /><Wheel cx={95} cy={67} r={10} />
        </svg>
    );
}

function MiniMixer() {
    return (
        <svg viewBox="-18 0 90 56" width="50" height="31" className="overflow-visible" aria-hidden>
            {GRAD}
            <defs><clipPath id="msx-ptr-drum-clip"><ellipse cx="28" cy="25" rx="19" ry="14" /></clipPath></defs>
            <g className="msx-ptr-speed" stroke="#9aa4ad" strokeWidth="3" strokeLinecap="round"><path d="M2 22h-14" /><path d="M4 32h-18" /></g>
            <g className="msx-ptr-load">
                <ellipse cx="28" cy="25" rx="19" ry="14" fill="url(#msx-ptr-grad)" />
                <g clipPath="url(#msx-ptr-drum-clip)">
                    <g className="msx-ptr-drum">
                        {[-24, -12, 0, 12, 24].map((o) => <path key={o} d={`M${28 + o - 20} 45 L${28 + o + 20} 5`} stroke="#fff" strokeOpacity=".45" strokeWidth="3.5" />)}
                        <circle cx="28" cy="25" r="30" fill="none" />
                    </g>
                </g>
                <path d="M45 18 l6 -4" style={INK_STROKE} strokeWidth="3" strokeLinecap="round" />
                <path d="M50 22 H61 L69 31 V41 H50 Z" style={INK} />
                <path d="M54 25 H60 L65 31 H54 Z" fill="#cfe3ff" />
                <rect x="7" y="40" width="63" height="4" rx="1.5" style={INK} />
            </g>
            <Wheel cx={20} cy={49} r={6} /><Wheel cx={58} cy={49} r={6} />
        </svg>
    );
}

function MiniLaptop() {
    return (
        <svg viewBox="0 0 120 80" width="44" height="29" className="overflow-visible" aria-hidden>
            {GRAD}
            <g className="msx-ptr-lid">
                <rect x="20" y="10" width="80" height="54" rx="5" style={INK} />
                <rect x="25" y="15" width="70" height="44" rx="2" fill="url(#msx-ptr-grad)" />
                <g>
                    {[[33, 12], [47, 22], [61, 16], [75, 30]].map(([x, h]) => (
                        <rect key={x} className="msx-ptr-bar" x={x} y={54 - h} width="9" height={h} rx="1.5" fill="#fff" fillOpacity=".92" />
                    ))}
                </g>
            </g>
            <path d="M4 66h112l-7 9H11z" style={{ fill: "var(--msx-ink-2)" }} />
            <rect x="48" y="66" width="24" height="3" rx="1.5" fill="#22303a" />
        </svg>
    );
}

function MiniWarehouse() {
    return (
        <svg viewBox="0 0 120 80" width="44" height="29" className="overflow-visible" aria-hidden>
            {GRAD}
            <path d="M10 34L60 9l50 25v44H10z" fill="url(#msx-ptr-grad)" />
            <path d="M4 37L60 7l56 30" fill="none" style={INK_STROKE} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="60" cy="25" r="5" fill="#fff" fillOpacity=".85" />
            <rect x="33" y="43" width="54" height="35" fill="#1f2a30" />
            <rect x="37" y="63" width="15" height="15" rx="1.5" fill="#f8ad00" />
            <rect x="54" y="63" width="15" height="15" rx="1.5" fill="#e13333" />
            <rect x="71" y="64" width="13" height="14" rx="1.5" fill="#7c6cae" />
            <rect x="45" y="49" width="15" height="14" rx="1.5" fill="#3992fe" />
            <g className="msx-ptr-door">
                <rect x="33" y="43" width="54" height="35" fill="#e8eef3" />
                <path d="M33 49h54M33 55h54M33 61h54M33 67h54M33 73h54" stroke="#c4ced6" strokeWidth="1.6" />
            </g>
        </svg>
    );
}

const OBJECTS: Record<PullObject, { Svg: () => React.JSX.Element; drives: boolean }> = {
    cart: { Svg: MiniCart, drives: true },
    truck: { Svg: MiniTruck, drives: true },
    mixer: { Svg: MiniMixer, drives: true },
    laptop: { Svg: MiniLaptop, drives: false },
    warehouse: { Svg: MiniWarehouse, drives: false },
};
