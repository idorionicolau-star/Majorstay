import type { CartItem, Product, Sale } from '@/lib/types';

// Cálculo puro de uma venda (que stock sai/fica reservado, que documentos criar).
// É usado tanto pela venda normal (dentro de uma transacção) como pela venda offline
// (escrita local que sincroniza depois) — assim as duas fazem exactamente as mesmas contas.

export type PlanSource = {
  id: string;
  data: Pick<Product, 'name' | 'stock' | 'reservedStock'> & Partial<Pick<Product, 'location' | 'price' | 'cost'>>;
};

export type StockDelta = { id: string; stock: number; reserved: number; price?: number };
export type PlanMovement = { productId: string; productName: string; quantity: number; location?: string };
export type PlanUser = { id: string; username: string; role?: string };

export type BulkSaleInput = {
  documentType: Sale['documentType'];
  customerId?: string;
  clientName?: string;
  notes?: string;
  discount?: { type: 'fixed' | 'percentage'; value: number };
  applyVat: boolean;
  vatPercentage: number;
  isPickedUp?: boolean;
  date?: string;
  paymentMethod?: string;
  amountPaid?: number;
};

export type BulkSalePlan = {
  sales: Sale[];
  deltas: StockDelta[];
  movements: PlanMovement[];
  priceReviews: Record<string, any>[];
  cartSubtotal: number;
  totalDiscountAmount: number;
  cartTotal: number;
};

const isManager = (u: PlanUser) => u.role === 'Admin' || u.role === 'Dono';

/** O produto está neste local? (mesma regra que a venda usa há muito tempo) */
export function sourceMatches(
  s: PlanSource, productName: string, targetLocation: string | undefined, itemLocation: string | undefined, isMultiLocation: boolean,
) {
  return s.data.name === productName && (
    !isMultiLocation || s.data.location === targetLocation ||
    (!s.data.location && (targetLocation === 'Principal' || !itemLocation))
  );
}

