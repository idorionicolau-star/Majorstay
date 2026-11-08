import type { Product } from '@/lib/types';

// Links directos: cada aviso (notificação, push, diagnóstico) abre a página já filtrada
// no caso exacto — o produto, a venda, o funcionário — e não a lista genérica.
// Puro (sem React) para ser usado em contexto, API, service worker e páginas.

const available = (p: Pick<Product, 'stock' | 'reservedStock'>) => (p.stock || 0) - (p.reservedStock || 0);

/** Problemas de produto que o diagnóstico e os alertas sabem apontar. */
export const PRODUCT_PROBLEMS = {
  'sem-preco': { label: 'Produtos sem preço', hint: 'Dê um preço de venda — senão podem sair a 0 MT.', test: (p: Product) => !(p.price > 0) },
  'sem-custo': { label: 'Produtos sem custo', hint: 'Sem custo não há lucro real. Abra o produto e preencha o custo.', test: (p: Product) => !((p.cost || 0) > 0) },
  esgotado: { label: 'Produtos esgotados', hint: 'Não se podem vender até haver entrada ou produção.', test: (p: Product) => available(p) <= 0 },
  critico: { label: 'Stock crítico', hint: 'Estão abaixo do mínimo crítico — reponha.', test: (p: Product) => available(p) > 0 && available(p) <= (p.criticalStockThreshold || 0) },
  baixo: { label: 'Stock baixo', hint: 'Estão a ficar baixos.', test: (p: Product) => available(p) > (p.criticalStockThreshold || 0) && available(p) <= (p.lowStockThreshold || 0) },
  negativo: { label: 'Stock negativo', hint: 'Saiu mais do que entrou — registe a entrada que falta ou faça uma contagem.', test: (p: Product) => (p.stock || 0) < 0 },
  reservado: { label: 'Mais reservado do que em stock', hint: 'Normalmente são reservas antigas presas.', test: (p: Product) => (p.reservedStock || 0) > (p.stock || 0) && (p.reservedStock || 0) > 0 },
  unidades: { label: "Em 'un' com decimais", hint: 'Provavelmente a unidade certa é m², m ou kg.', test: (p: Product) => (p.unit || 'un') === 'un' && !Number.isInteger(p.stock || 0) },
  'limites-manuais': { label: 'Limites de stock fixos (manuais)', hint: 'Estes não se ajustam às vendas. Ponha-os em automático para o alerta baixo e crítico acompanharem o que sai.', test: (p: Product) => p.thresholdMode === 'manual' },
  'sem-categoria': { label: 'Sem categoria', hint: 'Escolha a categoria certa.', test: (p: Product) => !p.category || p.category === 'Geral' },
} as const;

export type ProblemKind = keyof typeof PRODUCT_PROBLEMS;

export const isProblemKind = (v: string | null | undefined): v is ProblemKind => !!v && Object.prototype.hasOwnProperty.call(PRODUCT_PROBLEMS, v);

const qs = (params: Record<string, string | undefined>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
};

export const links = {
  /** Todos os produtos com um problema (ex.: sem preço). */
  inventoryProblem: (kind: ProblemKind) => `/inventory${qs({ problema: kind })}`,
  /** Um produto concreto (e o local, quando há vários). */
  product: (name: string, location?: string) => `/inventory${qs({ produto: name, local: location })}`,
  /** Vários produtos concretos (ex.: os do alerta), sem depender de uma regra. */
  products: (names: string[], label?: string) => `/inventory${qs({ nomes: names.join('|'), titulo: label })}`,
  /** Uma venda concreta, pelo número da guia (ou id). */
  sale: (guideOrId: string) => `/sales${qs({ venda: guideOrId })}`,
  salesByStatus: (status: string) => `/sales${qs({ statusFilter: status })}`,
  /** Vendas de um produto — "qual foi o último a sair". */
  salesOfProduct: (name: string) => `/sales${qs({ venda: name })}`,
  employee: (id: string) => `/users${qs({ funcionario: id })}`,
  order: (id: string) => `/orders${qs({ encomenda: id })}`,
  orders: (status?: string) => `/orders${qs({ statusFilter: status })}`,
  customer: (name: string) => `/customers${qs({ cliente: name })}`,
  priceReviews: () => '/sales/precos',
  losses: (name?: string) => `/inventory/perdas${qs({ produto: name })}`,
  /** Produção: o que vai esgotar e quanto produzir. */
  productionPlan: () => '/production?planear=1',
  /** Registar uma produção já com o produto (e quantidade/local) escolhidos; `voltar` = para onde ir depois. */
  newProduction: (name: string, quantity?: number, location?: string, back?: string) =>
    `/production/new${qs({ produto: name, quantidade: quantity ? String(quantity) : undefined, local: location, voltar: back })}`,
};

/** Endereço de regresso seguro (só dentro da app e da secção esperada) — ou o de recurso. */
export function safeReturn(target: string | null | undefined, prefix: string, fallback: string): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return fallback;
  return target === prefix || target.startsWith(prefix + '?') || target.startsWith(prefix + '/') ? target : fallback;
}

// O inventário lembra-se de onde estava (com o filtro do aviso): editar um produto e voltar não perde o filtro.
const INVENTORY_URL_KEY = 'majorstockx-inventory-url';

export function rememberInventoryUrl(url: string) {
  try { sessionStorage.setItem(INVENTORY_URL_KEY, url); } catch { /* sem storage: volta ao inventário completo */ }
}

export function inventoryReturnUrl(): string {
  let saved: string | null = null;
  try { saved = sessionStorage.getItem(INVENTORY_URL_KEY); } catch { /* ignore */ }
  return safeReturn(saved, '/inventory', '/inventory');
}

/** Lê os parâmetros do inventário e devolve o filtro pedido pelo link (ou null = lista normal). */
export function parseInventoryFocus(params: { get(name: string): string | null }) {
  const problema = params.get('problema');
  const produto = params.get('produto');
  const nomes = params.get('nomes');
  return {
    problem: isProblemKind(problema) ? problema : null,
    product: produto || null,
    location: params.get('local') || null,
    names: nomes ? nomes.split('|').map((n) => n.trim()).filter(Boolean) : null,
    title: params.get('titulo') || null,
  };
}

export type InventoryFocus = ReturnType<typeof parseInventoryFocus>;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Aplica o filtro do link à lista de produtos. */
export function applyInventoryFocus(products: Product[], f: InventoryFocus): Product[] {
  if (f.problem) return products.filter(PRODUCT_PROBLEMS[f.problem].test);
  if (f.names) {
    const set = new Set(f.names.map(norm));
    return products.filter((p) => set.has(norm(p.name)));
  }
  if (f.product) {
    const n = norm(f.product);
    const exact = products.filter((p) => norm(p.name) === n && (!f.location || p.location === f.location));
    if (exact.length) return exact;
    const sameName = products.filter((p) => norm(p.name) === n);
    return sameName.length ? sameName : products.filter((p) => norm(p.name).includes(n));
  }
  return products;
}

export const hasInventoryFocus = (f: InventoryFocus) => !!(f.problem || f.names || f.product);

export function inventoryFocusTitle(f: InventoryFocus, count: number): { title: string; hint?: string } {
  if (f.problem) return { title: `${PRODUCT_PROBLEMS[f.problem].label} (${count})`, hint: PRODUCT_PROBLEMS[f.problem].hint };
  if (f.names) return { title: `${f.title || 'Produtos do alerta'} (${count})` };
  return { title: f.product || 'Produto' };
}
