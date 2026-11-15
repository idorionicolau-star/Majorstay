/** Contas abertas no Lounge & Bar: o cliente consome e paga no fim (ou passa a conta para um quarto). */
export type TabItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit?: string;
  location?: string;
  unitCost?: number;
  addedAt: string;
  addedByName: string;
};

export type Tab = {
  id: string;
  clientName: string;
  phone?: string;
  status: 'open' | 'closed' | 'transferred';
  items: TabItem[];
  openedAt: string;
  openedByName: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const tabTotal = (items: Pick<TabItem, 'totalPrice'>[]): number => round2(items.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0));

export function cleanClientName(raw: unknown): string {
  return String(raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
}
