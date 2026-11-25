// Cálculo do check-out feito sempre da mesma maneira: na cotação (o que o ecrã mostra) e ao concluir (o que fica gravado).
import { calculateStayPricing, normalizeDate, totalContractedHours, type StayPricingResult } from '@/lib/hospitality-calc';

type AnyRec = Record<string, any>;

/** Consumos validados e com o total recalculado (nunca se confia no totalPrice guardado). */
export function sanitizeConsumptions(list: unknown): AnyRec[] {
  return ((Array.isArray(list) ? list : []) as AnyRec[]).map((c) => {
    const qty = Number(c.quantity);
    const unitPrice = Number(c.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(unitPrice) || qty <= 0 || unitPrice < 0) {
      throw new Error(`Consumo com valor inválido detectado na estadia (${c.productName || 'Item'}): quantidade=${c.quantity}, preço=${c.unitPrice}.`);
    }
    return { ...c, quantity: qty, unitPrice, totalPrice: qty * unitPrice };
  });
}

/** Horas, valor do quarto e consumos de uma estadia, às `at` horas (a hora do servidor). */
export function stayPricingAt(stayData: AnyRec, roomData: AnyRec, at: Date) {
  const checkInDate = normalizeDate(stayData.checkInAt);
  const contractedHours = totalContractedHours(stayData as any);
  const ratePerHour = Number(stayData.ratePerHourApplied || roomData.ratePerHour || 0);
  const consumptions = sanitizeConsumptions(stayData.consumptions);
  const pricing = calculateStayPricing({
    checkInAt: checkInDate,
    checkOutAt: at,
    contractedHours,
    ratePerHour,
    graceMinutes: 10,
    consumptions: consumptions as any,
    packagePrice: Number(stayData.packagePrice) || undefined,
    packageHours: Number(stayData.packageHours) || undefined,
    blockHours: Number(stayData.blockHours) || undefined,
  });
  return { pricing, checkInDate, contractedHours, ratePerHour, consumptions };
}

/** O que o ecrã precisa saber do servidor: a hora dele, o fim previsto e os números da cobrança. */
export type CheckoutQuote = {
  serverNow: number;
  checkInAt: number;
  expectedEndAt: number;
  contractedHours: number;
  pricing: Pick<StayPricingResult, 'durationMinutes' | 'billedHours' | 'stayAmountDue' | 'consumptionsAmountDue' | 'totalAmountDue' | 'isOvertime' | 'overtimeHours'>;
};

export function buildQuote(stayData: AnyRec, roomData: AnyRec, at: Date): CheckoutQuote {
  const { pricing, checkInDate, contractedHours } = stayPricingAt(stayData, roomData, at);
  const { durationMinutes, billedHours, stayAmountDue, consumptionsAmountDue, totalAmountDue, isOvertime, overtimeHours } = pricing;
  return {
    serverNow: at.getTime(),
    checkInAt: checkInDate.getTime(),
    expectedEndAt: checkInDate.getTime() + contractedHours * 3600_000,
    contractedHours,
    pricing: { durationMinutes, billedHours, stayAmountDue, consumptionsAmountDue, totalAmountDue, isOvertime, overtimeHours },
  };
}

/** O total que o ecrã mostrou já não é o do servidor? (diferença de mais de 1 cêntimo). Sem valor esperado (ecrã antigo): não trava. */
export function priceChanged(expected: unknown, serverTotal: number): boolean {
  if (expected === undefined || expected === null || expected === '') return false;
  const n = Number(expected);
  if (!Number.isFinite(n)) return true;
  return Math.abs(n - serverTotal) > 0.009;
}
