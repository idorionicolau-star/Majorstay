// O que fazer depois de cada venda, escolhido em cada aparelho: perguntar (painel "E agora?") ou imprimir logo.
// Fica no aparelho (localStorage) porque o computador do balcão pode ter impressora e o telemóvel do vendedor não.

export type AfterSale = "ask" | "print";
const KEY = "msx-after-sale";

export function parseAfterSale(v: string | null | undefined): AfterSale {
    return v === "print" ? "print" : "ask";
}

export function getAfterSale(): AfterSale {
    try { return parseAfterSale(localStorage.getItem(KEY)); } catch { return "ask"; }
}

export function setAfterSale(v: AfterSale) {
    try { if (v === "ask") localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch { /* navegação privada */ }
}
