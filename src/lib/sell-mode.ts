// Como esta pessoa costuma vender, neste aparelho: "toque" (grelha de produtos) ou "rapida" (escrever/ler código).
// A Venda Rápida abre no modo que ela usou da última vez.
export type SellMode = 'toque' | 'rapida';
const KEY = 'majorstockx-sell-mode';

export function getSellMode(): SellMode | null {
    try { const v = localStorage.getItem(KEY); return v === 'toque' || v === 'rapida' ? v : null; } catch { return null; }
}

export function setSellMode(m: SellMode) {
    try { localStorage.setItem(KEY, m); } catch { /* sem armazenamento: abre sempre na Venda Rápida */ }
}
