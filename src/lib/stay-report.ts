// Detalhes das estadias para o Histórico, os Relatórios e o email do fecho do dia: contas puras, sem Firebase, testáveis.

export type StayLike = {
    id: string;
    roomName?: string;
    clientName?: string;
    clientPhone?: string;
    clientDoc?: string;
    vehiclePlate?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    checkInAt?: unknown;
    checkOutAt?: unknown;
    contractedHours?: number;
    extensions?: { hours?: number }[];
    consumptions?: { quantity?: number; unitPrice?: number; totalPrice?: number; productName?: string }[];
    removedConsumptions?: RemovedConsumption[];
    billedHours?: number;
    packageType?: string;
    totalAmountDue?: number;
    totalAmountPaid?: number;
    discountAmount?: number;
    discountReason?: string;
    discountByName?: string;
    paymentMethod?: string;
    openedByName?: string;
    closedByName?: string;
    status?: string;
    saleId?: string;
};

export type RemovedConsumption = {
    productName?: string;
    quantity?: number;
    unitPrice?: number;
    reason?: string;
    removedAt?: string;
    removedByName?: string;
};

const MAPUTO_MS = 2 * 3600_000;

/** Timestamp da Firestore (cliente ou admin), { seconds }, ISO ou Date → Date (ou null). */
export function toDate(v: unknown): Date | null {
    if (!v) return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
    const o = v as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof o.toDate === 'function') return o.toDate();
    if (typeof o.seconds === 'number') return new Date(o.seconds * 1000);
    if (typeof o._seconds === 'number') return new Date(o._seconds * 1000);
    if (typeof v === 'string' || typeof v === 'number') {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "14:05" na hora de Maputo (o servidor corre em UTC). */
export function hhmmMaputo(d: Date | null): string {
    if (!d) return '—';
    const m = new Date(d.getTime() + MAPUTO_MS);
    return `${pad2(m.getUTCHours())}:${pad2(m.getUTCMinutes())}`;
}

/** "18/11 14:05" na hora de Maputo. */
export function dayTimeMaputo(d: Date | null): string {
    if (!d) return '—';
    const m = new Date(d.getTime() + MAPUTO_MS);
    return `${pad2(m.getUTCDate())}/${pad2(m.getUTCMonth() + 1)} ${pad2(m.getUTCHours())}:${pad2(m.getUTCMinutes())}`;
}

/** O dia de Maputo (AAAA-MM-DD) de uma data. */
export const maputoDay = (d: Date) => new Date(d.getTime() + MAPUTO_MS).toISOString().slice(0, 10);

/** Matrícula só com letras e números, em maiúsculas: "abc-123 mp" e "ABC123MP" são a mesma. */
export const normalizePlate = (s: unknown) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** "ABC 123 MP · Toyota Hilux · Branco" (o que houver). */
export function vehicleText(s: StayLike): string {
    const model = [s.vehicleBrand, s.vehicleModel].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
    return [String(s.vehiclePlate || '').trim().toUpperCase(), model, String(s.vehicleColor || '').trim()].filter(Boolean).join(' · ');
}

export const hasVehicle = (s: StayLike) => normalizePlate(s.vehiclePlate).length > 0;

/** A estadia bate com a pesquisa? Matrícula (sem espaços nem traços), marca, modelo ou cor. */
export function stayMatchesVehicle(s: StayLike, query: string): boolean {
    const q = query.trim();
    if (!q) return false;
    const plateQ = normalizePlate(q);
    if (plateQ.length >= 2 && normalizePlate(s.vehiclePlate).includes(plateQ)) return true;
    const text = vehicleText(s).toLowerCase();
    return q.length >= 3 && text.includes(q.toLowerCase());
}

const money = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;

export type StayRow = {
    id: string;
    saleId?: string;
    room: string;
    client: string;
    vehicle: string;
    hasVehicle: boolean;
    checkIn: Date | null;
    checkOut: Date | null;
    open: boolean;
    /** horas contratadas (com prorrogações) */
    contractedHours: number;
    extensionsCount: number;
    billedHours: number;
    package?: string;
    roomAmount: number;
    consumptionsAmount: number;
    discount: number;
    total: number;
    paid: number;
    paymentMethod: string;
    checkInBy: string;
    checkOutBy: string;
};

/** Os números de uma estadia, iguais em todo o lado. Total = quarto + bar − desconto. */
export function stayRow(s: StayLike): StayRow {
    const consumptionsAmount = money((s.consumptions || []).reduce(
        (sum, c) => sum + (Number.isFinite(Number(c.totalPrice)) ? Number(c.totalPrice) : (Number(c.quantity) || 0) * (Number(c.unitPrice) || 0)), 0));
    const discount = money(s.discountAmount);
    const total = money(s.totalAmountDue);
    const extensions = s.extensions || [];
    const contracted = (Number(s.contractedHours) || 0) + extensions.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
    const open = s.status === 'open';
    return {
        id: s.id,
        saleId: s.saleId,
        room: String(s.roomName || 'Quarto'),
        client: String(s.clientName || '').trim() || 'Hóspede',
        vehicle: vehicleText(s),
        hasVehicle: hasVehicle(s),
        checkIn: toDate(s.checkInAt),
        checkOut: open ? null : toDate(s.checkOutAt),
        open,
        contractedHours: contracted,
        extensionsCount: extensions.length,
        billedHours: Number(s.billedHours) || 0,
        package: s.packageType === 'pernoite' ? 'Pernoite' : s.packageType === 'diaria' ? 'Diária' : undefined,
        roomAmount: Math.max(0, money(total + discount - consumptionsAmount)),
        consumptionsAmount,
        discount,
        total,
        paid: money(s.totalAmountPaid),
        paymentMethod: String(s.paymentMethod || '').trim(),
        checkInBy: String(s.openedByName || '').trim(),
        checkOutBy: String(s.closedByName || '').trim(),
    };
}

/** A estadia que deu origem a esta venda (venda com stayId, ou estadia com o saleId da venda — as antigas). */
export function stayForSale<T extends StayLike>(sale: { id: string; stayId?: string }, stays: T[]): T | undefined {
    if (sale.stayId) {
        const byId = stays.find((s) => s.id === sale.stayId);
        if (byId) return byId;
    }
    return stays.find((s) => s.saleId === sale.id);
}

/** Estadias fechadas (check-out) dentro de [start, end]. As mais recentes primeiro. */
export function staysClosedBetween<T extends StayLike>(stays: T[], start: Date, end: Date): T[] {
    const a = start.getTime(), b = end.getTime();
    return stays
        .filter((s) => s.status !== 'open' && s.status !== 'cancelled')
        .filter((s) => { const t = toDate(s.checkOutAt)?.getTime(); return t !== undefined && t >= a && t <= b; })
        .sort((x, y) => (toDate(y.checkOutAt)?.getTime() || 0) - (toDate(x.checkOutAt)?.getTime() || 0));
}

/** Estadias ainda abertas = viaturas no parque agora. As mais antigas primeiro. */
export function openStays<T extends StayLike>(stays: T[]): T[] {
    return stays
        .filter((s) => s.status === 'open')
        .sort((x, y) => (toDate(x.checkInAt)?.getTime() || 0) - (toDate(y.checkInAt)?.getTime() || 0));
}

/** Check-ins feitos em [start, end] sem matrícula registada. */
export function checkInsWithoutPlate<T extends StayLike>(stays: T[], start: Date, end: Date): T[] {
    const a = start.getTime(), b = end.getTime();
    return stays.filter((s) => {
        if (s.status === 'cancelled') return false;
        const t = toDate(s.checkInAt)?.getTime();
        return t !== undefined && t >= a && t <= b && !hasVehicle(s);
    });
}

/** Totais de um conjunto de estadias: quartos, bar, descontos, total. */
export function staysTotals(rows: StayRow[]) {
    return rows.reduce((t, r) => ({
        count: t.count + 1,
        rooms: money(t.rooms + r.roomAmount),
        bar: money(t.bar + r.consumptionsAmount),
        discount: money(t.discount + r.discount),
        total: money(t.total + r.total),
    }), { count: 0, rooms: 0, bar: 0, discount: 0, total: 0 });
}

/** Recebido por forma de pagamento (o texto como foi escolhido; vazio = "Não indicado"). Maior primeiro. */
export function totalsByPayment(items: { paymentMethod?: string; amount: number }[]): { method: string; amount: number; count: number }[] {
    const by = new Map<string, { method: string; amount: number; count: number }>();
    for (const it of items) {
        const raw = String(it.paymentMethod || '').trim();
        const method = raw || 'Não indicado';
        const key = method.toLowerCase();
        const cur = by.get(key) || { method, amount: 0, count: 0 };
        cur.amount = money(cur.amount + (Number(it.amount) || 0));
        cur.count += 1;
        by.set(key, cur);
    }
    return [...by.values()].filter((x) => x.amount !== 0 || x.count > 0).sort((a, b) => b.amount - a.amount);
}