export function planBulkSale(args: {
  items: CartItem[];
  saleData: BulkSaleInput;
  sources: PlanSource[];
  isMultiLocation: boolean;
  defaultLocation: string;
  user: PlanUser;
  guideNumber: string;
  nowIso: string;
  newId: () => string;
}): BulkSalePlan {
  const { items, saleData, sources, isMultiLocation, defaultLocation, user, guideNumber, nowIso, newId } = args;
  const isProforma = saleData.documentType === 'Factura Proforma';

  const cartSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalDiscountAmount = saleData.discount
    ? (saleData.discount.type === 'percentage' ? cartSubtotal * (saleData.discount.value / 100) : saleData.discount.value)
    : 0;
  const totalAfterDiscount = Math.max(0, cartSubtotal - totalDiscountAmount);
  const totalVatAmount = saleData.applyVat ? totalAfterDiscount * (saleData.vatPercentage / 100) : 0;
  const cartTotal = totalAfterDiscount + totalVatAmount;
  const paidRatio = saleData.amountPaid === undefined || cartTotal <= 0 ? 1 : Math.max(0, Math.min(1, saleData.amountPaid / cartTotal));

  // cópias de trabalho: duas linhas do mesmo produto no carrinho vêem o stock já descontado
  const work = new Map(sources.map((s) => [s.id, { ...s, data: { ...s.data }, stock: s.data.stock || 0, reserved: s.data.reservedStock || 0 }]));
  const deltas = new Map<string, StockDelta>();
  const delta = (id: string) => {
    const d = deltas.get(id) || { id, stock: 0, reserved: 0 };
    deltas.set(id, d);
    return d;
  };
  const movements: PlanMovement[] = [];
  const priceReviews: Record<string, any>[] = [];
  const sales: Sale[] = [];

  for (const item of items) {
    const targetLocation = item.location || defaultLocation;
    const available = [...work.values()].filter((s) => sourceMatches(s, item.productName, targetLocation, item.location, isMultiLocation));
    const totalAvailable = available.reduce((sum, s) => sum + (s.stock - s.reserved), 0);

    if (!isProforma && totalAvailable < item.quantity) {
      throw new Error(`Stock insuficiente para "${item.productName}". Disponível: ${totalAvailable}.`);
    }

    // Levantado no acto => sai do stock já; por levantar => fica reservado.
    const pickedUpNow = !isProforma && saleData.isPickedUp !== false;
    let remaining = item.quantity;
    if (!isProforma) {
      for (const s of available) {
        if (remaining <= 0) break;
        const free = s.stock - s.reserved;
        if (free <= 0) continue;
        const take = Math.min(free, remaining);
        if (pickedUpNow) {
          s.stock -= take;
          delta(s.id).stock -= take;
          movements.push({ productId: s.id, productName: item.productName, quantity: take, location: s.data.location });
        } else {
          s.reserved += take;
          delta(s.id).reserved += take;
        }
        remaining -= take;
      }
    }

    const proportion = cartSubtotal > 0 ? item.subtotal / cartSubtotal : 0;
    const itemDiscount = totalDiscountAmount * proportion;
    const itemVat = totalVatAmount * proportion;
    const itemTotal = item.subtotal - itemDiscount + itemVat;

    const sale: Sale = {
      id: newId(),
      guideNumber,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.originalCost || 0,
      subtotal: item.subtotal,
      discount: itemDiscount,
      vat: itemVat,
      totalValue: itemTotal,
      amountPaid: isProforma ? 0 : Math.round(itemTotal * paidRatio * 100) / 100,
      date: saleData.date || nowIso,
      status: isProforma ? 'Pendente' : (saleData.isPickedUp === false ? 'Pago' : 'Levantado'),
      paymentMethod: saleData.paymentMethod || 'Numerário',
      location: targetLocation,
      unit: item.unit || 'un',
      soldBy: user.username,
      documentType: saleData.documentType,
      clientName: saleData.clientName || '',
      ...(saleData.customerId && { customerId: saleData.customerId }),
      ...(saleData.notes && { notes: saleData.notes }),
    };
    sales.push(sale);

    if (!isProforma && available.length > 0 && item.unitPrice > 0) {
      const reference = Number(available[0].data.price) || 0;
      if (reference <= 0) {
        // Produto sem preço: aprende com esta venda.
        available.forEach((s) => { delta(s.id).price = item.unitPrice; });
      } else if (Math.abs(item.unitPrice - reference) >= 0.01 && !isManager(user)) {
        // (O gestor a vender com outro preço já decidiu — não precisa de se confirmar a si próprio.)
        priceReviews.push({
          productName: item.productName,
          productIds: available.map((s) => s.id),
          location: targetLocation || '',
          unit: item.unit || 'un',
          referencePrice: reference,
          soldPrice: item.unitPrice,
          quantity: item.quantity,
          saleId: sale.id,
          guideNumber,
          clientName: saleData.clientName || '',
          soldBy: user.username,
          soldById: user.id,
          status: 'pending',
          createdAt: nowIso,
        });
      }
    }
  }

  return { sales, deltas: [...deltas.values()], movements, priceReviews, cartSubtotal, totalDiscountAmount, cartTotal };
}

/** Venda de um só produto (ecrã "Nova venda"): usa o primeiro registo que corresponde ao produto/local. */
export function planSingleSale(args: {
  sale: Omit<Sale, 'id' | 'guideNumber'>;
  reserveStock: boolean;
  source: PlanSource | null;
  user: PlanUser;
  guideNumber: string;
  nowIso: string;
  newId: () => string;
}) {
  const { sale: input, reserveStock, source, user, guideNumber, nowIso, newId } = args;
  const isProforma = input.documentType === 'Factura Proforma';
  const shouldReserve = reserveStock && !isProforma;
  const status = isProforma ? 'Pendente' : input.status;

  if (shouldReserve && !source) throw new Error(`Produto "${input.productName}" não encontrado no estoque para a localização selecionada.`);

  let unitCost = 0;
  let reference = 0;
  const deltas: StockDelta[] = [];
  const movements: PlanMovement[] = [];
  const priceReviews: Record<string, any>[] = [];
  const saleId = newId();

  if (source) {
    unitCost = Number(source.data.cost) || 0;
    reference = Number(source.data.price) || 0;
    if (shouldReserve) {
      const available = (source.data.stock || 0) - (source.data.reservedStock || 0);
      if (available < input.quantity) throw new Error(`Estoque insuficiente. Disponível: ${available}.`);
      if (status === 'Levantado') {
        deltas.push({ id: source.id, stock: -input.quantity, reserved: 0 });
        movements.push({ productId: source.id, productName: input.productName, quantity: input.quantity, location: source.data.location });
      } else {
        deltas.push({ id: source.id, stock: 0, reserved: input.quantity });
      }
    }
  }

  const soldPrice = Number(input.unitPrice) || 0;
  if (!isProforma && source && soldPrice > 0) {
    if (reference <= 0) {
      const d = deltas.find((x) => x.id === source.id);
      if (d) d.price = soldPrice; else deltas.push({ id: source.id, stock: 0, reserved: 0, price: soldPrice });
    } else if (Math.abs(soldPrice - reference) >= 0.01 && !isManager(user)) {
      priceReviews.push({
        productName: input.productName, productIds: [source.id],
        location: input.location || '', unit: input.unit || 'un',
        referencePrice: reference, soldPrice, quantity: input.quantity,
        saleId, guideNumber, clientName: input.clientName || '',
        soldBy: user.username, soldById: user.id, status: 'pending', createdAt: nowIso,
      });
    }
  }

  const sale: Sale = { ...input, id: saleId, status, guideNumber, unitCost };
  return { sale, deltas, movements, priceReviews };
}

