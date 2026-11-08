// Ecrã "A carregar aplicação…": os quatro pilares da app passam um a um. Cada um entra pela esquerda a
// travar, fica um instante no centro a fazer a sua coisa e sai disparado pela direita:
// Vendas (carrinho de compras), Entregas (camião), Gestão (portátil com gráfico) e Stock (armazém).
// Só CSS, sem JavaScript: aparece quando o telemóvel está mais ocupado a carregar a app, e o CSS continua fluido.

const W = 1.1; // segundos de cada objecto (entrar, parar, sair)
const COUNT = 4;
const CYCLE = W * COUNT;

/** Cada carregamento começa num objecto diferente (corre antes da primeira pintura, no layout). */
export const LOADER_GATE = `try{document.documentElement.style.setProperty('--msx-loader-start',-(Math.floor(Math.random()*${COUNT})*${W})+'s')}catch(e){}`;

const p = (s: number) => `${((s / CYCLE) * 100).toFixed(3)}%`;

/**
 * Keyframes de um objecto i: só existe na sua janela [i·W, (i+1)·W]; antes e depois fica com o estado `rest`.
 * steps: [fracção da janela, css, curva até ao passo seguinte].
 */
function windowed(name: string, i: number, rest: string, steps: [number, string, string?][]): string {
    const s = i * W, e = s + W, f: string[] = [];
    if (s > 0) f.push(`0%{${rest}}`, `${p(s - 0.001)}{${rest}}`);
    steps.forEach(([t, css, ease]) => f.push(`${p(s + t * W)}{${css}${ease ? `;animation-timing-function:${ease}` : ""}}`));
    if (e < CYCLE) f.push(`${p(e + 0.001)}{${rest}}`, `100%{${rest}}`);
    return `@keyframes ${name}{${f.join("")}}`;
}

const BRAKE = "cubic-bezier(.12,.75,.3,1)"; // chega depressa e trava
const SOFT = "cubic-bezier(.45,0,.55,1)";
const GO = "cubic-bezier(.55,0,.95,.45)"; // arranca a acelerar
const HIDDEN = "opacity:0;transform:translateX(-190px)";

// entra, passa um pouco do centro ao travar (o nariz mergulha), volta, fica, inclina-se para trás e sai disparado
const travel = (i: number) => windowed(`msx-obj-${i}`, i, HIDDEN, [
    [0, "opacity:1;transform:translateX(-190px) rotate(-3deg)", BRAKE],
    [0.3, "opacity:1;transform:translateX(9px) rotate(5deg)", SOFT],
    [0.4, "opacity:1;transform:translateX(-3px) rotate(-1.5deg)", SOFT],
    [0.48, "opacity:1;transform:translateX(0) rotate(0)", "linear"],
    [0.72, "opacity:1;transform:translateX(0) rotate(0)", SOFT],
    [0.8, "opacity:1;transform:translateX(-8px) rotate(-4deg)", GO],
    [0.99, "opacity:1;transform:translateX(210px) rotate(-2deg)"],
    [1, "opacity:0;transform:translateX(210px) rotate(-2deg)"],
]);
// linhas de velocidade: só a entrar e a sair
const speed = (i: number) => windowed(`msx-speed-${i}`, i, "opacity:0", [
    [0, "opacity:.9"], [0.26, "opacity:.9"], [0.36, "opacity:0"], [0.78, "opacity:0"], [0.84, "opacity:.9"], [1, "opacity:.9"],
]);
// rodas: giram a andar, param no centro
const wheels = (i: number) => windowed(`msx-wheel-${i}`, i, "transform:rotate(0)", [
    [0, "transform:rotate(0)", BRAKE], [0.4, "transform:rotate(600deg)", "linear"], [0.76, "transform:rotate(600deg)", GO], [1, "transform:rotate(1300deg)"],
]);

