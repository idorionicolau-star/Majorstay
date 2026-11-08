"use client";

import { useEffect, useRef, useState } from "react";
import { LOGO_MAJOR, LOGO_STOCKX } from "./intro-logo";
import { APP_READY_EVENT, isAppReady } from "@/lib/app-ready";
import { INTRO_AT_KEY, INTRO_KEY, INTRO_PLAY_EVENT } from "@/lib/intro-gate";
import { BootProgress } from "@/components/layout/boot-progress";

/**
 * Animação de entrada (uma vez por dia em cada aparelho, na primeira abertura; cerca de 5,5 s). As quatro cores
 * do logótipo são os quatro pilares da app: Stock (laranja), Vendas (vermelho), Gestão (roxo) e Controlo (azul). Cada
 * um entra com o seu símbolo, juntam-se ao centro e misturam-se no círculo do MajorStockX; depois "Major" e "StockX"
 * aparecem à frente, recuam para o lugar e o logótipo treme.
 *
 * Toda a animação é CSS e vem no HTML do servidor: começa na primeira pintura, antes de o JavaScript carregar, e não
 * depende dele (o telemóvel está ocupado a carregar a app por baixo; animações em JavaScript saltavam cenas).
 * O script `INTRO_GATE` (lib/intro-gate) decide antes da primeira pintura se é para mostrar. O JavaScript só trata
 * do fim: um toque salta; se a app ainda não estiver pronta (`markAppReady`), o logótipo fica a "respirar" até estar.
 */

const ORANGE = "rgb(244,150,9)", RED = "rgb(225,51,51)", PURPLE = "rgb(117,112,182)", BLUE = "rgb(89,128,216)";

// momentos da animação (segundos)
const T = { stock: 0.2, sales: 0.75, manage: 1.3, control: 1.85, merge: 2.6, logo: 3.1, word2: 3.8, shine: 4.55, slogan: 4.6, out: 5.35 };
/** cada palavra: a onda revela-a à frente (um pouco fora do círculo), cresce devagar, recua de repente e assenta */
const WORD_TIME = 0.85;
/** intervalo entre letras na onda */
const WAVE = 0.045;
/** as duas palavras: letras, quando começam e o centro de cada uma (em % do logótipo, para o zoom) */
const WORDS = [
    { glyphs: LOGO_MAJOR, at: T.logo, origin: "50.1% 37.9%" },
    { glyphs: LOGO_STOCKX, at: T.word2, origin: "49.9% 62.7%" },
];
/** quando cada palavra assenta no lugar */
const LANDS = WORDS.map((w) => w.at + WORD_TIME * 0.82);
/** quanto dura a viagem dos pilares para o centro */
const MOVE = 0.6;
/** margem à volta de cada letra para caber a sombra (unidades do logótipo) */
const PAD = 20;
/** nunca segurar o ecrã mais do que isto, mesmo que a app não avise que está pronta */
const MAX_WAIT = 15;
/** o degradê do círculo do logótipo (laranja em baixo à esquerda, azul em cima à direita) */
const LOGO_GRADIENT = "linear-gradient(45deg, rgb(248,173,0) 15%, rgb(225,51,51) 50%, rgb(124,108,174) 72%, rgb(57,146,254) 85%)";

const SPRING = "cubic-bezier(.34,1.56,.64,1)"; // passa um pouco e volta: como uma mola
const OUT = "cubic-bezier(.22,1,.36,1)";
const pctOf = (t: number, total: number) => `${((t / total) * 100).toFixed(3)}%`;
/** animação CSS de um elemento: nome, duração, atraso, curva; fica no estado inicial antes e no final depois */
const run = (name: string, dur: number, delay: number, ease = "ease-out") => `animation:${name} ${dur}s ${ease} ${delay}s both`;

// ---------- os quatro pilares ----------
// posição de cada pilar: a cor fica no mesmo canto em que aparece no círculo do logótipo
const PILLARS = [
    { label: "Stock", color: ORANGE, at: T.stock, left: "8%", top: "52%", to: ["85%", "-85%"] },
    { label: "Vendas", color: RED, at: T.sales, left: "8%", top: "8%", to: ["85%", "85%"] },
    { label: "Gestão", color: PURPLE, at: T.manage, left: "52%", top: "52%", to: ["-85%", "-85%"] },
    { label: "Controlo", color: BLUE, at: T.control, left: "52%", top: "8%", to: ["-85%", "85%"] },
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

// pontinhos de cor a subir devagar no fundo (posições fixas: iguais no servidor e no navegador)
const DOTS = Array.from({ length: 16 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 100, c: [ORANGE, RED, PURPLE, BLUE][i % 4], s: 3 + (i % 3) * 2, d: (i % 5) * 0.5 }));

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

