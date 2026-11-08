import type { Sale } from '@/lib/types';

// Campos que um vendedor nunca pode alterar (espelha as regras do Firestore).
export const MANAGER_ONLY_SALE_FIELDS = [
    'productId', 'productName', 'quantity', 'unit', 'unitPrice', 'unitCost', 'subtotal', 'discount', 'vat',
    'totalValue', 'date', 'soldBy', 'guideNumber', 'location', 'documentType', 'orderId', 'transactionId',
    'deletedAt', 'deletedBy', 'timestamp',
] as const;

const sameValue = (key: string, a: unknown, b: unknown) => {
    if (key === 'date' && a && b) return new Date(a as string).getTime() === new Date(b as string).getTime();
    // vazio = nada (uma nota que não existia não "muda" para "" só por se abrir e gravar o formulário)
    const none = (v: unknown) => (v === undefined || v === '' ? null : v);
    return none(a) === none(b);
};

/** Só os campos que realmente mudaram (evita regravar a venda inteira e apagar o que outro fez). */
export function diffSale(before: Sale, after: Partial<Sale>): Record<string, { de: unknown; para: unknown }> {
    const out: Record<string, { de: unknown; para: unknown }> = {};
    for (const key of Object.keys(after) as (keyof Sale)[]) {
        if (key === 'id') continue;
        if (!sameValue(key, before[key], after[key])) out[key] = { de: before[key] ?? null, para: after[key] ?? null };
    }
    return out;
}

/** Valores novos a gravar (sem o "de"). */
export const changesToUpdate = (d: Record<string, { de: unknown; para: unknown }>) =>
    Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.para === undefined ? null : v.para]));

/** O vendedor mexeu em algo que só o gestor pode mexer? */
export const sellerBlockedFields = (d: Record<string, unknown>) =>
    Object.keys(d).filter((k) => (MANAGER_ONLY_SALE_FIELDS as readonly string[]).includes(k));