const KEYFRAMES = [
    ...Array.from({ length: COUNT }, (_, i) => travel(i) + speed(i)),
    wheels(0), wheels(1),
    // camião: a carga abana na suspensão quando trava
    windowed("msx-truck-body", 1, "transform:translateY(0)", [
        [0.3, "transform:translateY(0)", SOFT], [0.36, "transform:translateY(2.5px)", SOFT], [0.44, "transform:translateY(-1.5px)", SOFT], [0.52, "transform:translateY(0)"],
    ]),
    // portátil: abre a tampa, o gráfico cresce, fecha antes de sair
    windowed("msx-lid", 2, "transform:scaleY(.06)", [
        [0.42, "transform:scaleY(.06)", "cubic-bezier(.3,1.4,.5,1)"], [0.56, "transform:scaleY(1)", "linear"], [0.76, "transform:scaleY(1)", SOFT], [0.84, "transform:scaleY(.06)"],
    ]),
    ...[0, 1, 2, 3].map((k) => windowed(`msx-bar-${k}`, 2, "transform:scaleY(0)", [
        [0.54 + k * 0.03, "transform:scaleY(0)", "cubic-bezier(.3,1.5,.5,1)"], [0.64 + k * 0.03, "transform:scaleY(1)", "linear"], [0.76, "transform:scaleY(1)"], [0.8, "transform:scaleY(0)"],
    ])),
    // armazém: a porta de enrolar sobe e mostra as caixas, depois desce
    windowed("msx-door", 3, "transform:scaleY(1)", [
        [0.46, "transform:scaleY(1)", SOFT], [0.6, "transform:scaleY(.12)", "linear"], [0.76, "transform:scaleY(.12)", SOFT], [0.86, "transform:scaleY(1)"],
    ]),
];

const anim = (name: string) => `animation:${name} ${CYCLE}s infinite;animation-delay:var(--msx-loader-start,0s)`;

export const LOADER_CSS = `
${KEYFRAMES.join("\n")}
.msx-loader{--msx-ink:#253238;--msx-ink-2:#3a4a52;position:relative;width:260px;height:120px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent);mask-image:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)}
.dark .msx-loader{--msx-ink:#cbd5e1;--msx-ink-2:#94a3b8}
.msx-loader-floor{position:absolute;left:0;right:0;bottom:8px;height:2px;background:linear-gradient(90deg,transparent,rgba(128,128,128,.35),transparent)}
.msx-obj{position:absolute;left:70px;bottom:9px;width:120px;height:80px;opacity:0;transform-origin:50% 100%;will-change:transform,opacity}
.msx-obj svg{display:block;overflow:visible}
${Array.from({ length: COUNT }, (_, i) => `.msx-obj-${i}{${anim(`msx-obj-${i}`)}}.msx-speed-${i}{${anim(`msx-speed-${i}`)}}`).join("\n")}
.msx-wheel{transform-box:fill-box;transform-origin:center}
.msx-wheel-0{${anim("msx-wheel-0")}}.msx-wheel-1{${anim("msx-wheel-1")}}
.msx-truck-body{${anim("msx-truck-body")}}
.msx-lid{transform-box:fill-box;transform-origin:50% 100%;${anim("msx-lid")}}
${[0, 1, 2, 3].map((k) => `.msx-bar-${k}{transform-box:fill-box;transform-origin:50% 100%;${anim(`msx-bar-${k}`)}}`).join("")}
.msx-door{transform-box:fill-box;transform-origin:50% 0;${anim("msx-door")}}
`;

// as partes "escuras" (rodas, pega, cabine, teclado): escuras no tema claro, claras no tema escuro
const INK = { fill: "var(--msx-ink)" }, INK_STROKE = { stroke: "var(--msx-ink)" };

/** o degradê do logótipo (laranja em baixo à esquerda, azul em cima à direita) */
function Grad({ id }: { id: string }) {
    return (
        <defs>
            <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#f8ad00" />
                <stop offset=".4" stopColor="#e13333" />
                <stop offset=".72" stopColor="#7c6cae" />
                <stop offset="1" stopColor="#3992fe" />
            </linearGradient>
        </defs>
    );
}

/** linhas de velocidade atrás do objecto */
const Speed = ({ i }: { i: number }) => (
    <g className={`msx-speed-${i}`} stroke="#9aa4ad" strokeWidth="3" strokeLinecap="round">
        <path d="M-6 30h-20" /><path d="M-2 44h-30" /><path d="M-8 58h-16" />
    </g>
);
const Wheel = ({ cx, cy, r, i }: { cx: number; cy: number; r: number; i: number }) => (
    <g className={`msx-wheel msx-wheel-${i}`}>
        <circle cx={cx} cy={cy} r={r} style={INK} />
        <circle cx={cx} cy={cy} r={r * 0.38} fill="#9aa4ad" />
        <path d={`M${cx - r * 0.75} ${cy}h${r * 1.5}`} stroke="#fff" strokeWidth="1.6" opacity=".7" />
    </g>
);
const Shadow = () => <ellipse cx="60" cy="79" rx="48" ry="3" fill="rgba(0,0,0,.14)" />;

