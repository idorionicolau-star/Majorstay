"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { getHaul, subscribeHaul, type HaulKind, type HaulPhase } from "@/lib/haul";

// O cartão ao centro com a barra puxada. Os puxões são ritmados (um a cada TUG segundos): o objecto inclina-se e
// faz força, a corda estica, a barra avança um bocado; entre puxões recupera. A barra abranda até ~85% e, se a
// gravação ainda não acabou, o objecto continua a fazer força sem avançar. Quando grava, a barra enche, a corda
// solta-se e o objecto dá um salto. Tudo CSS (transform/opacity): fluido mesmo com o telemóvel ocupado a gravar.

const TUG = 0.7; // segundos por puxão
const TUGS = 12;
const P_MAX = 0.86;
const TRACK = 176; // largura da barra (px)
const pct = (t: number) => `${((t / (TUG * TUGS)) * 100).toFixed(3)}%`;

// progresso de cada puxão: grandes no início, cada vez mais pequenos (custa mais)
const P = Array.from({ length: TUGS + 1 }, (_, k) => P_MAX * (1 - Math.exp(-k / 4)) / (1 - Math.exp(-TUGS / 4)));
const progress = (prop: (p: number) => string) => P.slice(0, TUGS).map((p, k) =>
    `${pct(k * TUG + 0.18 * TUG)}{transform:${prop(p)};animation-timing-function:cubic-bezier(.3,0,.2,1)}${pct(k * TUG + 0.48 * TUG)}{transform:${prop(P[k + 1])};animation-timing-function:linear}`).join("")
    + `0%{transform:${prop(0)}}100%{transform:${prop(P[TUGS])}}`;

