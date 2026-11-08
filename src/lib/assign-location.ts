// Produtos registados antes de activar as localizações ficam sem local (ou com "Principal", que já não existe).
// Pô-los num local: muda-se o local; se lá já houver um produto com o mesmo nome, junta-se o stock nele
// (e o duplicado fica a zero na lixeira). Lógica pura, testada.
import { nameKey } from '@/lib/catalog-view';

type P = { id?: string; name: string; location?: string; stock?: number; reservedStock?: number; deletedAt?: string | null };

/** Os produtos (documentos) que não estão em nenhuma das localizações da empresa. */
export function unassignedProducts<T extends P>(products: T[], locationIds: string[]): T[] {
    const ids = new Set(locationIds);
    return products.filter((p) => p.id && !p.deletedAt && !ids.has(p.location || ''));
}

export type AssignPlan = {
    /** muda só o local */
    moves: string[];
    /** já existe no destino: soma o stock nesse e o de origem vai para a lixeira a zero */
    merges: { fromId: string; intoId: string; stock: number; reserved: number }[];
};

export function planAssignLocation(selected: P[], all: P[], target: string): AssignPlan {
    const plan: AssignPlan = { moves: [], merges: [] };
    const atTarget = new Map<string, string>();
    for (const p of all) if (p.id && !p.deletedAt && (p.location || '') === target && !atTarget.has(nameKey(p.name))) atTarget.set(nameKey(p.name), p.id);
    for (const p of selected) {
        if (!p.id || p.deletedAt || (p.location || '') === target) continue;
        const into = atTarget.get(nameKey(p.name));
        if (into && into !== p.id) plan.merges.push({ fromId: p.id, intoId: into, stock: p.stock || 0, reserved: p.reservedStock || 0 });
        else { plan.moves.push(p.id); atTarget.set(nameKey(p.name), p.id); }
    }
    return plan;
}
