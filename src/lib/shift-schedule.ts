// Turnos de cada hotel (ex.: 07:00–17:00, ou 07:00–07:00). Contas puras na hora de Maputo (UTC+2), testáveis.

export type ShiftSlot = { name: string; start: string; end: string };

export const MAX_SHIFT_SLOTS = 6;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAPUTO_MS = 2 * 3600_000;

export const isHHMM = (v: unknown): v is string => typeof v === 'string' && HHMM.test(v);

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Limpa o que vem do cliente/Firestore: só turnos com nome e horas válidas, no máximo 6. */
export function sanitizeSchedule(raw: unknown): ShiftSlot[] {
    if (!Array.isArray(raw)) return [];
    const out: ShiftSlot[] = [];
    for (const r of raw) {
        const o = r as Partial<ShiftSlot> | null;
        const name = String(o?.name ?? '').trim().slice(0, 30);
        if (!name || !isHHMM(o?.start) || !isHHMM(o?.end)) continue;
        out.push({ name, start: o!.start as string, end: o!.end as string });
        if (out.length >= MAX_SHIFT_SLOTS) break;
    }
    return out;
}

/** Minutos desde a meia-noite, em Maputo. */
export const minutesMaputo = (d: Date) => {
    const m = new Date(d.getTime() + MAPUTO_MS);
    return m.getUTCHours() * 60 + m.getUTCMinutes();
};

/** O turno cobre este minuto do dia? Fim antes do início = passa a meia-noite; início = fim = o dia todo. */
export function slotContains(slot: ShiftSlot, minutes: number): boolean {
    const s = toMin(slot.start);
    const e = toMin(slot.end);
    if (s === e) return true;
    return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

/** O turno previsto para esta hora (o primeiro que a cobre), ou null. */
export function slotAt(schedule: ShiftSlot[], d: Date): ShiftSlot | null {
    const m = minutesMaputo(d);
    return schedule.find((s) => slotContains(s, m)) || null;
}

/** A hora em que o turno que começou em `openedAt` devia acabar (a próxima vez que o relógio chega ao fim do turno). */
export function slotEnd(slot: ShiftSlot, openedAt: Date): Date {
    const m = minutesMaputo(openedAt);
    let delta = (toMin(slot.end) - m + 1440) % 1440;
    if (delta === 0) delta = 1440;
    const base = Math.floor(openedAt.getTime() / 60_000) * 60_000;
    return new Date(base + delta * 60_000);
}
