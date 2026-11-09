"use client";

import { useEffect, useRef, useState } from "react";
import { LOGO_MAJOR, LOGO_STOCKX } from "./intro-logo";
import { APP_READY_EVENT, isAppReady } from "@/lib/app-ready";
import { INTRO_AT_KEY, INTRO_KEY, INTRO_PLAY_EVENT } from "@/lib/intro-gate";
import { BootProgress } from "@/components/layout/boot-progress";
import { BRAND } from "@/lib/brand";

/**
 * Animação de entrada MajorStay (hotelaria, lodges e guest houses).
 * Os quatro pilares da gestão hoteleira:
 * Quartos (terracota nobre), Reservas (ouro champagne), Bar & Consumos (âmbar quente) e Caixa (bronze).
 * Juntam-se ao centro e formam o emblema do MajorStay com o lema do sistema.
 */

const TERRACOTTA = "rgb(186,90,26)", GOLD = "rgb(223,158,66)", AMBER = "rgb(212,128,57)", BRONZE = "rgb(156,72,17)";

// momentos da animação (segundos)
const T = { quartos: 0.2, reservas: 0.75, bar: 1.3, caixa: 1.85, merge: 2.6, logo: 3.1, word2: 3.8, shine: 4.55, slogan: 4.6, out: 5.35 };
/** cada palavra: a onda revela-a à frente, cresce devagar, recua e assenta */
const WORD_TIME = 0.85;
/** intervalo entre letras na onda */
const WAVE = 0.045;
/** as duas palavras: letras, quando começam e o centro de cada uma */
const WORDS = [
    { glyphs: LOGO_MAJOR, at: T.logo, origin: "50.1% 37.9%" },
    { glyphs: LOGO_STOCKX, at: T.word2, origin: "49.9% 62.7%" },
];
/** quando cada palavra assenta no lugar */
const LANDS = WORDS.map((w) => w.at + WORD_TIME * 0.82);
/** quanto dura a viagem dos pilares para o centro */
const MOVE = 0.6;
/** margem à volta de cada letra para caber a sombra */
const PAD = 20;
/** nunca segurar o ecrã mais do que isto */
const MAX_WAIT = 15;
/** o degradê do círculo do logótipo (terracota nobre para ouro champagne) */
const LOGO_GRADIENT = "linear-gradient(45deg, rgb(186,90,26) 15%, rgb(223,158,66) 50%, rgb(201,121,32) 72%, rgb(124,50,10) 85%)";

const SPRING = "cubic-bezier(.34,1.56,.64,1)";
const OUT = "cubic-bezier(.22,1,.36,1)";
const pctOf = (t: number, total: number) => `${((t / total) * 100).toFixed(3)}%`;
const run = (name: string, dur: number, delay: number, ease = "ease-out") => `animation:${name} ${dur}s ${ease} ${delay}s both`;

// ---------- os quatro pilares de hotelaria ----------
const PILLARS = [
    { label: "Quartos", color: TERRACOTTA, at: T.quartos, left: "8%", top: "52%", to: ["85%", "-85%"] },
    { label: "Reservas", color: GOLD, at: T.reservas, left: "8%", top: "8%", to: ["85%", "85%"] },
    { label: "Bar", color: AMBER, at: T.bar, left: "52%", top: "52%", to: ["-85%", "-85%"] },
    { label: "Caixa", color: BRONZE, at: T.caixa, left: "52%", top: "8%", to: ["-85%", "85%"] },
] as const;
const pillarCss = PILLARS.map(({ at, to }, k) => {
    const dur = T.merge + MOVE - at, hold = pctOf(T.merge - at, dur);
    return `@keyframes msx-i-p${k}{0%{opacity:0;transform:translate(0,0) scale(.4);animation-timing-function:${SPRING}}${pctOf(0.45, dur)}{opacity:1;transform:translate(0,0) scale(1)}${hold}{opacity:1;transform:translate(0,0) scale(1);animation-timing-function:cubic-bezier(.6,0,.4,1)}100%{opacity:0;transform:translate(${to[0]},${to[1]}) scale(.5)}}
.msx-i-p${k}{${run(`msx-i-p${k}`, dur, at, "linear")}}`;
}).join("\n");

