import { collection, doc, increment, serverTimestamp, type CollectionReference, type Firestore, type WriteBatch } from 'firebase/firestore';
import type { StockDelta, PlanMovement } from '@/lib/sale-plan';
import { reportError } from '@/lib/report-error';

/** Sem ligação? (o aparelho sabe quando o Wi-Fi/dados estão desligados) */
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Erro de "sem ligação" lançado antes de qualquer escrita (a transacção nem chegou a gravar),
 * por isso é seguro repetir a venda no modo offline.
 */
export const isOfflineReadError = (e: unknown) =>
  /client is offline/i.test(String((e as { message?: string })?.message || e));

/** Aplica as variações de stock com incrementos atómicos (funcionam offline e não se atropelam entre aparelhos). */
export function writeDeltas(batch: WriteBatch, productsRef: CollectionReference, deltas: StockDelta[], nowIso: string) {
  for (const d of deltas) {
    batch.update(doc(productsRef, d.id), {
      ...(d.stock ? { stock: increment(d.stock) } : {}),
      ...(d.reserved ? { reservedStock: increment(d.reserved) } : {}),
      ...(d.price !== undefined ? { price: d.price } : {}),
      lastUpdated: nowIso,
    });
  }
}

/** Movimentos de saída (histórico de stock) de uma venda ou levantamento. */
export function writeMovements(
  batch: WriteBatch,
  firestore: Firestore,
  companyId: string,
  movements: PlanMovement[],
  user: { id: string; username: string },
  reason: (m: PlanMovement) => string,
) {
  const col = collection(firestore, `companies/${companyId}/stockMovements`);
  for (const m of movements) {
    batch.set(doc(col), {
      productId: m.productId,
      productName: m.productName,
      type: 'OUT',
      quantity: -m.quantity,
      fromLocationId: m.location,
      reason: reason(m),
      userId: user.id,
      userName: user.username,
      timestamp: serverTimestamp(),
    });
  }
}

/**
 * Envia o lote para a fila local. Offline, `commit()` só termina quando o servidor confirma,
 * por isso NÃO se espera por ele: a escrita já está aplicada neste aparelho e segue sozinha
 * quando a internet voltar. Se o servidor a recusar mais tarde, o utilizador é avisado.
 */
export function queueBatch(batch: WriteBatch, what: string, notify: (title: string, description: string) => void) {
  batch.commit().catch((e) => {
    console.error(`[offline] ${what} recusado pelo servidor:`, e);
    reportError(e, 'offline-sync');
    notify(`${what}: não foi aceite pelo servidor`, `${(e as { message?: string })?.message || 'Erro desconhecido'}. Verifique o stock e repita a operação.`);
  });
}
