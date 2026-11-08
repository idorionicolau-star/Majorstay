// "Posso mostrar o convite para instalar a app?" — lógica pura (sem React), para ser testada.

export type InstallEnv = { standalone: boolean; ios: boolean; safari: boolean; canPrompt: boolean; dismissedAt: number; now: number };

/** Depois de dispensar, o convite só volta passados 14 dias. */
export const DISMISS_DAYS = 14;

export type InstallMode = 'none' | 'prompt' | 'ios';

export function installMode(e: InstallEnv): InstallMode {
    if (e.standalone) return 'none'; // já está instalada
    if (e.dismissedAt && e.now - e.dismissedAt < DISMISS_DAYS * 86_400_000) return 'none';
    if (e.canPrompt) return 'prompt'; // Android / computador: o navegador deixa instalar com um botão
    if (e.ios && e.safari) return 'ios'; // iPhone: não há botão, só o guia "Partilhar → Adicionar ao ecrã principal"
    return 'none';
}

export const isIos = (ua: string, maxTouchPoints = 0) => /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1);

/** Safari a sério: no iPhone, Chrome/Firefox/Edge (CriOS, FxiOS, EdgiOS) e apps (Instagram, Facebook…) não instalam. */
export const isIosSafari = (ua: string) => /safari/i.test(ua) && !/crios|fxios|edgios|opios|instagram|fban|fbav|line\//i.test(ua);