// ---------- palavras, letras e tremor ----------
const SHAKE_X = [0, -4, 3.6, -3, 2.3, -1.6, 0.9, -0.4, 0];
const SHAKE_Y = [0, 2.2, -2, 1.6, -1.2, 0.8, -0.5, 0.2, 0];
const SHAKE_R = [0, -0.6, 0.5, -0.4, 0.3, -0.2, 0.1, 0, 0];
const SHAKE_TIME = 0.42;
const SHAKE_START = LANDS[0];
const SHAKE_TOTAL = LANDS[LANDS.length - 1] + SHAKE_TIME - SHAKE_START;
const shakeFrames = LANDS.flatMap((l) => SHAKE_X.map((x, k) =>
    `${pctOf(l - SHAKE_START + (k * SHAKE_TIME) / (SHAKE_X.length - 1), SHAKE_TOTAL)}{transform:translate(${x}px,${SHAKE_Y[k]}px) rotate(${SHAKE_R[k]}deg);animation-timing-function:ease-in-out}`)).join("");
const wordCss = WORDS.map((w, wi) => `.msx-i-w${wi}{transform-origin:${w.origin};${run("msx-i-zoom", WORD_TIME, w.at, "linear")}}`
    + w.glyphs.map((_, i) => `.msx-i-l${wi}-${i}{${run("msx-i-letter", 0.3, w.at + i * WAVE, OUT)}}`).join("")).join("\n");

// pontinhos de ouro e terracota a subir no fundo
const DOTS = Array.from({ length: 16 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 100, c: [TERRACOTTA, GOLD, AMBER, BRONZE][i % 4], s: 3 + (i % 3) * 2, d: (i % 5) * 0.5 }));

const CSS = `
@keyframes msx-i-dot{0%{opacity:0;transform:translateY(0)}40%{opacity:.45}100%{opacity:0;transform:translateY(-60px)}}
@keyframes msx-i-fade{from{opacity:0}to{opacity:1}}
@keyframes msx-i-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes msx-i-drop{from{opacity:0;transform:translateY(-34px)}to{opacity:1;transform:translateY(0)}}
@keyframes msx-i-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes msx-i-pop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
@keyframes msx-i-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes msx-i-draw{from{stroke-dashoffset:1;opacity:0}10%{opacity:1}to{stroke-dashoffset:0;opacity:1}}
@keyframes msx-i-radar{from{opacity:.8;transform:scale(.5)}to{opacity:0;transform:scale(1.35)}}
@keyframes msx-i-glow{0%{opacity:0;transform:scale(.6)}60%{opacity:.55}100%{opacity:.35;transform:scale(1)}}
@keyframes msx-i-merge{from{opacity:0;transform:scale(0) rotate(-90deg)}to{opacity:1;transform:scale(1) rotate(0)}}
@keyframes msx-i-blob{from{transform:scale(.2)}to{transform:scale(1)}}
@keyframes msx-i-letter{from{opacity:0;transform:translateY(30%)}to{opacity:1;transform:translateY(0)}}
@keyframes msx-i-zoom{0%{transform:scale(1.3);animation-timing-function:ease-out}55%{transform:scale(1.38);animation-timing-function:cubic-bezier(.55,0,1,.45)}82%{transform:scale(.96);animation-timing-function:ease-out}100%{transform:scale(1)}}
@keyframes msx-i-shake{${shakeFrames}}
@keyframes msx-i-shine{from{transform:translateX(0) skewX(-12deg)}to{transform:translateX(510%) skewX(-12deg)}}
@keyframes msx-i-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
@keyframes msx-i-clock{from{opacity:0}to{opacity:0}}
.msx-intro{transition:opacity .45s ease-in-out,transform .45s ease-in-out}
.msx-intro.msx-i-out{opacity:0;transform:scale(1.04)}
.msx-i-dot{${run("msx-i-dot", 4, 0)}}
.msx-i-layer{will-change:transform,opacity}
.msx-i-box{transform-box:fill-box}
.msx-i-origin{transform-box:fill-box;transform-origin:center}
.msx-i-bar{transform-box:fill-box;transform-origin:50% 100%}
${pillarCss}
.msx-i-glow{${run("msx-i-glow", 0.8, T.merge + 0.2)}}
.msx-i-merge{${run("msx-i-merge", 0.75, T.merge + 0.2, SPRING)}}
.msx-i-blob{${run("msx-i-blob", 0.6, T.merge + 0.25)}}
.msx-i-exact{${run("msx-i-fade", 0.5, T.logo - 0.1, "ease-in-out")}}
${wordCss}
.msx-i-shake{${run("msx-i-shake", SHAKE_TOTAL, SHAKE_START, "linear")}}
.msx-i-shine{${run("msx-i-shine", 0.7, T.shine, "ease-in-out")}}
.msx-i-slogan{${run("msx-i-rise", 0.4, T.slogan)}}
.msx-i-wait .msx-i-logo{animation:msx-i-breathe 1.8s ease-in-out infinite}
.msx-i-clock{${run("msx-i-clock", T.out, 0, "linear")}}
`;

