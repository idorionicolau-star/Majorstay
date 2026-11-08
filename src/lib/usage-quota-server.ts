import 'server-only';
import { initializeAdmin } from '@/lib/firebase-admin';

/** Pedidos ao assistente / IA por empresa por dia: protege o crédito de IA de abusos (o uso normal fica muito abaixo). */
export const AI_DAILY_LIMIT = 200;

/**
 * Conta mais um pedido de IA para a empresa (ou a pessoa, se ainda não tem empresa) e diz se ainda cabe no limite.
 * O super-administrador não conta.
 */
export async function takeAiQuota(decoded: { uid: string; companyId?: string; superAdmin?: boolean } | null | undefined): Promise<boolean> {
    if (!decoded) return false;
    if (decoded.superAdmin) return true;
    const db = initializeAdmin().firestore();
    const who = decoded.companyId || `user-${decoded.uid}`;
    const ref = db.doc(`usageQuota/${who}_${new Date().toISOString().slice(0, 10)}`);
    return db.runTransaction(async (tx) => {
        const used = Number((await tx.get(ref)).get('ai')) || 0;
        if (used >= AI_DAILY_LIMIT) return false;
        tx.set(ref, { ai: used + 1, updatedAt: new Date().toISOString() }, { merge: true });
        return true;
    });
}
