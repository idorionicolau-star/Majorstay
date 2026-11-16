import { DISH_PREFIX, dishAvailable } from '@/lib/dishes';
import { KITCHEN_ENABLED, isKitchenProduct } from '@/lib/features';

export type RoomMenuItem = { id: string; name: string; price: number; category?: string; isDish?: boolean; soldByWeight?: boolean; unit?: string; available?: number };

/** Catálogo (bebidas, snacks, pratos do dia) que o hóspede vê no QR do quarto. */
export async function loadRoomMenu(db: FirebaseFirestore.Firestore, companyId: string): Promise<RoomMenuItem[]> {
  const barProducts: RoomMenuItem[] = [];
    try {
      const prodSnap = await db
        .collection(`companies/${companyId}/products`)
        .limit(100)
        .get();

      const seenNames = new Set<string>();
      for (const docSnap of prodSnap.docs) {
        const p = docSnap.data() || {};
        if (p.deletedAt) continue;
        if (!KITCHEN_ENABLED && isKitchenProduct(p)) continue;
        const price = Number(p.price !== undefined ? p.price : (p.salePrice !== undefined ? p.salePrice : 0));
        if (!Number.isFinite(price) || price <= 0) continue;

        const name = (p.name || 'Produto').trim();
        const normalizedName = name.toLowerCase();
        if (seenNames.has(normalizedName)) continue;
        seenNames.add(normalizedName);

        barProducts.push({
          id: docSnap.id,
          name,
          price,
          category: p.category || (p.isDish ? 'Cozinha' : 'Bar'),
          isDish: Boolean(p.isDish),
          soldByWeight: Boolean(p.soldByWeight),
          unit: p.unit || 'un',
        });

        if (barProducts.length >= 30) break;
      }
      // Pratos do dia: só os que ainda têm doses hoje
      const dishSnap = await db.collection(`companies/${companyId}/dishes`).limit(60).get();
      for (const d of dishSnap.docs) {
        const dd = d.data() || {};
        const left = dishAvailable(dd);
        const price = Number(dd.price);
        if (left <= 0 || !Number.isFinite(price) || price <= 0) continue;
        barProducts.push({ id: `${DISH_PREFIX}${d.id}`, name: String(dd.name || 'Prato').trim(), price, category: 'Pratos do dia', isDish: true, unit: 'un', available: left });
      }
    } catch (e) {
      console.warn('Erro ao carregar produtos do bar:', e);
    }
  return barProducts;
}
