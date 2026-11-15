/** Desconto no check-out: sem valor fixo, mas com motivo obrigatório e nunca acima do total. */
export const DISCOUNT_REASONS = ['Cliente frequente', 'Estadia longa', 'Negociação', 'Reclamação / problema no quarto', 'Autorizado pelo gerente', 'Outro'] as const;

export type ValidDiscount = { amount: number; reason: string };

/** Devolve o desconto validado (ou zero). Lança erro se faltar o motivo ou se passar do total. */
export function validateDiscount(rawAmount: unknown, rawReason: unknown, grossTotal: number): ValidDiscount {
  const amount = Math.round((Number(rawAmount) || 0) * 100) / 100;
  if (!(amount > 0)) return { amount: 0, reason: '' };
  const reason = String(rawReason ?? '').trim().slice(0, 200);
  if (reason.length < 3) throw new Error('Indique o motivo do desconto.');
  if (amount > grossTotal) throw new Error('O desconto não pode ser maior que o total da conta.');
  return { amount, reason };
}
