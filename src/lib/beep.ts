/**
 * Alerta sonoro de pedidos dos quartos e hotelaria:
 * - Novo pedido: /sounds/novo-pedido.mp3 ("Você recebeu um novo pedido")
 * - Pedido atrasado: /sounds/pedido-atrasado.mp3 ("Atenção: verifique a entrega do pedido")
 * - Estadia concluída: /sounds/estadia-concluida.mp3 ("Atenção: tempo de estadia concluído")
 * - Limpeza concluída / atrasada: /sounds/limpeza-concluida.mp3 ("Atenção: tempo de limpeza concluído")
 * Toca áudio real com fallback para Web Audio.
 */
let ctx: AudioContext | null = null;
let orderAudio: HTMLAudioElement | null = null;
let lateAudio: HTMLAudioElement | null = null;
let stayAudio: HTMLAudioElement | null = null;
let cleanAudio: HTMLAudioElement | null = null;

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

function getLateAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!lateAudio) {
    try {
      lateAudio = new Audio('/sounds/pedido-atrasado.mp3');
      lateAudio.preload = 'auto';
    } catch {
      return null;
    }
  }
  return lateAudio;
}

function getStayAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!stayAudio) {
    try {
      stayAudio = new Audio('/sounds/estadia-concluida.mp3');
      stayAudio.preload = 'auto';
    } catch {
      return null;
    }
  }
  return stayAudio;
}

function getCleanAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!cleanAudio) {
    try {
      cleanAudio = new Audio('/sounds/limpeza-concluida.mp3');
      cleanAudio.preload = 'auto';
    } catch {
      return null;
    }
  }
  return cleanAudio;
}

export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('majorstay.orderSound') === '0';
  } catch {
    return false;
  }
}

/** Tenta ativar o som (chamar num clique). Devolve true se o som está pronto. */
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const audios = [getOrderAudio(), getLateAudio(), getStayAudio(), getCleanAudio()];
  audios.forEach((a) => {
    if (a) {
      try { a.load(); } catch { /* ignora */ }
    }
  });

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
  return !!orderAudio || !!lateAudio || !!stayAudio || !!cleanAudio || (!!ctx && ctx.state === 'running');
}

function playAudioWithFallback(getAudio: () => HTMLAudioElement | null): boolean {
  if (typeof window === 'undefined') return false;
  if (isAudioMuted()) return false;

  const audio = getAudio();
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

/** Reproduz o aviso de voz: "Você recebeu um novo pedido" */
export function playOrderAlert(): boolean {
  return playAudioWithFallback(getOrderAudio);
}

/** Reproduz o aviso de voz: "Atenção: verifique a entrega do pedido" */
export function playLateAlert(): boolean {
  return playAudioWithFallback(getLateAudio);
}

/** Reproduz o aviso de voz: "Atenção: tempo de estadia concluído" */
export function playStayAlert(): boolean {
  return playAudioWithFallback(getStayAudio);
}

/** Reproduz o aviso de voz: "Atenção: tempo de limpeza concluído" */
export function playCleanAlert(): boolean {
  return playAudioWithFallback(getCleanAudio);
}

/** Interrompe imediatamente qualquer áudio em reprodução */
export function stopOrderAlert(): void {
  if (typeof window === 'undefined') return;
  [orderAudio, lateAudio, stayAudio, cleanAudio].forEach((a) => {
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch { /* ignora */ }
    }
  });
}

export const stopAllAlerts = stopOrderAlert;
export const stopStayAlert = stopOrderAlert;
export const stopCleanAlert = stopOrderAlert;

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

/** Compatibilidade */
export const playThreeBeeps = playOrderAlert;