/** um traço que se desenha (pathLength=1 e o traço a correr) */
const draw = (delay: number, dur: number) => ({ pathLength: 1, strokeDasharray: 1, style: { animation: `msx-i-draw ${dur}s ease-out ${delay}s both` } });
const at = (name: string, dur: number, delay: number, ease = "ease-out") => ({ animation: `${name} ${dur}s ${ease} ${delay}s both` });

/** Stock: três caixas a cair e a empilhar. */
function StockIcon() {
    const box = (x: number, y: number, k: number) => (
        <g key={k} className="msx-i-box" style={at("msx-i-drop", 0.5, T.stock + 0.12 + k * 0.12, SPRING)}>
            <rect x={x} y={y} width="15" height="13" rx="2" fill="#fff" />
            <rect x={x + 6} y={y} width="3" height="5" fill={ORANGE} opacity="0.55" />
        </g>
    );
    return <svg viewBox="0 0 48 48" className="h-[58%] w-[58%] overflow-visible">{box(7.5, 28, 0)}{box(25.5, 28, 1)}{box(16.5, 13, 2)}</svg>;
}

/** Vendas: o recibo sobe, as linhas escrevem-se e cai a moeda. */
function SalesIcon() {
    const d = T.sales + 0.1;
    return (
        <svg viewBox="0 0 48 48" className="h-[58%] w-[58%] overflow-visible">
            <path className="msx-i-box" style={at("msx-i-up", 0.5, d, SPRING)} d="M12 6h22v34l-3.7-2.7-3.6 2.7-3.7-2.7-3.6 2.7-3.7-2.7-3.7 2.7z" fill="#fff" />
            {[13, 19, 25].map((y, i) => <path key={y} d={`M17 ${y}h${i === 2 ? 7 : 12}`} stroke={RED} strokeWidth="2.4" strokeLinecap="round" {...draw(d + 0.15 + i * 0.07, 0.2)} />)}
            <g className="msx-i-origin" style={at("msx-i-pop", 0.45, d + 0.38, SPRING)}>
                <circle cx="36" cy="35" r="8.5" fill="rgb(253,224,71)" stroke={RED} strokeWidth="1.6" />
                <text x="36" y="38" textAnchor="middle" fontSize="8" fontWeight="800" fill={RED}>MT</text>
            </g>
        </svg>
    );
}

/** Gestão: barras a crescer e a linha de tendência a subir. */
function ManageIcon() {
    const d = T.manage + 0.1;
    return (
        <svg viewBox="0 0 48 48" className="h-[58%] w-[58%] overflow-visible">
            {[[9, 12], [20, 20], [31, 29]].map(([x, h], i) => (
                <rect key={x} className="msx-i-bar" style={at("msx-i-grow", 0.45, d + i * 0.08, SPRING)} x={x} y={42 - h} width="8" height={h} rx="1.5" fill="#fff" />
            ))}
            <path d="M6 30 L16 22 L25 25 L41 9" fill="none" stroke="rgb(253,224,71)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...draw(d + 0.25, 0.35)} />
            <path d="M34 8.5h7.5v7.5" fill="none" stroke="rgb(253,224,71)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...draw(d + 0.55, 0.15)} />
        </svg>
    );
}

/** Controlo: o escudo desenha-se, o visto confirma e um pulso de radar sai dele. */
function ControlIcon() {
    const d = T.control + 0.1;
    return (
        <svg viewBox="0 0 48 48" className="h-[58%] w-[58%] overflow-visible">
            <circle className="msx-i-origin" style={at("msx-i-radar", 0.7, d + 0.35)} cx="24" cy="24" r="20" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0" />
            <path d="M24 5 L39 11 V23 C39 33 32 40 24 43 C16 40 9 33 9 23 V11 Z" fill="rgba(255,255,255,0.18)" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" {...draw(d, 0.4)} />
            <path d="M16.5 24 l5.5 5.5 l10.5 -11" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" {...draw(d + 0.3, 0.22)} />
        </svg>
    );
}
const ICONS = [StockIcon, SalesIcon, ManageIcon, ControlIcon];

