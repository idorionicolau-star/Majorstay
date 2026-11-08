// O teclado do telemóvel só deve abrir quando a pessoa toca num campo — não sozinho ao entrar numa página.
// Regra: num ecrã de toque, o teclado começa "fechado de propósito"; passa a ser bem-vindo quando a pessoa toca
// num campo de texto, e volta a "fechado" quando ela toca em "Fechar teclado". Os focos automáticos da PESQUISA
// ("depois de juntar um artigo, volta à pesquisa") só acontecem se for bem-vindo. Os focos para escrever uma
// QUANTIDADE logo a seguir a escolher um produto não passam por aqui: aí o teclado é mesmo o que se quer.
// No computador nada muda (o foco automático continua).

type Env = { isTouch: () => boolean };

export function createKeyboardIntent(env: Env) {
    let closed: boolean | null = null; // null = ainda por decidir (depende do aparelho)
    const isClosed = () => (closed ??= env.isTouch());
    return {
        /** Podemos focar um campo sem ninguém lhe ter tocado? */
        allowsAutoFocus: () => !isClosed(),
        /** A pessoa tocou num campo de texto: o teclado é bem-vindo. */
        wanted: () => { closed = false; },
        /** A pessoa fechou o teclado: não voltar a abri-lo sozinhos. */
        hidden: () => { closed = true; },
    };
}

/** Ecrã onde o dedo é o rato principal (telemóvel, tablet). Portáteis com ecrã tátil contam como computador. */
export const isTouchDevice = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

const intent = createKeyboardIntent({ isTouch: isTouchDevice });

/** Elementos onde se escreve (abrem o teclado). */
export const isTextEntry = (el: Element | null | undefined): boolean => {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el.isContentEditable) return true;
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (el instanceof HTMLInputElement) {
        if (el.readOnly || el.disabled) return false;
        return !["button", "checkbox", "radio", "submit", "reset", "file", "image", "range", "color", "hidden"].includes(el.type);
    }
    return false;
};

/** Há um campo de texto com o cursor, ou seja, o teclado está (ou vai estar) aberto. */
export const keyboardIsOpenFor = () => isTextEntry(typeof document !== "undefined" ? document.activeElement : null);

// No toque, quem decide "toquei fora" (Radix) só reage no `click`, e nessa altura o campo já perdeu o foco por
// causa do próprio toque. Por isso guarda-se se o teclado estava aberto NO INSTANTE em que o dedo tocou.
let openAtPress = false;
let pressAt = 0;
/** O último toque (há menos de 1,5 s) começou com o teclado aberto? */
export const keyboardWasOpenOnPress = () => openAtPress && Date.now() - pressAt < 1500;

/** Fecha o teclado e não o volta a abrir sozinho até a pessoa tocar noutro campo. */
export function hideKeyboard() {
    const el = typeof document !== "undefined" ? document.activeElement : null;
    if (el instanceof HTMLElement && el !== document.body) el.blur();
    intent.hidden();
}

/** Foco automático "de cortesia" (ex.: voltar à pesquisa): ignorado num telemóvel onde o teclado está fechado. */
export function softFocus(el: HTMLInputElement | HTMLTextAreaElement | null | undefined, select = false) {
    if (!el || !intent.allowsAutoFocus()) return;
    el.focus();
    if (select) el.select();
}

/** Uma vez na app: tocar num campo de texto volta a dar licença ao teclado. */
export function watchKeyboardIntent(): () => void {
    const onDown = (e: Event) => {
        const t = e.target instanceof Element ? e.target.closest("input, textarea, [contenteditable]") : null;
        openAtPress = !isTextEntry(t) && keyboardIsOpenFor(); // tocou fora de um campo com o teclado aberto
        pressAt = Date.now();
        if (isTextEntry(t)) intent.wanted();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
}
