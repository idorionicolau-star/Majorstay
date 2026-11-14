/**
 * Impressão em impressora térmica (rolo de 58 mm ou 80 mm) a partir do navegador.
 *
 * Não depende do tamanho do papel: a largura é a do papel que o controlador da impressora indicar
 * (margens a zero, texto a 100% da largura), por isso o mesmo recibo serve para 58 mm e 80 mm.
 * Usa um iframe escondido (e não uma janela nova) para não ser bloqueado como pop-up no telemóvel.
 */

export type ReceiptLine = {
  /** Texto à esquerda (descrição) */
  left: string;
  /** Texto à direita (valor) */
  right?: string;
  bold?: boolean;
  /** Linha de detalhe por baixo (ex.: "Obs: sem cebola") */
  sub?: string;
};

export type ReceiptDoc = {
  /** Nome do estabelecimento (topo) */
  hotel: string;
  /** Título do documento (ex.: RECIBO DE ESTADIA) */
  title: string;
  /** Linhas de contexto: quarto, cliente, datas... */
  meta: string[];
  /** Linhas com descrição e valor */
  lines: ReceiptLine[];
  /** Totais (em baixo, depois de uma linha) */
  totals: ReceiptLine[];
  footer?: string;
};

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const row = (l: ReceiptLine) =>
  `<div class="row${l.bold ? ' b' : ''}"><span class="l">${escapeHtml(l.left)}</span>${
    l.right !== undefined ? `<span class="r">${escapeHtml(l.right)}</span>` : ''
  }</div>${l.sub ? `<div class="sub">${escapeHtml(l.sub)}</div>` : ''}`;

