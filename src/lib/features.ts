/**
 * Interruptores de funcionalidades.
 *
 * KITCHEN_ENABLED: Cozinha & Restaurante (pratos, alimentos em kg, pedidos de comida, senha da cozinha).
 * Está DESLIGADA por agora: sem menu, sem página, sem pratos à venda (balcão, quarto e QR) e o servidor recusa
 * qualquer prato. Para voltar a ligar, mude para `true` (os dados dos pratos não se perdem).
 */
export const KITCHEN_ENABLED = false;

type KitchenLike = { isDish?: boolean; isKitchenIngredient?: boolean; category?: string };

/** Prato ou matéria-prima da cozinha (só pelos sinais explícitos, para não apanhar produtos normais). */
export const isKitchenProduct = (p: KitchenLike | null | undefined): boolean =>
  !!p && (p.isDish === true || p.isKitchenIngredient === true || p.category === 'Cozinha / Alimentos' || p.category === 'Pratos Principais');
