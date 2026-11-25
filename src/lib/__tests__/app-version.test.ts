import { describe, it, expect } from 'vitest';
import { canAutoReload, isStale, nextReloadState, safeToReload, MAX_AUTO_RELOADS, RELOAD_GAP_MS } from '@/lib/app-version';

describe('isStale', () => {
  it('versão diferente do servidor = desatualizado', () => {
    expect(isStale('aaa', 'bbb')).toBe(true);
  });
  it('mesma versão, versão desconhecida ou dev: não mexe', () => {
    expect(isStale('aaa', 'aaa')).toBe(false);
    expect(isStale('aaa', undefined)).toBe(false);
    expect(isStale('aaa', '')).toBe(false);
    expect(isStale('aaa', 'dev')).toBe(false);
    expect(isStale('dev', 'bbb')).toBe(false);
  });
});

describe('safeToReload', () => {
  const doc = (dialog: boolean, el?: { tagName?: string; isContentEditable?: boolean }) => ({
    querySelector: () => (dialog ? {} : null),
    activeElement: el,
  });
  it('sem janelas abertas e sem campo em foco: pode', () => {
    expect(safeToReload(doc(false, { tagName: 'BODY' }))).toBe(true);
    expect(safeToReload(doc(false))).toBe(true);
  });
  it('com janela aberta (check-in, pagamento): não', () => {
    expect(safeToReload(doc(true, { tagName: 'BODY' }))).toBe(false);
  });
  it('a escrever num campo: não', () => {
    expect(safeToReload(doc(false, { tagName: 'INPUT' }))).toBe(false);
    expect(safeToReload(doc(false, { tagName: 'textarea' }))).toBe(false);
    expect(safeToReload(doc(false, { tagName: 'DIV', isContentEditable: true }))).toBe(false);
  });
});

describe('tentativas de recarga (nunca em ciclo)', () => {
  it('versão nova sem tentativas: pode logo', () => {
    expect(canAutoReload(null, 'v2', 1000)).toBe(true);
  });
  it('espera o intervalo entre tentativas', () => {
    const s = nextReloadState(null, 'v2', 1000);
    expect(s).toEqual({ target: 'v2', count: 1, at: 1000 });
    expect(canAutoReload(s, 'v2', 1000 + RELOAD_GAP_MS - 1)).toBe(false);
    expect(canAutoReload(s, 'v2', 1000 + RELOAD_GAP_MS)).toBe(true);
  });
  it('depois do máximo de tentativas desiste (fica o aviso manual)', () => {
    let s = nextReloadState(null, 'v2', 0);
    for (let i = 1; i < MAX_AUTO_RELOADS; i++) s = nextReloadState(s, 'v2', i * RELOAD_GAP_MS);
    expect(s.count).toBe(MAX_AUTO_RELOADS);
    expect(canAutoReload(s, 'v2', 99 * RELOAD_GAP_MS)).toBe(false);
  });
  it('outra versão nova recomeça a contagem', () => {
    const s = nextReloadState(null, 'v2', 0);
    expect(canAutoReload(s, 'v3', 1)).toBe(true);
    expect(nextReloadState(s, 'v3', 1).count).toBe(1);
  });
});