const at = (name: string, dur: number, delay: number, ease = "ease-out") => ({ animation: `${name} ${dur}s ${ease} ${delay}s both` });

/** Quartos: Cama de hotel boutique e cabeceira de suíte. */
function QuartosIcon() {
    const d = T.quartos + 0.1;
    return (
        <svg viewBox="0 0 48 48" className="h-[58%] w-[58%] overflow-visible">
            <g className="msx-i-box" style={at("msx-i-drop", 0.5, d, SPRING)}>
                <path d="M6 18 C6 15 9 13 13 13 L35 13 C39 13 42 15 42 18 L42 34 L6 34 Z" fill="#fff" />
                <rect x="10" y="17" width="11" height="7" rx="2" fill={TERRACOTTA} opacity="0.6" />
                <rect x="27" y="17" width="11" height="7" rx="2" fill={TERRACOTTA} opacity="0.6" />
                <rect x="6" y="34" width="4" height="6" rx="1" fill="#fff" />
                <rect x="38" y="34" width="4" height="6" rx="1" fill="#fff" />
            </g>
        </svg>
    );
}

/** Reservas: Chave de quarto e confirmação de estadia. */
function ReservasIcon() {
    const d = T.reservas + 0.1;
    return (
        <svg viewBox="0 0 48 48" className="h-[58%] w-[58%] overflow-visible">
            <g className="msx-i-origin" style={at("msx-i-pop", 0.45, d, SPRING)}>
                <circle cx="20" cy="20" r="9" fill="none" stroke="#fff" strokeWidth="3" />
                <path d="M26 26 L38 38 L35 41 L31 37 L29 39 L25 35" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20" cy="20" r="3.5" fill="rgb(253,224,71)" />
            </g>
        </svg>
    );
}

/** Bar & Restaurante: Taça de boas-vindas / Frigobar. */
function BarIcon() {
    const d = T.bar + 0.1;
    return (
        <svg viewBox="0 0 48 48" className="h-[58%] w-[58%] overflow-visible">
            <g className="msx-i-box" style={at("msx-i-up", 0.5, d, SPRING)}>
                <path d="M11 12 L37 12 L24 27 Z" fill="#fff" />
                <line x1="24" y1="27" x2="24" y2="39" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                <line x1="15" y1="39" x2="33" y2="39" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                <circle cx="24" cy="19" r="3.5" fill="rgb(253,224,71)" />
            </g>
        </svg>
    );
}

