// Matéria-prima gasta (ou devolvida) por uma produção, dentro de uma transacção do Firestore.
// Usado por todos os caminhos que põem produto no stock, para nenhum deixar a matéria-prima por descontar.
import { doc, type DocumentReference, type Firestore, type Transaction } from 'firebase/firestore';
import type { Production, RawMaterial, Recipe } from '@/lib/types';
import { cleanMaterials, recipeMaterials, type MaterialLine } from '@/lib/production-core';
import { ingredientRequiredQty } from '@/lib/order-stock';
import { nameKey } from '@/lib/catalog-view';

export type MaterialUse = { ref: DocumentReference; data: RawMaterial; qty: number };

/** A receita do produto: ignora acentos, maiúsculas e espaços a mais ("Pavê Borbulha" = "pave borbulha"). */
export const findRecipe = <T extends { productName: string }>(recipes: T[] | undefined, productName: string): T | undefined =>
    recipes?.find((r) => nameKey(r.productName || '') === nameKey(productName || ''));

/** LER (tem de vir antes de qualquer escrita da transacção): as matérias-primas da receita do produto. */
export async function readMaterialUse(
    transaction: Transaction, firestore: Firestore, companyId: string,
    recipes: Recipe[] | undefined, productName: string, quantity: number,
): Promise<MaterialUse[]> {
    const recipe = findRecipe(recipes, productName);
    const uses: MaterialUse[] = [];
    for (const ing of recipe?.ingredients || []) {
        const ref = doc(firestore, `companies/${companyId}/rawMaterials`, ing.rawMaterialId);
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error(`Matéria-prima não encontrada (ID: ${ing.rawMaterialId}) para a receita de ${productName}.`);
        uses.push({ ref, data: snap.data() as RawMaterial, qty: ingredientRequiredQty(ing, quantity) });
    }
    return uses;
}

/** Recusa se faltar matéria-prima. */
export function assertMaterialEnough(uses: MaterialUse[]) {
    for (const u of uses) {
        if ((u.data.stock || 0) < u.qty) throw new Error(`Stock insuficiente de ${u.data.name}. Necessário: ${u.qty}, Disponível: ${u.data.stock || 0}.`);
    }
}

/** ESCREVER: desconta (sign -1) ou devolve (sign +1) a matéria-prima. */
export function applyMaterialUse(transaction: Transaction, uses: MaterialUse[], sign: 1 | -1) {
    for (const u of uses) transaction.update(u.ref, { stock: Math.max(0, (u.data.stock || 0) + sign * u.qty) });
}

/** A matéria-prima de uma produção: a que ficou registada; nas antigas (sem registo), a da receita. */
export function productionMaterials(prod: Pick<Production, 'productName' | 'quantity' | 'materialsUsed'>, recipes: Recipe[] | undefined, raw: RawMaterial[] = []): MaterialLine[] {
    if (Array.isArray(prod.materialsUsed)) return cleanMaterials(prod.materialsUsed);
    return recipeMaterials(findRecipe(recipes, prod.productName), prod.quantity, raw);
}

/** LER: os documentos das matérias-primas de uma lista (a quantidade de cada `MaterialUse` é a da linha). */
export async function readMaterialLines(transaction: Transaction, firestore: Firestore, companyId: string, lines: MaterialLine[]): Promise<MaterialUse[]> {
    const uses: MaterialUse[] = [];
    for (const l of cleanMaterials(lines)) {
        const ref = doc(firestore, `companies/${companyId}/rawMaterials`, l.rawMaterialId);
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error(`A matéria-prima "${l.name}" já não existe.`);
        uses.push({ ref, data: snap.data() as RawMaterial, qty: l.quantity });
    }
    return uses;
}