const CSS = `
@keyframes msx-h-in{from{opacity:0}to{opacity:1}}
@keyframes msx-h-pop{from{opacity:0;transform:scale(.85) translateY(10px)}to{opacity:1;transform:none}}
@keyframes msx-h-fill{${progress((p) => `translateX(${((p - 1) * 100).toFixed(2)}%)`)}}
@keyframes msx-h-move{${progress((p) => `translateX(${(p * TRACK).toFixed(1)}px)`)}}
@keyframes msx-h-tug{0%,100%{transform:rotate(0) scale(1,1)}25%{transform:rotate(-7deg) scale(1.05,.95)}45%{transform:rotate(-3deg) scale(1,1)}70%{transform:rotate(1.5deg) scale(.98,1.03)}}
@keyframes msx-h-jiggle{0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(-4px) rotate(-6deg)}55%{transform:translateY(1px) rotate(3deg)}}
@keyframes msx-h-spin{0%{transform:rotate(0)}40%{transform:rotate(290deg)}100%{transform:rotate(360deg)}}
@keyframes msx-h-taut{0%,12%{opacity:0}18%,55%{opacity:1}65%,100%{opacity:0}}
@keyframes msx-h-slack{0%,12%{opacity:1}18%,55%{opacity:0}65%,100%{opacity:1}}
@keyframes msx-h-dust{0%,15%{opacity:0;transform:translate(0,0) scale(.3)}25%{opacity:.75}80%,100%{opacity:0;transform:translate(-16px,-7px) scale(1.5)}}
@keyframes msx-h-sweat{0%,30%{opacity:0;transform:translate(0,0) scale(.4)}40%{opacity:1;transform:translate(2px,-5px) scale(1)}70%,100%{opacity:0;transform:translate(9px,4px) scale(.8)}}
@keyframes msx-h-hop{0%{transform:translateY(0) rotate(0)}35%{transform:translateY(-12px) rotate(-8deg)}65%{transform:translateY(0) rotate(2deg) scale(1.06,.94)}100%{transform:none}}
@keyframes msx-h-no{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px) rotate(-4deg)}40%{transform:translateX(5px) rotate(4deg)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
@keyframes msx-h-smoke{0%,10%{opacity:0;transform:translate(0,0) scale(.4)}22%{opacity:.8}85%,100%{opacity:0;transform:translate(-14px,-14px) scale(1.8)}}
@keyframes msx-h-vibrate{0%,100%{transform:translate(0,0)}25%{transform:translate(.6px,-.5px)}50%{transform:translate(-.5px,.4px)}75%{transform:translate(.4px,.5px)}}
@keyframes msx-h-drum{0%{transform:rotate(0)}35%{transform:rotate(150deg)}100%{transform:rotate(180deg)}}
@keyframes msx-h-lift{0%,100%{transform:translateY(0)}25%{transform:translateY(-5px)}45%{transform:translateY(-3px)}70%{transform:translateY(1px)}}
@keyframes msx-h-paper{0%,15%{transform:translateX(0)}40%,100%{transform:translateX(5px)}}
@keyframes msx-h-step{0%,100%{transform:translateY(0)}20%{transform:translateY(-3px)}40%{transform:translateY(0)}}
@keyframes msx-h-bar{0%,100%{transform:scaleY(1)}25%{transform:scaleY(.72)}50%{transform:scaleY(1.18)}75%{transform:scaleY(.95)}}
@keyframes msx-h-roll{0%{transform:rotate(0)}40%{transform:rotate(80deg)}100%{transform:rotate(90deg)}}
@keyframes msx-h-squash{0%,100%{transform:scale(1,1)}25%{transform:scale(1.06,.92)}45%{transform:scale(.97,1.03)}}
@keyframes msx-h-spark{0%,18%{opacity:0;transform:translate(0,0) scale(.3)}26%{opacity:1;transform:translate(-4px,-3px) scale(1)}60%,100%{opacity:0;transform:translate(-12px,-9px) scale(.4)}}
@keyframes msx-h-swing{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg) translateY(-2px)}50%{transform:rotate(6deg)}75%{transform:rotate(-3deg)}}
@keyframes msx-h-glint{0%,40%{opacity:0;transform:scale(.2) rotate(0)}55%{opacity:1;transform:scale(1) rotate(45deg)}75%,100%{opacity:0;transform:scale(.2) rotate(90deg)}}
@keyframes msx-h-check{from{opacity:0;transform:scale(0) rotate(-30deg)}to{opacity:1;transform:none}}
.msx-h-back{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;background:rgba(9,12,18,.35);animation:msx-h-in .2s ease-out both}
.msx-h-card{width:min(92vw,330px);animation:msx-h-pop .35s cubic-bezier(.34,1.56,.64,1) both}
.msx-h-stage{position:relative;width:${TRACK + 106}px;height:86px;margin:12px auto 0}
.msx-h-track{position:absolute;left:0;top:70px;width:${TRACK}px;height:10px;border-radius:999px;overflow:hidden;background:hsl(var(--muted))}
.msx-h-fill{position:absolute;inset:0;border-radius:999px;background:linear-gradient(90deg,#f8ad00,#e13333 45%,#7c6cae 75%,#3992fe);transition:background .3s;will-change:transform;animation:msx-h-fill ${TUG * TUGS}s both}
.msx-h-mover{position:absolute;left:8px;top:10px;width:94px;height:73px;will-change:transform;animation:msx-h-move ${TUG * TUGS}s both}
.msx-h-mover svg{display:block;overflow:visible}
.msx-h-body{transform-box:view-box;transform-origin:22px 54px;animation:msx-h-tug ${TUG}s ease-in-out infinite}
.msx-h-load{transform-box:fill-box;transform-origin:50% 100%;animation:msx-h-jiggle ${TUG}s ease-in-out infinite;animation-delay:.05s}
.msx-h-wheel{transform-box:fill-box;transform-origin:center;animation:msx-h-spin ${TUG}s cubic-bezier(.3,0,.3,1) infinite}
.msx-h-taut{animation:msx-h-taut ${TUG}s linear infinite}
.msx-h-slack{animation:msx-h-slack ${TUG}s linear infinite}
.msx-h-dust{transform-box:fill-box;transform-origin:center;opacity:0;animation:msx-h-dust ${TUG}s ease-out infinite}
.msx-h-dust:nth-child(2){animation-delay:.06s}.msx-h-dust:nth-child(3){animation-delay:.12s}
.msx-h-sweat{transform-box:fill-box;transform-origin:center;opacity:0;animation:msx-h-sweat ${TUG * 2}s ease-out infinite}
.msx-h-smoke{transform-box:fill-box;transform-origin:center;opacity:0;animation:msx-h-smoke ${TUG}s ease-out infinite}
.msx-h-smoke:nth-child(2){animation-delay:.08s}.msx-h-smoke:nth-child(3){animation-delay:.16s}
.msx-h-vibrate{animation:msx-h-vibrate .12s linear infinite}
.msx-h-drum{transform-box:fill-box;transform-origin:center;animation:msx-h-drum ${TUG}s cubic-bezier(.3,0,.3,1) infinite}
.msx-h-lift{animation:msx-h-lift ${TUG}s ease-in-out infinite}
.msx-h-paper{animation:msx-h-paper ${TUG}s cubic-bezier(.3,0,.2,1) infinite}
.msx-h-step{animation:msx-h-step ${TUG}s ease-in-out infinite}
.msx-h-bar{transform-box:fill-box;transform-origin:50% 100%;animation:msx-h-bar ${TUG}s ease-in-out infinite}
.msx-h-roll{transform-box:fill-box;transform-origin:center;animation:msx-h-roll ${TUG}s cubic-bezier(.3,0,.3,1) infinite}
.msx-h-squash{transform-box:view-box;animation:msx-h-squash ${TUG}s ease-in-out infinite}
.msx-h-spark{transform-box:fill-box;transform-origin:center;opacity:0;animation:msx-h-spark ${TUG}s ease-out infinite}
.msx-h-spark:nth-child(2){animation-delay:.05s}.msx-h-spark:nth-child(3){animation-delay:.1s}
.msx-h-notug{animation:none}
.msx-h-swing{transform-box:view-box;animation:msx-h-swing ${TUG}s ease-in-out infinite}
.msx-h-glint{transform-box:fill-box;transform-origin:center;opacity:0;animation:msx-h-glint ${TUG * 2}s ease-out infinite}
.msx-h-check{display:inline-flex;width:20px;height:20px;margin-right:6px;vertical-align:-4px;border-radius:50%;background:#16a34a;color:#fff;align-items:center;justify-content:center;font-weight:800;font-size:12px;box-shadow:0 4px 12px -3px #16a34a;animation:msx-h-check .4s cubic-bezier(.34,1.56,.64,1) .2s both}
/* no fim e no erro: as peças param onde estão, os efeitos (pó, fumo, suor, faíscas) somem, a corda fica bamba */
.msx-h-done .msx-h-body{animation:msx-h-hop .55s cubic-bezier(.34,1.56,.64,1) both}
.msx-h-error .msx-h-fill{background:#ef4444}
.msx-h-error .msx-h-body{animation:msx-h-no .5s ease-in-out both}
.msx-h-done .msx-h-part,.msx-h-error .msx-h-part{animation:none}
.msx-h-done .msx-h-fx,.msx-h-error .msx-h-fx,.msx-h-done .msx-h-taut,.msx-h-error .msx-h-taut{animation:none;opacity:0}
.msx-h-done .msx-h-slack,.msx-h-error .msx-h-slack{animation:none;opacity:1}
`;

