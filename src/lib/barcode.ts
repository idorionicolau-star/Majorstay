import type { Product } from '@/lib/types';

// Código de barras: normalizar o que o leitor entrega e encontrar o produto.
// Puro (sem câmara nem Firebase) para ser testado.

/** Só dígitos/letras, sem espaços (leitores por vezes acrescentam espaços, hífenes ou prefixos). */
export const normalizeBarcode = (raw: string) => raw.trim().replace(/[\s-]/g, '').toUpperCase();

/**
 * Parece um código lido por leitor? (6+ caracteres alfanuméricos, sem espaços, pelo menos 5 dígitos).
 * Serve para o campo de pesquisa saber que Enter = "isto foi lido", não escrito: um nome de produto
 * como "Bloco 15" tem espaços e poucos dígitos, por isso não é confundido.
 */
export const looksLikeBarcode = (raw: string) => {
  const t = raw.trim();
  if (/\s/.test(t)) return false;
  const n = normalizeBarcode(t);
  return n.length >= 6 && n.length <= 24 && /^[A-Z0-9]+$/.test(n) && (n.match(/\d/g) || []).length >= 5;
};

/** Produto com este código (se o código tiver zeros à esquerda a mais ou a menos — UPC-A vs EAN-13 — também encontra). */
export function findByBarcode(products: Product[], raw: string, location?: string): Product | undefined {
  const code = normalizeBarcode(raw);
  if (!code) return undefined;
  const strip = (c: string) => (/^\d+$/.test(c) ? c.replace(/^0+/, '') : c);
  const target = strip(code);
  const matches = products.filter((p) => p.barcode && !p.deletedAt && strip(normalizeBarcode(p.barcode)) === target);
  if (!matches.length) return undefined;
  return matches.find((p) => !location || (p.location || '') === location) || matches[0];
}

/** Dígito de controlo EAN-13 / EAN-8 / UPC-A: um código lido com erro (borrado) não deve ser aceite. */
export function isValidEan(raw: string): boolean {
  const c = normalizeBarcode(raw);
  if (!/^\d+$/.test(c) || ![8, 12, 13].includes(c.length)) return false;
  const digits = c.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((t, d, i) => t + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
