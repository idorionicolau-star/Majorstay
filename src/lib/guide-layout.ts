// Geometria dos guias (buraco no destaque e posição do balão) — pura, para ser testada.

export type Box = { top: number; left: number; width: number; height: number };

/** O buraco à volta do elemento: com folga e sem sair do ecrã. */
export function holeFor(r: Box, vw: number, vh: number, pad = 6): Box {
    const top = Math.max(0, r.top - pad);
    const left = Math.max(0, r.left - pad);
    const bottom = Math.min(vh, r.top + r.height + pad);
    const right = Math.min(vw, r.left + r.width + pad);
    return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** As 4 faixas escuras à volta do buraco (o resto do ecrã fica bloqueado; o buraco fica livre para mexer). */
export function shadesAround(h: Box, vw: number, vh: number): Box[] {
    return [
        { top: 0, left: 0, width: vw, height: h.top },
        { top: h.top + h.height, left: 0, width: vw, height: Math.max(0, vh - h.top - h.height) },
        { top: h.top, left: 0, width: h.left, height: h.height },
        { top: h.top, left: h.left + h.width, width: Math.max(0, vw - h.left - h.width), height: h.height },
    ];
}

export type Placement = { top?: number; bottom?: number; left: number; width: number; side: "below" | "above" | "dock-top" | "dock-bottom" | "center" };

/** A parte do ecrã que se vê de facto (com o teclado aberto, a de baixo fica tapada). */
export type Visible = { top: number; height: number };

/** O teclado do telemóvel está aberto? (a área visível encolhe bastante) */
export const keyboardOpen = (vh: number, visible?: Visible) => !!visible && visible.height < vh * 0.8;

/**
 * Onde pôr o balão. Telemóvel: encostado em cima ou em baixo da área visível, do lado oposto ao elemento.
 * Com o teclado aberto: logo acima ou abaixo do campo, dentro do que se vê (nunca atrás do teclado).
 * Computador: por baixo do elemento se couber, senão por cima, senão encostado ao fundo.
 */
export function placePopover(h: Box | null, vw: number, vh: number, popH = 220, popW = 360, visible: Visible = { top: 0, height: vh }): Placement {
    const margin = 12;
    const mobile = vw < 640;
    const width = mobile ? vw - margin * 2 : Math.min(popW, vw - margin * 2);
    const vTop = visible.top;
    const vBottom = visible.top + visible.height;
    const clampTop = (t: number) => Math.min(Math.max(vTop + 8, t), Math.max(vTop + 8, vBottom - popH - 8));
    if (!h) return { top: clampTop(vTop + visible.height / 2 - popH / 2), left: (vw - width) / 2, width, side: "center" };
    if (mobile) {
        if (keyboardOpen(vh, visible)) {
            const above = h.top - vTop;
            const below = vBottom - (h.top + h.height);
            if (above >= popH + 16) return { top: h.top - popH - 10, left: margin, width, side: "above" };
            if (below >= popH + 16) return { top: h.top + h.height + 10, left: margin, width, side: "below" };
            return { top: vTop + 8, left: margin, width, side: "dock-top" };
        }
        const centre = h.top + h.height / 2;
        return centre > vTop + visible.height / 2
            ? { top: vTop + margin, left: margin, width, side: "dock-top" }
            : { top: clampTop(vBottom - popH - margin), left: margin, width, side: "dock-bottom" };
    }
    const left = Math.min(Math.max(margin, h.left + h.width / 2 - width / 2), vw - width - margin);
    const below = vh - (h.top + h.height);
    if (below >= popH + 24) return { top: h.top + h.height + 14, left, width, side: "below" };
    if (h.top >= popH + 24) return { bottom: vh - h.top + 14, left, width, side: "above" };
    return { bottom: margin, left: (vw - width) / 2, width, side: "dock-bottom" };
}

/** O endereço actual é o do passo? Mesmo caminho, e os parâmetros pedidos (ex.: ?demo=1) presentes. */
export function routeMatches(route: string, pathname: string, search: string): boolean {
    const [path, query = ""] = route.split("?");
    if (path !== pathname) return false;
    const want = new URLSearchParams(query);
    const have = new URLSearchParams(search);
    for (const [k, v] of want) if (have.get(k) !== v) return false;
    return true;
}