/** Documento HTML completo, pronto a imprimir. */
export function receiptToHtml(doc: ReceiptDoc): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title><style>
@page { margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { width: 100%; padding: 3mm 3mm 8mm; font-family: "Courier New", ui-monospace, monospace; font-size: 12px; line-height: 1.35; color: #000; }
.c { text-align: center; }
.hotel { font-size: 15px; font-weight: 700; text-align: center; word-break: break-word; }
.title { text-align: center; font-weight: 700; margin: 2px 0 4px; }
.hr { border-top: 1px dashed #000; margin: 5px 0; }
.row { display: flex; justify-content: space-between; gap: 6px; }
.row .l { flex: 1; min-width: 0; word-break: break-word; }
.row .r { white-space: nowrap; text-align: right; }
.b { font-weight: 700; }
.sub { padding-left: 8px; font-size: 11px; }
.meta { word-break: break-word; }
.foot { text-align: center; margin-top: 8px; font-size: 11px; }
</style></head><body>
<div class="hotel">${escapeHtml(doc.hotel)}</div>
<div class="title">${escapeHtml(doc.title)}</div>
<div class="hr"></div>
${doc.meta.map((m) => `<div class="meta">${escapeHtml(m)}</div>`).join('')}
${doc.lines.length ? `<div class="hr"></div>${doc.lines.map(row).join('')}` : ''}
${doc.totals.length ? `<div class="hr"></div>${doc.totals.map(row).join('')}` : ''}
<div class="hr"></div>
<div class="foot">${escapeHtml(doc.footer || 'Obrigado pela preferência!')}</div>
</body></html>`;
}

/** Envia o HTML para a impressão através de um iframe escondido. Só no navegador. */
export function printReceiptHtml(html: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => setTimeout(() => iframe.remove(), 1500);
  // Dá tempo ao documento de assentar antes de abrir o diálogo de impressão
  setTimeout(() => {
    try {
      win.focus();
      win.onafterprint = cleanup;
      win.print();
    } finally {
      // Se o navegador não disparar onafterprint, limpa na mesma
      setTimeout(() => iframe.remove(), 60_000);
    }
  }, 250);
  return true;
}

export function printReceipt(doc: ReceiptDoc): boolean {
  return printReceiptHtml(receiptToHtml(doc));
}

// ---------------------------------------------------------------------------
// Construtores dos documentos
// ---------------------------------------------------------------------------

const money = (n: number) =>
  `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`;

const fmtDate = (d: Date) => d.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime = (d: Date) => d.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
const qtyLabel = (qty: number, weightKg?: number) => (weightKg ? `${String(weightKg).replace('.', ',')} kg` : `${qty}x`);

export type StayReceiptInput = {
  hotel: string;
  roomName: string;
  clientName?: string;
  vehiclePlate?: string;
  checkIn: Date;
  checkOut?: Date | null;
  /** Saída prevista (recibo passado no check-in) */
  expectedCheckOut?: Date | null;
  /** Descrição do alojamento (ex.: "3h de estadia", "Pernoite") */
  stayLabel: string;
  stayAmount: number;
  consumptions: { quantity: number; productName: string; totalPrice: number; weightKg?: number; notes?: string }[];
  total: number;
  paid: number;
  paymentMethod?: string;
  /** true = recibo final (check-out feito); false = conta provisória */
  final: boolean;
  operator?: string;
};

export function buildStayReceipt(i: StayReceiptInput): ReceiptDoc {
  const meta = [
    `Quarto: ${i.roomName}`,
    `Cliente: ${i.clientName?.trim() || 'Particular'}`,
    ...(i.vehiclePlate ? [`Matrícula: ${i.vehiclePlate}`] : []),
    `Entrada: ${fmtDate(i.checkIn)} ${fmtTime(i.checkIn)}`,
    ...(i.checkOut ? [`Saída: ${fmtDate(i.checkOut)} ${fmtTime(i.checkOut)}`] : []),
    ...(!i.checkOut && i.expectedCheckOut ? [`Saída prevista: ${fmtTime(i.expectedCheckOut)}`] : []),
  ];
  const lines: ReceiptLine[] = [{ left: i.stayLabel, right: money(i.stayAmount) }];
  for (const c of i.consumptions) {
    lines.push({
      left: `${qtyLabel(c.quantity, c.weightKg)} ${c.productName}`,
      right: money(c.totalPrice),
      ...(c.notes ? { sub: `Obs: ${c.notes}` } : {}),
    });
  }
  const balance = Math.max(0, Math.round((i.total - i.paid) * 100) / 100);
  const totals: ReceiptLine[] = [{ left: 'TOTAL', right: money(i.total), bold: true }];
  if (i.paid > 0) totals.push({ left: i.final ? 'Pago' : 'Já pago', right: money(i.paid) });
  if (!i.final || balance > 0) totals.push({ left: i.final ? 'Em falta' : 'A pagar', right: money(balance), bold: true });
  if (i.final && i.paymentMethod) totals.push({ left: 'Pagamento', right: i.paymentMethod });
  if (i.operator) meta.push(`Atendido por: ${i.operator}`);
  return {
    hotel: i.hotel,
    title: i.final ? (i.checkOut ? 'RECIBO DE ESTADIA' : 'RECIBO DE PAGAMENTO') : 'CONTA DO QUARTO (provisória)',
    meta,
    lines,
    totals,
    footer: i.final ? 'Obrigado pela preferência!' : 'Documento sem valor fiscal',
  };
}

export type KitchenTicketInput = {
  hotel: string;
  roomName: string;
  createdAt: Date;
  items: { quantity: number; productName: string; notes?: string; weightKg?: number }[];
  notes?: string;
  source?: string;
};

/** Senha para a cozinha/bar: sem preços, com as observações bem à vista. */
export function buildKitchenTicket(i: KitchenTicketInput): ReceiptDoc {
  return {
    hotel: i.hotel,
    title: `PEDIDO — ${i.roomName.toUpperCase()}`,
    meta: [`${fmtDate(i.createdAt)} ${fmtTime(i.createdAt)}`, ...(i.source ? [`Origem: ${i.source}`] : [])],
    lines: i.items.map((it) => ({
      left: `${qtyLabel(it.quantity, it.weightKg)} ${it.productName}`,
      bold: true,
      ...(it.notes ? { sub: `OBS: ${it.notes}` } : {}),
    })),
    totals: i.notes ? [{ left: `NOTA: ${i.notes}`, bold: true }] : [],
    footer: 'Senha de cozinha / bar',
  };
}

export type ServiceSaleReceiptInput = {
  hotel: string;
  serviceName: string;
  category?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethod: string;
  clientName?: string;
  documentNumber?: string;
  date: Date;
  operator?: string;
  notes?: string;
};

/** Talão / comprovativo de cobrança de serviço ou diversão avulsa (ex: Bilhar, Piscina, Day-pass, Spa, etc.) */
export function buildServiceSaleReceipt(i: ServiceSaleReceiptInput): ReceiptDoc {
  const meta = [
    `Documento: ${i.documentNumber || 'Venda Avulsa / Balcão'}`,
    `Data: ${fmtDate(i.date)} ${fmtTime(i.date)}`,
    `Cliente: ${i.clientName?.trim() || 'Cliente Balcão / Lounge'}`,
    ...(i.operator ? [`Operador: ${i.operator}`] : []),
  ];

  const lines: ReceiptLine[] = [
    {
      left: `${i.quantity}x ${i.serviceName}`,
      right: money(i.totalPrice),
      bold: true,
      ...(i.notes ? { sub: `Obs: ${i.notes}` } : {}),
    },
  ];

  const totals: ReceiptLine[] = [
    { left: 'TOTAL PAGO', right: money(i.totalPrice), bold: true },
    { left: 'Forma de Pagamento', right: i.paymentMethod },
    { left: 'Estado', right: 'PAGO' },
  ];

  return {
    hotel: i.hotel,
    title: 'COMPROVATIVO DE SERVIÇO / DIVERSÃO',
    meta,
    lines,
    totals,
    footer: 'Bom entretenimento! Obrigado pela preferência.',
  };
}