const INK = { fill: "hsl(var(--foreground))" };
const INK_STROKE = { stroke: "hsl(var(--foreground))" };

/** a corda entre a ponta da barra (x=-6) e o objecto: esticada quando puxa, bamba entre puxões */
function Rope({ to }: { to: [number, number] }) {
    const [x, y] = to;
    return <>
        <path className="msx-h-slack" d={`M-6 49 Q${(x - 6) / 2} ${Math.max(y, 49) + 6} ${x} ${y}`} fill="none" stroke="#b08955" strokeWidth="2" strokeLinecap="round" />
        <path className="msx-h-taut" d={`M-6 49 L${x} ${y}`} fill="none" stroke="#b08955" strokeWidth="2.2" strokeLinecap="round" />
    </>;
}
const Dust = ({ x, y }: { x: number; y: number }) => (
    <g>{[0, 1, 2].map((i) => <circle key={i} className="msx-h-dust msx-h-fx" cx={x - i * 3} cy={y - i} r={3 + i} fill="#b9bec6" />)}</g>
);
const Sweat = ({ x, y }: { x: number; y: number }) => <>
    {[0, 1].map((i) => <path key={i} className="msx-h-sweat msx-h-fx" style={{ animationDelay: `${i * TUG}s` }} d={`M${x + i * 7} ${y - 6} q5 6 0 9 q-5 -3 0 -9z`} fill="#7cc4ff" />)}
