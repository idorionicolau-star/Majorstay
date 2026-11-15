/** Três bips curtos (Web Audio). Só toca depois de a pessoa ter tocado/clicado na página uma vez (regra dos navegadores). */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** Tenta ativar o som (chamar num clique). Devolve true se o som está pronto. */
export async function unlockAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state === 'suspended') await c.resume();
  } catch { /* ignora */ }
  return c.state === 'running';
}

export function audioReady(): boolean {
  return !!ctx && ctx.state === 'running';
}

export function playThreeBeeps(): boolean {
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
