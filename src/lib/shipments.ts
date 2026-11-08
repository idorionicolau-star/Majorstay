// Envios com confirmação de receção (opcional, plano Business): quem envia tira do stock de origem e a mercadoria
// fica "em trânsito" (não conta em lado nenhum) até quem recebe confirmar o que chegou. O que faltar fica registado
// como diferença, com quem enviou, quem recebeu e quando. Puro, para testes.

export type ShipmentStatus = 'em_transito' | 'recebido' | 'com_diferenca' | 'cancelado';

export type ShipmentItem = { name: string; unit: string; qty: number; received?: number };

export type Shipment = {
    id: string;
    code: string;
    status: ShipmentStatus;
    from: string;
    to: string;
    items: ShipmentItem[];
    sentBy: string;
    sentByName: string;
    sentAt: string;
    note?: string;
    receivedBy?: string;
    receivedByName?: string;
    receivedAt?: string;
    receiveNote?: string;
};

/** Código curto para falar do envio ("ENV-4F2K"). */
export function shipmentCode(now: Date, rand = Math.random): string {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 4; i++) s += abc[Math.floor(rand() * abc.length)];
    return `ENV-${now.getFullYear() % 100}${String(now.getMonth() + 1).padStart(2, '0')}-${s}`;
}

/** Quantidade recebida válida: entre 0 e o enviado (não se recebe mais do que saiu). */
export const clampReceived = (sent: number, received: number) => Math.max(0, Math.min(sent, Number.isFinite(received) ? received : 0));

/** O resultado de confirmar: o que entra em cada produto, as faltas e o novo estado. */
export function receiveResult(items: ShipmentItem[], received: Record<string, number>): { items: ShipmentItem[]; missing: { name: string; unit: string; qty: number }[]; status: ShipmentStatus } {
    const out = items.map((i) => ({ ...i, received: clampReceived(i.qty, received[i.name] ?? i.qty) }));
    const missing = out.filter((i) => i.received! < i.qty).map((i) => ({ name: i.name, unit: i.unit, qty: +(i.qty - i.received!).toFixed(4) }));
    return { items: out, missing, status: missing.length ? 'com_diferenca' : 'recebido' };
}

/** Pendentes para estes locais (null = todos). */
export const pendingFor = (list: Shipment[], mine: Set<string> | null) =>
    list.filter((s) => s.status === 'em_transito' && (!mine || mine.has(s.to)));

export const STATUS_LABEL: Record<ShipmentStatus, string> = {
    em_transito: 'Em trânsito',
    recebido: 'Recebido',
    com_diferenca: 'Recebido com diferença',
    cancelado: 'Cancelado',
};