</>;
const Wheel = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
    <g className="msx-h-wheel msx-h-part">
        <circle cx={cx} cy={cy} r={r} style={INK} />
        <path d={`M${cx - r * 0.7} ${cy}h${r * 1.4}M${cx} ${cy - r * 0.7}v${r * 1.4}`} stroke="#9aa4ad" strokeWidth="1.3" />
    </g>
);
function Grad({ id }: { id: string }) {
    return (
        <defs>
            <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#f8ad00" /><stop offset=".45" stopColor="#e13333" /><stop offset=".75" stopColor="#7c6cae" /><stop offset="1" stopColor="#3992fe" />
            </linearGradient>
        </defs>
    );
}

const Smoke = ({ x, y }: { x: number; y: number }) => (
    <g>{[0, 1, 2].map((i) => <circle key={i} className="msx-h-smoke msx-h-fx" cx={x} cy={y - i} r={2.5 + i} fill="#8b939c" />)}</g>
);
const Sparks = ({ x, y }: { x: number; y: number }) => (
    <g>{[0, 1, 2].map((i) => <path key={i} className="msx-h-spark msx-h-fx" d={`M${x - i * 2} ${y - i * 3} l-3 -2 l1 3z`} fill="#fbbf24" />)}</g>
);

/** Vendas: carrinho de compras; as rodas da frente levantam no esticão e os produtos saltam lá dentro. */
function Cart() {
    return (
        <svg viewBox="0 0 72 56" width="94" height="73">
            <Grad id="msx-h-g-cart" />
            <Rope to={[14, 44]} />
            <Dust x={16} y={52} />
            <g className="msx-h-body">
                <g className="msx-h-load msx-h-part">
                    <rect x="23" y="7" width="11" height="12" rx="2" fill="#f8ad00" />
                    <rect x="37" y="2" width="8" height="17" rx="2" fill="#e13333" />
                    <circle cx="54" cy="12" r="6.5" fill="#3992fe" />
                </g>
                <path d="M16 20 L9 11 H4" fill="none" style={INK_STROKE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 17 H67 L61 39 H22 Z" fill="url(#msx-h-g-cart)" />
                <path d="M30 19v18M41 19v18M52 19v18M19 28h45" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" />
                <path d="M14 44 H60" style={INK_STROKE} strokeWidth="3" strokeLinecap="round" />
                <path d="M22 39 L20 44" style={INK_STROKE} strokeWidth="3" strokeLinecap="round" />
                <Sweat x={64} y={8} />
            </g>
            <Wheel cx={24} cy={49} r={5} /><Wheel cx={56} cy={49} r={5} />
        </svg>
    );
}

/** Transferências e envios: camião; fumo do escape a cada esforço, a cabine levanta e a carga balança. */
function Truck() {
    return (
        <svg viewBox="0 0 72 56" width="94" height="73">
            <Grad id="msx-h-g-truck" />
            <Rope to={[8, 43]} />
            <Smoke x={6} y={36} />
            <Dust x={18} y={52} />
            <g className="msx-h-body">
                <path d="M6 40 V36" style={INK_STROKE} strokeWidth="2.4" strokeLinecap="round" />
                <g className="msx-h-load msx-h-part">
                    <rect x="8" y="10" width="40" height="30" rx="3" fill="url(#msx-h-g-truck)" />
                    <path d="M22 20h12v10H22zM28 20v10" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1.8" strokeLinejoin="round" />
                </g>
                <path d="M49 20 H61 L69 30 V41 H49 Z" style={INK} />
                <path d="M53 23 H60 L65 30 H53 Z" fill="#cfe3ff" />
                <rect x="7" y="40" width="63" height="4" rx="1.5" style={INK} />
            </g>
            <Wheel cx={20} cy={49} r={5} /><Wheel cx={58} cy={49} r={5} />
        </svg>
    );
}

/** Produção: betoneira; o tambor gira mais depressa quando puxa e a máquina vibra toda. */
function Mixer() {
    return (
        <svg viewBox="0 0 72 56" width="94" height="73">
            <Grad id="msx-h-g-mix" />
            <defs><clipPath id="msx-h-drum-clip"><ellipse cx="28" cy="25" rx="19" ry="14" /></clipPath></defs>
            <Rope to={[8, 43]} />
            <Dust x={18} y={52} />
            <g className="msx-h-body">
                <g className="msx-h-vibrate msx-h-part">
                    <ellipse cx="28" cy="25" rx="19" ry="14" fill="url(#msx-h-g-mix)" />
                    <g clipPath="url(#msx-h-drum-clip)">
                        <g className="msx-h-drum msx-h-part">
                            {[-24, -12, 0, 12, 24].map((o) => <path key={o} d={`M${28 + o - 20} 45 L${28 + o + 20} 5`} stroke="#fff" strokeOpacity=".45" strokeWidth="3.5" />)}
                            <circle cx="28" cy="25" r="30" fill="none" />
                        </g>
                    </g>
                    <path d="M45 18 l6 -4" style={INK_STROKE} strokeWidth="3" strokeLinecap="round" />
                    <path d="M50 22 H61 L69 31 V41 H50 Z" style={INK} />
                    <path d="M54 25 H60 L65 31 H54 Z" fill="#cfe3ff" />
                    <rect x="7" y="40" width="63" height="4" rx="1.5" style={INK} />
                    <path d="M14 38 l4 -4 M40 38 l-4 -4" style={INK_STROKE} strokeWidth="2.4" />
                </g>
                <Sweat x={60} y={14} />
            </g>
            <Wheel cx={20} cy={49} r={5} /><Wheel cx={58} cy={49} r={5} />
        </svg>
    );
}

/** Entrada de stock e contagem: empilhador; a palete sobe e desce com o esforço e as rodas patinam. */
function Forklift() {
    return (
        <svg viewBox="0 0 72 56" width="94" height="73">
            <Grad id="msx-h-g-fork" />
            <Rope to={[8, 42]} />
            <Dust x={16} y={52} />
            <g className="msx-h-body">
                <path d="M10 22 H40 V44 H8 Z" fill="url(#msx-h-g-fork)" />
                <path d="M16 22 V8 H36 L40 22" fill="none" style={INK_STROKE} strokeWidth="2.6" strokeLinejoin="round" />
                <rect x="6" y="30" width="6" height="12" rx="1.5" style={INK} />
                <rect x="44" y="6" width="4" height="40" rx="1" style={INK} />
                <rect x="50" y="6" width="4" height="40" rx="1" style={INK} />
                <g className="msx-h-lift msx-h-part">
                    <path d="M47 40 H70" style={INK_STROKE} strokeWidth="3" strokeLinecap="round" />
                    <rect x="54" y="35" width="15" height="4" rx="1" fill="#b08955" />
                    <rect x="55" y="22" width="13" height="13" rx="1.5" fill="#f8ad00" />
                    <rect x="57" y="11" width="10" height="11" rx="1.5" fill="#3992fe" />
                    <path d="M61 22v13M55 28h13" stroke="#fff" strokeOpacity=".5" strokeWidth="1.2" />
                </g>
                <Sweat x={36} y={4} />
            </g>
            <Wheel cx={20} cy={48} r={6} /><Wheel cx={46} cy={49} r={5} />
        </svg>
    );
}

/** Documentos: impressora; pula aos solavancos enquanto a folha sai e "puxa" a barra. */
function Printer() {
    return (
        <svg viewBox="0 0 72 56" width="94" height="73">
            <Grad id="msx-h-g-print" />
            <Rope to={[10, 40]} />
            <Dust x={16} y={53} />
            <g className="msx-h-body" style={{ transformOrigin: "14px 54px" }}>
                <path d="M20 8 H50 V20 H20 Z" fill="#e8eef3" stroke="#c4ced6" strokeWidth="1" />
                <rect x="10" y="18" width="50" height="26" rx="4" fill="url(#msx-h-g-print)" />
                <rect x="16" y="24" width="22" height="4" rx="2" fill="#fff" fillOpacity=".55" />
                <circle cx="52" cy="26" r="2.4" fill="#22c55e" />
                <rect x="18" y="38" width="34" height="3" rx="1.5" style={INK} />
                <g className="msx-h-paper msx-h-part">
                    <path d="M40 39 H66 V46 H40 Z" fill="#fff" stroke="#c4ced6" strokeWidth=".8" />
                    <path d="M44 42h16" stroke="#9aa4ad" strokeWidth="1" />
                </g>
                <g className="msx-h-step msx-h-part"><rect x="14" y="44" width="8" height="6" rx="2" style={INK} /></g>
                <g className="msx-h-step msx-h-part" style={{ animationDelay: `${TUG / 2}s` }}><rect x="46" y="44" width="8" height="6" rx="2" style={INK} /></g>
                <Sweat x={60} y={10} />
            </g>
        </svg>
    );
}

/** Relatórios: gráfico; as barras empurram-se umas às outras como molas e a seta sobe. */
function Chart() {
    return (
        <svg viewBox="0 0 72 56" width="94" height="73">
            <Grad id="msx-h-g-chart" />
            <Rope to={[10, 42]} />
            <Dust x={16} y={53} />
            <g className="msx-h-body" style={{ transformOrigin: "14px 54px" }}>
                <rect x="8" y="8" width="56" height="38" rx="4" fill="#e8eef3" stroke="#c4ced6" strokeWidth="1" />
                {[[14, 14], [25, 22], [36, 17], [47, 28]].map(([x, h], i) => (
                    <rect key={x} className="msx-h-bar msx-h-part" style={{ animationDelay: `${i * 0.07}s` }} x={x} y={42 - h} width="8" height={h} rx="1.5" fill={["#f8ad00", "#e13333", "#7c6cae", "#3992fe"][i]} />
                ))}
                <path d="M12 30 L24 22 L36 26 L58 10" fill="none" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M52 9.5 H58.5 V16" fill="none" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <g className="msx-h-step msx-h-part"><path d="M16 46 L13 52" style={INK_STROKE} strokeWidth="3" strokeLinecap="round" /></g>
                <g className="msx-h-step msx-h-part" style={{ animationDelay: `${TUG / 2}s` }}><path d="M56 46 L59 52" style={INK_STROKE} strokeWidth="3" strokeLinecap="round" /></g>
                <Sweat x={64} y={6} />
            </g>
        </svg>
    );
}

/** Definições e utilizadores: engrenagem; rola aos solavancos e saltam faíscas onde toca no chão. */
function Gear() {
    const teeth = Array.from({ length: 8 }, (_, k) => {
        const a = (k * Math.PI) / 4;
        return `M${(36 + 15 * Math.cos(a - 0.22)).toFixed(1)} ${(32 + 15 * Math.sin(a - 0.22)).toFixed(1)} L${(36 + 21 * Math.cos(a - 0.13)).toFixed(1)} ${(32 + 21 * Math.sin(a - 0.13)).toFixed(1)} L${(36 + 21 * Math.cos(a + 0.13)).toFixed(1)} ${(32 + 21 * Math.sin(a + 0.13)).toFixed(1)} L${(36 + 15 * Math.cos(a + 0.22)).toFixed(1)} ${(32 + 15 * Math.sin(a + 0.22)).toFixed(1)}Z`;
    }).join("");
    return (
        <svg viewBox="0 0 72 56" width="94" height="73">
            <Grad id="msx-h-g-gear" />
            <Rope to={[22, 34]} />
            <Sparks x={28} y={52} />
            <g className="msx-h-squash msx-h-part" style={{ transformOrigin: "36px 54px" }}>
                <g className="msx-h-body msx-h-notug">
                    <g className="msx-h-roll msx-h-part">
                        <path d={teeth} fill="url(#msx-h-g-gear)" />
                        <circle cx="36" cy="32" r="16" fill="url(#msx-h-g-gear)" />
                        <circle cx="36" cy="32" r="6.5" style={INK} />
                        <circle cx="36" cy="32" r="2.5" fill="#e8eef3" />
                        <path d="M36 18 v5" stroke="#fff" strokeOpacity=".6" strokeWidth="2.2" strokeLinecap="round" />
                    </g>
                </g>
                <Sweat x={56} y={10} />
            </g>
        </svg>
    );
}

/** Entrar e registar: chave; balança presa à corda e brilha. */
function Key() {
    return (
        <svg viewBox="0 0 72 56" width="94" height="73">
            <Grad id="msx-h-g-key" />
            <Rope to={[12, 36]} />
            <Dust x={30} y={53} />
            <g className="msx-h-body" style={{ transformOrigin: "36px 54px" }}>
                <g className="msx-h-swing msx-h-part" style={{ transformOrigin: "22px 34px" }}>
                    <circle cx="22" cy="34" r="12" fill="url(#msx-h-g-key)" />
                    <circle cx="22" cy="34" r="5" style={{ fill: "hsl(var(--card))" }} />
                    <rect x="32" y="31" width="32" height="6" rx="2" fill="url(#msx-h-g-key)" />
                    <path d="M50 37 v7 h4 v-7 M58 37 v5 h4 v-5" fill="url(#msx-h-g-key)" />
                    <path className="msx-h-glint msx-h-fx" d="M30 22 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5z" fill="#fff" />
                </g>
                <Sweat x={58} y={18} />
            </g>
        </svg>
    );
}

const OBJECTS: Record<HaulKind, () => React.JSX.Element> = {
    sale: Cart, transfer: Truck, production: Mixer, stock: Forklift, document: Printer, report: Chart, settings: Gear, auth: Key,
};

function HaulCard({ kind, label, doneLabel, phase }: { kind: HaulKind; label: string; doneLabel: string; phase: HaulPhase }) {
    const fillRef = useRef<HTMLDivElement>(null);
    const moverRef = useRef<HTMLDivElement>(null);
    const Obj = OBJECTS[kind];

    // no fim: a barra parte de onde está e enche até ao fim (os puxões param)
    useLayoutEffect(() => {
        if (phase !== "done") return;
        const go = (el: HTMLElement | null, to: string) => {
            if (!el) return;
            const now = getComputedStyle(el).transform;
            el.style.animation = "none";
            el.style.transform = now === "none" ? "" : now;
            el.animate?.([{ transform: now === "none" ? "none" : now }, { transform: to }], { duration: 380, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
        };
        go(fillRef.current, "translateX(0)");
        go(moverRef.current, `translateX(${TRACK}px)`);
    }, [phase]);
    // no erro: pára onde está
    useEffect(() => {
        if (phase !== "error") return;
        [fillRef.current, moverRef.current].forEach((el) => { if (el) { el.style.transform = getComputedStyle(el).transform; el.style.animation = "none"; } });
    }, [phase]);

    const text = phase === "done" ? doneLabel : phase === "error" ? "Não foi possível concluir" : label;
    return (
        <div className="msx-h-back" role="status" aria-live="polite">
            <div className="msx-h-card rounded-2xl border bg-card px-5 pb-4 pt-5 text-card-foreground shadow-2xl">
                <p className={`text-center text-sm font-semibold ${phase === "done" ? "text-emerald-600 dark:text-emerald-400" : phase === "error" ? "text-red-600 dark:text-red-400" : ""}`}>{phase === "done" && <span className="msx-h-check">✓</span>}{text}</p>
                <div className={`msx-h-stage ${phase === "done" ? "msx-h-done" : phase === "error" ? "msx-h-error" : ""}`}>
                    <div className="msx-h-track"><div ref={fillRef} className="msx-h-fill" /></div>
                    <div ref={moverRef} className="msx-h-mover"><Obj /></div>
                </div>
            </div>
        </div>
    );
}

/** Fica no layout: mostra o cartão quando alguém chama `haul(...)`. */
export function ProgressHaulHost() {
    const s = useSyncExternalStore(subscribeHaul, getHaul, () => null);
    if (!s) return null;
    return <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <HaulCard key={s.id} kind={s.kind} label={s.label} doneLabel={s.doneLabel} phase={s.phase} />
    </>;
}
