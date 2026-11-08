import { collection, doc, getDoc, getDocs, query, where, type DocumentReference, type Firestore } from 'firebase/firestore';

/**
 * O documento do produto no INVENTÁRIO. O `productId` de uma encomenda pode ser o ID do inventário, o ID do
 * catálogo (são diferentes) ou o nome — por isso tenta o ID e, se não existir, procura por nome + localização.
 */
/**
 * Numa empresa de um só local, "Principal" e "sem local" ("") são o MESMO sítio: os produtos criados pelo Stock Rápido
 * ficam com "" e as vendas/produção procuram "Principal". Quem procurava só um dos dois não encontrava o produto
 * (ex.: apagar uma venda dizia "o stock foi reposto" e não repunha nada). Usar sempre `where('location','in', locationIn(x))`.
 */
export const locationIn = (loc?: string | null): string[] => (!loc || loc === 'Principal' ? ['Principal', ''] : [loc]);

/** Igualdade de locais com a mesma regra ("" = "Principal"). */
export const sameLocation = (a?: string | null, b?: string | null): boolean => {
    const n = (x?: string | null) => (!x || x === 'Principal' ? '' : x);
    return n(a) === n(b);
};

/** O primeiro produto que NÃO está na lixeira. Os da lixeira continuam na base de dados e nunca devem receber stock nem reservas. */
export function pickActive<T extends { data(): any }>(docs: T[]): T | undefined {
    return docs.find((d) => !d.data()?.deletedAt);
}

export async function resolveInventoryProductRef(
    firestore: Firestore,
    companyId: string,
    ref: { productId?: string; productName: string; location?: string },
): Promise<DocumentReference | null> {
    const products = collection(firestore, `companies/${companyId}/products`);
    if (ref.productId) {
        const direct = doc(products, ref.productId);
        const snap = await getDoc(direct);
        if (snap.exists() && !snap.data()?.deletedAt) return direct;
    }
    const snap = await getDocs(query(products, where('name', '==', ref.productName), where('location', 'in', locationIn(ref.location))));
    return pickActive(snap.docs)?.ref ?? null;
}