/** Caixa: Controlo de caixa de hotelaria e moeda MT. */
function CaixaIcon() {
    const d = T.caixa + 0.1;
    return (
        <svg viewBox="0 0 48 48" className="h-[58%] w-[58%] overflow-visible">
            <g className="msx-i-origin" style={at("msx-i-pop", 0.45, d + 0.15, SPRING)}>
                <rect x="9" y="9" width="30" height="30" rx="6" fill="rgba(255,255,255,0.22)" stroke="#fff" strokeWidth="2.5" />
                <circle cx="24" cy="24" r="8.5" fill="rgb(253,224,71)" stroke="#fff" strokeWidth="1.5" />
                <text x="24" y="27" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={BRONZE}>MT</text>
            </g>
        </svg>
    );
}

const ICONS = [QuartosIcon, ReservasIcon, BarIcon, CaixaIcon];

export function IntroSplash() {
    const [phase, setPhase] = useState<"play" | "wait" | "out" | "gone">("play");
    const [run, setRun] = useState(0);
    const clockRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const again = () => { delete document.documentElement.dataset.intro; setPhase("play"); setRun((r) => r + 1); };
        window.addEventListener(INTRO_PLAY_EVENT, again);
        return () => window.removeEventListener(INTRO_PLAY_EVENT, again);
    }, []);

    useEffect(() => {
        if (run === 0 && document.documentElement.dataset.intro === "skip") { setPhase("gone"); return; }
        try { sessionStorage.setItem(INTRO_KEY, "1"); localStorage.setItem(INTRO_AT_KEY, String(Date.now())); } catch { /* navegação privada */ }
        let done = false;
        const end = () => { if (!done) { done = true; setPhase(isAppReady() ? "out" : "wait"); } };
        const clock = clockRef.current?.getAnimations?.()[0];
        const fallback = clock ? undefined : setTimeout(end, T.out * 1000);
        clock?.finished.then(end, end);
        const cap = setTimeout(() => setPhase("out"), MAX_WAIT * 1000);
        return () => { done = true; clearTimeout(cap); clearTimeout(fallback); };
    }, [run]);

    useEffect(() => {
        if (phase !== "wait") return;
        if (isAppReady()) { setPhase("out"); return; }
        const ready = () => setPhase("out");
        window.addEventListener(APP_READY_EVENT, ready);
        return () => window.removeEventListener(APP_READY_EVENT, ready);
    }, [phase]);

    useEffect(() => {
        if (phase !== "out") return;
        const t = setTimeout(() => { setPhase("gone"); document.documentElement.dataset.intro = "skip"; }, 450);
        return () => clearTimeout(t);
    }, [phase]);

    if (phase === "gone") return null;

    return (
        <div
            key={run}
            className={`msx-intro fixed inset-0 z-[450] flex flex-col items-center justify-center overflow-hidden ${phase === "out" ? "msx-i-out" : ""} ${phase === "wait" ? "msx-i-wait" : ""}`}
            style={{ background: "radial-gradient(circle at 50% 42%, #2A221E 0%, #150F0C 70%)" }}
            onClick={() => setPhase("out")}
            role="presentation"
            aria-hidden
        >
            <style dangerouslySetInnerHTML={{ __html: CSS }} />
            <span ref={clockRef} className="msx-i-clock" />
            {DOTS.map((p, i) => (
                <span key={i} className="msx-i-dot absolute rounded-full" style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, background: p.c, animationDelay: `${p.d}s` }} />
            ))}

            <div className="relative aspect-square w-[min(80vw,360px)]">
                <div className="msx-i-shake msx-i-layer absolute inset-0">
                    <div className="msx-i-logo absolute inset-0">
                        {/* Brilho caloroso por trás do logótipo */}
                        <div className="msx-i-glow msx-i-layer absolute inset-[10%] rounded-full" style={{ background: `conic-gradient(from 200deg, ${TERRACOTTA}, ${GOLD}, ${AMBER}, ${BRONZE}, ${TERRACOTTA})`, filter: "blur(40px)" }} />

                        {/* Os quatro pilares de hotelaria */}
                        {PILLARS.map(({ label, color, left, top }, k) => {
                            const Icon = ICONS[k];
                            return (
                                <div key={label} className={`msx-i-p${k} msx-i-layer absolute flex w-[40%] flex-col items-center`} style={{ left, top }}>
                                    <div className="flex aspect-square w-[72%] items-center justify-center rounded-[28%]" style={{ background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 70%, #000))`, boxShadow: `0 12px 40px -8px ${color}` }}>
                                        <Icon />
                                    </div>
                                    <span className="mt-2 text-[13px] font-semibold tracking-wide text-white/90">{label}</span>
                                </div>
                            );
                        })}

                        {/* As cores fundem-se na esfera nobre */}
                        <div className="msx-i-merge msx-i-layer absolute inset-[12%] overflow-hidden rounded-full" style={{ background: `linear-gradient(45deg, ${TERRACOTTA} 15%, ${GOLD} 45%, ${AMBER} 70%, ${BRONZE} 90%)` }}>
                            {[TERRACOTTA, GOLD, AMBER, BRONZE].map((c, i) => (
                                <span key={c} className="msx-i-blob absolute h-[70%] w-[70%] rounded-full" style={{ background: c, filter: "blur(22px)", left: ["-10%", "-5%", "40%", "40%"][i], top: ["40%", "-5%", "40%", "-10%"][i] }} />
                            ))}
                        </div>

                        {/* O círculo assenta no degradê nobre */}
                        <div className="msx-i-exact msx-i-layer absolute inset-[12%] rounded-full" style={{ background: LOGO_GRADIENT }} />

                        {/* Letras de MAJOR e STAY com sombra de profundidade */}
                        <svg width="0" height="0" className="absolute" aria-hidden>
                            <defs>
                                <filter id="msx-letter-shadow" x="-30%" y="-30%" width="160%" height="170%">
                                    <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000" floodOpacity="0.35" />
                                </filter>
                            </defs>
                        </svg>
                        {WORDS.map(({ glyphs, at }, w) => (
                            <div key={at} className={`msx-i-w${w} msx-i-layer absolute inset-[12%]`}>
                                {glyphs.map((g, i) => {
                                    const [bx, by, bw, bh] = g.box;
                                    const pct = (v: number) => `${(v / 375) * 100}%`;
                                    return (
                                        <div key={i} className={`msx-i-l${w}-${i} msx-i-layer absolute`}
                                            style={{ left: pct(bx - PAD), top: pct(by - PAD), width: pct(bw + 2 * PAD), height: pct(bh + 2 * PAD) }}>
                                            <svg viewBox={`${bx - PAD} ${by - PAD} ${bw + 2 * PAD} ${bh + 2 * PAD}`} className="h-full w-full overflow-visible">
                                                <path d={g.d} fill={g.fill} transform={`translate(${g.x} ${g.y})`} filter="url(#msx-letter-shadow)" />
                                            </svg>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        {/* Brilho nobre atravessando o logótipo */}
                        <div className="pointer-events-none absolute inset-[12%] overflow-hidden rounded-full">
                            <span className="msx-i-shine msx-i-layer absolute inset-y-0 -left-[40%] w-1/3" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)" }} />
                        </div>
                    </div>
                </div>
            </div>

            <p className="msx-i-slogan mt-4 px-6 text-center font-headline text-base font-semibold tracking-wide text-white/90">
                {BRAND.tagline}
            </p>
            <div className="absolute inset-x-0 flex justify-center" style={{ bottom: "max(9%, calc(env(safe-area-inset-bottom) + 24px))" }}>
                <BootProgress dark />
            </div>
        </div>
    );
}
