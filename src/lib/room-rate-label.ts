import { formatCurrency } from '@/lib/utils';

/**
 * Como mostrar o preço de um quarto. Com mínimo de horas, o preço é por bloco ("1000 a cada 2h"),
 * nunca "1000/hora": é isso que o hóspede paga e o que o administrador configurou.
 * `short` usa "/h" em vez de "/hora" (espaços apertados).
 */
export function roomRateLabel(ratePerHour: number | undefined, minimumHours: number | undefined, short = false): string {
  const price = formatCurrency(Number(ratePerHour) || 0);
  const block = Math.max(1, Math.floor(Number(minimumHours) || 1));
  return block > 1 ? `${price} a cada ${block}h` : `${price}${short ? '/h' : '/hora'}`;
}
