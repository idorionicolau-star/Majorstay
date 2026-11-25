// Versão da app: quem tem o ecrã aberto há dias continua com o código antigo (preços, regras, correções) até recarregar.
// O ecrã compara a sua versão com a do servidor e recarrega sozinho quando é seguro.

/** Versão deste código (o commit que a Vercel compilou). "dev" fora da Vercel: não compara. */
export const CLIENT_BUILD: string = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';

/** Tentativas automáticas por versão nova: com internet lenta, a 1.ª recarga ainda pode mostrar a cópia antiga guardada. */
export const MAX_AUTO_RELOADS = 3;
/** Espera entre tentativas, para a cópia nova ficar guardada. */
export const RELOAD_GAP_MS = 30_000;

/** O servidor já está noutra versão? Sem versão conhecida (dev, erro de rede): não. */
export function isStale(clientBuild: string, serverBuild: unknown): boolean {
  if (typeof serverBuild !== 'string' || !serverBuild || serverBuild === 'dev') return false;
  if (!clientBuild || clientBuild === 'dev') return false;
  return serverBuild !== clientBuild;
}

type ElLike = { tagName?: string; isContentEditable?: boolean } | null | undefined;
type DocLike = { querySelector: (s: string) => unknown; activeElement?: ElLike };

/** Só recarrega sem estragar nada: sem janela aberta (check-in, pagamento...) e sem ninguém a escrever num campo. */
export function safeToReload(doc: DocLike): boolean {
  if (doc.querySelector('[role="dialog"], [role="alertdialog"]')) return false;
  const el = doc.activeElement;
  const tag = String(el?.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return false;
  return true;
}

export type ReloadState = { target: string; count: number; at: number };

/** Já se pode tentar recarregar outra vez para esta versão? (no máximo MAX_AUTO_RELOADS, com intervalo) */
export function canAutoReload(state: ReloadState | null, target: string, now: number): boolean {
  if (!state || state.target !== target) return true;
  return state.count < MAX_AUTO_RELOADS && now - state.at >= RELOAD_GAP_MS;
}

export function nextReloadState(state: ReloadState | null, target: string, now: number): ReloadState {
  return { target, count: state && state.target === target ? state.count + 1 : 1, at: now };
}