export function IntroSplash() {
    const [phase, setPhase] = useState<"play" | "wait" | "out" | "gone">("play");
    // cada vez que toca de novo (ao entrar com a senha, só o super-administrador) a árvore é nova: o CSS recomeça
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
        // o fim conta-se pela própria animação CSS (que começou antes do JavaScript): sai se a app estiver pronta, senão espera
        let done = false;
        const end = () => { if (!done) { done = true; setPhase(isAppReady() ? "out" : "wait"); } };
        const clock = clockRef.current?.getAnimations?.()[0];
        const fallback = clock ? undefined : setTimeout(end, T.out * 1000); // navegador sem getAnimations
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
            style={{ background: "radial-gradient(circle at 50% 42%, #1a2233 0%, #0b0f17 62%)" }}
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
                {/* tudo o que treme quando as palavras assentam; por dentro, o que "respira" enquanto a app carrega */}
                <div className="msx-i-shake msx-i-layer absolute inset-0">
                    <div className="msx-i-logo absolute inset-0">
                        {/* brilho por trás do logótipo */}
                        <div className="msx-i-glow msx-i-layer absolute inset-[10%] rounded-full" style={{ background: `conic-gradient(from 200deg, ${ORANGE}, ${RED}, ${PURPLE}, ${BLUE}, ${ORANGE})`, filter: "blur(40px)" }} />

                        {/* os quatro pilares */}
                        {PILLARS.map(({ label, color, left, top }, k) => {
                            const Icon = ICONS[k];
                            return (
                                <div key={label} className={`msx-i-p${k} msx-i-layer absolute flex w-[40%] flex-col items-center`} style={{ left, top }}>
                                    <div className="flex aspect-square w-[72%] items-center justify-center rounded-[28%]" style={{ background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 70%, #000))`, boxShadow: `0 12px 40px -8px ${color}` }}>
                                        <Icon />
                                    </div>
                                    <span className="mt-2 text-[13px] font-semibold tracking-wide text-white/80">{label}</span>
                                </div>
                            );
                        })}

                        {/* as cores juntam-se no círculo */}
                        <div className="msx-i-merge msx-i-layer absolute inset-[12%] overflow-hidden rounded-full" style={{ background: `linear-gradient(45deg, ${ORANGE} 15%, ${RED} 45%, ${PURPLE} 70%, ${BLUE} 90%)` }}>
                            {[ORANGE, RED, PURPLE, BLUE].map((c, i) => (
                                <span key={c} className="msx-i-blob absolute h-[70%] w-[70%] rounded-full" style={{ background: c, filter: "blur(22px)", left: ["-10%", "-5%", "40%", "40%"][i], top: ["40%", "-5%", "40%", "-10%"][i] }} />
                            ))}
                        </div>

                        {/* o círculo assenta nas cores exactas do logótipo */}
                        <div className="msx-i-exact msx-i-layer absolute inset-[12%] rounded-full" style={{ background: LOGO_GRADIENT }} />

                        {/* cada palavra, na sua camada: a onda revela-a grande à frente, segura e recua ("voom") para o lugar */}
                        <svg width="0" height="0" className="absolute" aria-hidden>
                            <defs>
                                <filter id="msx-letter-shadow" x="-30%" y="-30%" width="160%" height="170%">
                                    <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000" floodOpacity="0.28" />
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

                        {/* no fim, um brilho atravessa o logótipo */}
                        <div className="pointer-events-none absolute inset-[12%] overflow-hidden rounded-full">
                            <span className="msx-i-shine msx-i-layer absolute inset-y-0 -left-[40%] w-1/3" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }} />
                        </div>
                    </div>
                </div>
            </div>

            <p className="msx-i-slogan mt-3 px-6 text-center font-headline text-base font-medium tracking-wide text-white/85">
                Stock, vendas e controlo num só lugar
            </p>
            {/* a barra das fases do arranque: em baixo, longe do logótipo e do slogan; enche e desaparece quando a app está pronta */}
            <div className="absolute inset-x-0 flex justify-center" style={{ bottom: "max(9%, calc(env(safe-area-inset-bottom) + 24px))" }}>
                <BootProgress dark />
            </div>
        </div>
    );
}