function Cart() {
    return (
        <svg viewBox="0 0 120 80" width="120" height="80">
            <Grad id="msx-lg-cart" />
            <Speed i={0} /><Shadow />
            <rect x="38" y="12" width="17" height="16" rx="2" fill="#f8ad00" />
            <rect x="58" y="6" width="14" height="22" rx="2" fill="#e13333" />
            <circle cx="86" cy="19" r="9" fill="#3992fe" />
            <path d="M6 12h13l11 42" fill="none" style={INK_STROKE} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 24h88l-11 30H33z" fill="url(#msx-lg-cart)" />
            <g stroke="#fff" strokeOpacity=".35" strokeWidth="2"><path d="M44 26v26M62 26v26M80 26v26M96 26v22M28 39h76" /></g>
            <path d="M31 56l-2 8h72" fill="none" style={INK_STROKE} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <Wheel cx={36} cy={71} r={7} i={0} /><Wheel cx={90} cy={71} r={7} i={0} />
        </svg>
    );
}

function Truck() {
    return (
        <svg viewBox="0 0 120 80" width="120" height="80">
            <Grad id="msx-lg-truck" />
            <Speed i={1} /><Shadow />
            <g className="msx-truck-body">
                <rect x="4" y="12" width="72" height="47" rx="4" fill="url(#msx-lg-truck)" />
                <g fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="2.4" strokeLinejoin="round">
                    <path d="M30 28h20v16H30z" /><path d="M40 28v16" />
                </g>
                <path d="M78 28h20l15 15v16H78z" style={INK} />
                <path d="M84 33h12l10 10H84z" fill="#cfe3ff" />
                <rect x="4" y="57" width="110" height="5" rx="2" style={INK} />
            </g>
            <Wheel cx={26} cy={67} r={9} i={1} /><Wheel cx={95} cy={67} r={9} i={1} />
        </svg>
    );
}

function Laptop() {
    return (
        <svg viewBox="0 0 120 80" width="120" height="80">
            <Grad id="msx-lg-laptop" />
            <Speed i={2} /><Shadow />
            <g className="msx-lid">
                <rect x="20" y="10" width="80" height="54" rx="5" style={INK} />
                <rect x="25" y="15" width="70" height="44" rx="2" fill="url(#msx-lg-laptop)" />
                {[[33, 12], [47, 22], [61, 16], [75, 30]].map(([x, h], k) => (
                    <rect key={k} className={`msx-bar-${k}`} x={x} y={54 - h} width="9" height={h} rx="1.5" fill="#fff" fillOpacity=".92" />
                ))}
            </g>
            <path d="M4 66h112l-7 9H11z" style={{ fill: "var(--msx-ink-2)" }} />
            <rect x="48" y="66" width="24" height="3" rx="1.5" fill="#22303a" />
        </svg>
    );
}

function Warehouse() {
    return (
        <svg viewBox="0 0 120 80" width="120" height="80">
            <Grad id="msx-lg-house" />
            <Speed i={3} /><Shadow />
            <path d="M10 34L60 9l50 25v44H10z" fill="url(#msx-lg-house)" />
            <path d="M4 37L60 7l56 30" fill="none" style={INK_STROKE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="60" cy="25" r="5" fill="#fff" fillOpacity=".85" />
            <rect x="33" y="43" width="54" height="35" fill="#1f2a30" />
            <rect x="37" y="63" width="15" height="15" rx="1.5" fill="#f8ad00" />
            <rect x="54" y="63" width="15" height="15" rx="1.5" fill="#e13333" />
            <rect x="71" y="64" width="13" height="14" rx="1.5" fill="#7c6cae" />
            <rect x="45" y="49" width="15" height="14" rx="1.5" fill="#3992fe" />
            <g className="msx-door">
                <rect x="33" y="43" width="54" height="35" fill="#e8eef3" />
                <path d="M33 49h54M33 55h54M33 61h54M33 67h54M33 73h54" stroke="#c4ced6" strokeWidth="1.4" />
            </g>
        </svg>
    );
}

const OBJECTS = [Cart, Truck, Laptop, Warehouse];

/** `footer` substitui o texto (ex.: a barra com as fases do arranque). */
export function AppLoader({ label = "A carregar aplicação...", footer }: { label?: string; footer?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-2" role="status" aria-label={label}>
            <style dangerouslySetInnerHTML={{ __html: LOADER_CSS }} />
            <div className="msx-loader" aria-hidden>
                <div className="msx-loader-floor" />
                {OBJECTS.map((Obj, i) => <div key={i} className={`msx-obj msx-obj-${i}`}><Obj /></div>)}
            </div>
            {footer ?? <p className="text-sm text-muted-foreground">{label}</p>}
        </div>
    );
}