/**
 * Levantamento: tira do stock e liberta a reserva, repartindo por vários registos do mesmo produto.
 * Devolve null se não houver stock suficiente.
 */
export function planPickup(args: { quantity: number; sources: PlanSource[] }) {
  const total = args.sources.reduce((sum, s) => sum + (s.data.stock || 0), 0);
  if (total < args.quantity) return { error: total } as const;

  const st = new Map(args.sources.map((s) => [s.id, { stock: s.data.stock || 0, reserved: s.data.reservedStock || 0, location: s.data.location }]));
  const deltas = new Map<string, StockDelta>(args.sources.map((s) => [s.id, { id: s.id, stock: 0, reserved: 0 }]));
  const movements: PlanMovement[] = [];

  let toRelease = args.quantity;
  for (const s of args.sources) {
    if (toRelease <= 0) break;
    const x = st.get(s.id)!;
    const r = Math.min(x.reserved, toRelease);
    x.reserved -= r; deltas.get(s.id)!.reserved -= r; toRelease -= r;
  }
  let toDeduct = args.quantity;
  for (const s of args.sources) {
    if (toDeduct <= 0) break;
    const x = st.get(s.id)!;
    if (x.stock <= 0) continue;
    const d = Math.min(x.stock, toDeduct);
    x.stock -= d; deltas.get(s.id)!.stock -= d; toDeduct -= d;
    movements.push({ productId: s.id, productName: '', quantity: d, location: x.location });
  }
  return { deltas: [...deltas.values()].filter((d) => d.stock || d.reserved), movements, remainingStock: total - args.quantity } as const;
}

type NumberingCompany = {
  documentNumbering?: Record<string, { prefix?: string; separator?: string; padding?: number; nextNumber?: number }>;
  saleCounter?: number;
};

/** Próximo número oficial de documento (igual ao que a venda normal sempre usou). */
export function nextGuideNumber(company: NumberingCompany, documentType: string) {
  const cfg = company.documentNumbering?.[documentType];
  const saleCounter = (company.saleCounter || 0) + 1;
  if (cfg && cfg.prefix) {
    const num = cfg.nextNumber || 1;
    const pad = cfg.padding || 0;
    const padded = pad > 0 ? String(num).padStart(pad, '0') : String(num);
    return {
      guideNumber: `${cfg.prefix}${cfg.separator || ''}${padded}`,
      saleCounter,
      numberingUpdate: { [`documentNumbering.${documentType}.nextNumber`]: num + 1 } as Record<string, number>,
    };
  }
  return { guideNumber: `GT-${String(saleCounter).padStart(6, '0')}`, saleCounter, numberingUpdate: {} as Record<string, number> };
}

export const PROVISIONAL_PREFIX = 'OFF-';

/** Número provisório de uma venda feita sem internet (o oficial é atribuído ao sincronizar). */
export function provisionalGuideNumber(now = Date.now(), rand: () => number = Math.random) {
  const t = now.toString(36).toUpperCase().slice(-5);
  const r = Math.floor(rand() * 1296).toString(36).toUpperCase().padStart(2, '0');
  return `${PROVISIONAL_PREFIX}${t}${r}`;
}

export const isProvisionalNumber = (n?: string) => !!n && n.startsWith(PROVISIONAL_PREFIX);
