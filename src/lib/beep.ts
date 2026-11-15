/**
 * Alerta sonoro de pedidos dos quartos ("Você recebeu um novo pedido").
 * Toca o ficheiro de áudio /sounds/novo-pedido.mp3 com fallback para Web Audio.
 */
let ctx: AudioContext | null = null;
let orderAudio: HTMLAudioElement | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

function getOrderAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!orderAudio) {
    try {
      orderAudio = new Audio('/sounds/novo-pedido.mp3');
      orderAudio.preload = 'auto';
    } catch {
      return null;
    }
  }
  return orderAudio;
}

/** Tenta ativar o som (chamar num clique). Devolve true se o som está pronto. */
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const a = getOrderAudio();
  if (a) {
    try {
      a.load();
    } catch { /* ignora */ }
  }

  const c = getCtx();
  if (c && c.state === 'suspended') {
    try {
      await c.resume();
    } catch { /* ignora */ }
  }
  return true;
}

export function audioReady(): boolean {
  if (typeof window === 'undefined') return false;
  return !!orderAudio || (!!ctx && ctx.state === 'running');
}

/** Reproduz o aviso de voz: "Você recebeu um novo pedido" */
export function playOrderAlert(): boolean {
  if (typeof window === 'undefined') return false;

  const audio = getOrderAudio();
  if (audio) {
    try {
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          playFallbackBeeps();
        });
      }
      return true;
    } catch {
      return playFallbackBeeps();
    }
  }

  return playFallbackBeeps();
}

/** Fallback sintético caso o áudio falhe */
export function playFallbackBeeps(): boolean {
  const c = getCtx();
  if (!c || c.state !== 'running') return false;
  const t0 = c.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    const start = t0 + i * 0.28;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = 988;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  }
  return true;
}

/** Interrompe imediatamente a reprodução do áudio (ex: quando clica em ver pedido) */
export function stopOrderAlert(): void {
  if (typeof window === 'undefined') return;
  if (orderAudio) {
    try {
      orderAudio.pause();
      orderAudio.currentTime = 0;
    } catch { /* ignora */ }
  }
}

/** Compatibilidade */
export const playThreeBeeps = playOrderAlert;
