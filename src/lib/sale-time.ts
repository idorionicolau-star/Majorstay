// Data e hora de uma venda, para mostrar no histórico e nos detalhes. Puro, para ser testado.
//
// `sale.date` das vendas feitas na app traz a hora (ISO); as antigas, ou as com a data escolhida à mão, trazem só o dia
// (meia-noite). Meia-noite não é uma hora de venda: nesses casos não se inventa hora — só se mostra o dia.
// Se a data não tem hora mas a venda foi registada nesse mesmo dia, usa-se a hora do registo (`timestamp`).
export type SaleMoment = {
    /** dd/mm/aaaa */
    day: string;
    /** hh:mm, ou null quando não se sabe */
    time: string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (y: number, m: number, d: number) => `${pad(d)}/${pad(m)}/${y}`;

/** Firestore Timestamp, Date, número ou texto → Date (ou null). */
export function toDate(v: unknown): Date | null {
    if (!v) return null;
    const any = v as { toDate?: () => Date; seconds?: number };
    const d = typeof any.toDate === 'function' ? any.toDate() : typeof any.seconds === 'number' ? new Date(any.seconds * 1000) : v instanceof Date ? v : new Date(v as string | number);
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
}

const isLocalMidnight = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
const isUtcMidnight = (d: Date) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;

export function saleMoment(sale: { date?: string; timestamp?: unknown }): SaleMoment {
    const raw = sale.date || '';
    const d = toDate(raw);
    if (!d) return { day: '', time: null };

    // data sem hora: "2026-10-01" ou meia-noite UTC → o dia é o escrito (UTC), para não andar um dia para trás
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw) || (isUtcMidnight(d) && !isLocalMidnight(d));
    const localMidnight = isLocalMidnight(d);
    if (dateOnly || localMidnight) {
        const [y, m, dd] = dateOnly ? [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()] : [d.getFullYear(), d.getMonth() + 1, d.getDate()];
        // sem hora na data: se foi registada nesse mesmo dia, a hora do registo serve
        const ts = toDate(sale.timestamp);
        if (ts && ts.getFullYear() === y && ts.getMonth() + 1 === m && ts.getDate() === dd) return { day: dayOf(y, m, dd), time: `${pad(ts.getHours())}:${pad(ts.getMinutes())}` };
        return { day: dayOf(y, m, dd), time: null };
    }
    return { day: dayOf(d.getFullYear(), d.getMonth() + 1, d.getDate()), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** "03/10/2026 às 14:32" (ou só o dia). */
export const formatSaleMoment = (sale: { date?: string; timestamp?: unknown }) => {
    const m = saleMoment(sale);
    return m.time ? `${m.day} às ${m.time}` : m.day;
};

/**
 * A data a gravar quando se escolhe um dia no calendário ao corrigir uma venda: o mesmo dia fica exactamente como
 * estava; outro dia mantém a hora a que a venda foi feita (antes ficava à meia-noite e a hora perdia-se).
 */
export function withSaleTime(day: Date, original?: string): string {
    const picked = dayOf(day.getFullYear(), day.getMonth() + 1, day.getDate());
    const before = saleMoment({ date: original });
    if (original && before.day === picked) return original;
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const o = toDate(original);
    if (o && before.time) d.setHours(o.getHours(), o.getMinutes(), o.getSeconds(), o.getMilliseconds());
    return d.toISOString();
}
