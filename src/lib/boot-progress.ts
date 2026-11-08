// Fases reais do arranque da app, para a barra de progresso da animação de entrada e do ecrã de carregamento.
// A barra só passa de uma fase quando ela acaba (não finge): dentro de cada fase avança devagar, sem chegar à seguinte.
// Quem publica é o InventoryProvider; a animação de entrada fica fora dele, por isso é uma loja simples e não contexto.

export const BOOT_STEPS = ["A verificar a sessão…", "A abrir a empresa…", "A carregar produtos…", "A carregar vendas…"] as const;
/**
 * Ao recarregar com a sessão aberta (puxar para baixo dentro da app) as fases são as mesmas, mas "A verificar a
 * sessão…" fazia parecer que a pessoa tinha sido desligada: fala-se em atualizar.
 */
export const RELOAD_STEPS = ["A ligar…", "A ligar…", "A atualizar produtos…", "A atualizar vendas…"] as const;
/** -1 antes de o JavaScript arrancar, 0 a 3 as fases, 4 pronto */
export const BOOT_DONE = BOOT_STEPS.length;

/** A fase a partir do estado da app. */
export function bootStepOf(s: { authLoading: boolean; signedIn: boolean; productsLoading: boolean; salesLoading: boolean }): number {
    if (s.authLoading) return s.signedIn ? 1 : 0;
    if (s.productsLoading) return 2;
    if (s.salesLoading) return 3;
    return BOOT_DONE;
}

/** Até onde vai a barra numa fase: [onde começa, até onde se arrasta sem a fase acabar] (de 0 a 1). */
export function bootRange(step: number): [number, number] {
    if (step >= BOOT_DONE) return [1, 1];
    const k = Math.max(step, 0);
    return [k / BOOT_DONE, (k + 0.85) / BOOT_DONE];
}

/**
 * O texto da fase. Na recarga, no fim diz "Atualizado" só com internet: sem ela a app abre com os últimos dados
 * guardados no aparelho, e dizer "Atualizado" seria enganar.
 */
export function bootLabel(step: number, idle = "A carregar…", mode: { reload?: boolean; offline?: boolean } = {}) {
    if (step < 0) return idle;
    if (step >= BOOT_DONE) return !mode.reload ? "Pronto" : mode.offline ? "Sem internet: últimos dados guardados" : "Atualizado";
    return (mode.reload ? RELOAD_STEPS : BOOT_STEPS)[step];
}

let step = -1;
const listeners = new Set<() => void>();

/**
 * Publica a fase. Durante um arranque só avança (as fases carregam em paralelo e às vezes uma "volta" por um
 * instante; a barra não recua). Depois de pronto, um novo arranque (entrar de novo) recomeça.
 */
export function setBootStep(next: number) {
    const value = step >= BOOT_DONE ? next : Math.max(step, next);
    if (value === step) return;
    step = value;
    listeners.forEach((l) => l());
}

export const getBootStep = () => step;
export function subscribeBootStep(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
}
