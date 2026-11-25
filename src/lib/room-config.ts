// Dados do quarto que só o administrador define (preços, mínimo de horas, pacotes, nome...).
// A edição passa sempre pelo servidor, que valida os valores e regista quem mudou o quê.

type AnyRec = Record<string, any>;

/** Campos que só o administrador altera (e só pelo servidor). */
export const ROOM_CONFIG_KEYS = [
  'name', 'type', 'ratePerHour', 'minimumHours', 'overnightPrice', 'overnightEndHour',
  'dailyPrice', 'cleaningDurationMinutes', 'notes', 'images', 'active',
] as const;

/** Campos do dia-a-dia que as funcionárias mudam (limpeza, ocupação...). */
export const ROOM_OPERATIONAL_KEYS = ['status', 'currentStayId', 'cleaningStartedAt', 'updatedAt'] as const;

export const isConfigKey = (k: string) => (ROOM_CONFIG_KEYS as readonly string[]).includes(k);

const num = (v: unknown, min: number, max: number, label: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} inválido.`);
  return n;
};

/** Valida só os campos enviados e devolve apenas os campos conhecidos, limpos. Lança Error com mensagem para o utilizador. */
export function sanitizeRoomConfig(input: AnyRec): AnyRec {
  const out: AnyRec = {};
  if ('name' in input) {
    const name = String(input.name ?? '').trim().slice(0, 80);
    if (!name) throw new Error('O nome do quarto é obrigatório.');
    out.name = name;
  }
  if ('type' in input) out.type = String(input.type ?? '').trim().slice(0, 30) || 'standard';
  if ('ratePerHour' in input) out.ratePerHour = num(input.ratePerHour, 0, 100_000_000, 'Preço por hora');
  if ('minimumHours' in input) out.minimumHours = Math.max(1, num(input.minimumHours, 0, 72, 'Mínimo de horas'));
  if ('overnightPrice' in input) out.overnightPrice = num(input.overnightPrice ?? 0, 0, 100_000_000, 'Preço da pernoite');
  if ('dailyPrice' in input) out.dailyPrice = num(input.dailyPrice ?? 0, 0, 100_000_000, 'Preço da diária');
  if ('overnightEndHour' in input) out.overnightEndHour = Math.floor(num(input.overnightEndHour, 0, 23, 'Hora de saída da pernoite'));
  if ('cleaningDurationMinutes' in input) out.cleaningDurationMinutes = Math.max(1, Math.floor(num(input.cleaningDurationMinutes, 1, 1440, 'Duração da limpeza')));
  if ('notes' in input) out.notes = String(input.notes ?? '').trim().slice(0, 500);
  if ('images' in input) {
    const list = Array.isArray(input.images) ? input.images : [];
    out.images = list.filter((x: unknown) => typeof x === 'string' && x.length > 0 && x.length <= 1000).slice(0, 5);
  }
  if ('active' in input) out.active = input.active !== false;
  return out;
}

/** Só o que mudou de facto (antes → depois), para o registo de alterações. As fotos contam-se, não se listam. */
export function diffRoomConfig(before: AnyRec, patch: AnyRec): { before: AnyRec; after: AnyRec } | null {
  const b: AnyRec = {};
  const a: AnyRec = {};
  for (const k of Object.keys(patch)) {
    const oldV = k === 'images' ? (Array.isArray(before.images) ? before.images.length : 0) : before[k];
    const newV = k === 'images' ? patch.images.length : patch[k];
    const norm = (v: unknown) => (v === undefined || v === null || v === '' ? 0 : v);
    const same = typeof newV === 'number' || typeof oldV === 'number' ? Number(norm(oldV)) === Number(norm(newV)) : (oldV ?? '') === (newV ?? '');
    if (!same) { b[k === 'images' ? 'imagesCount' : k] = oldV ?? null; a[k === 'images' ? 'imagesCount' : k] = newV; }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}
