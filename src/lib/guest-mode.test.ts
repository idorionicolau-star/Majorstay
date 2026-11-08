import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GUEST_KEY, GUEST_COMPANY, GUEST_COMPANY_ID, GUEST_DURATION_MINUTES, GUEST_DATA_EVENT, GUEST_SESSION_EVENT,
  isGuestCompany, isGuestMode, getGuestRemainingSeconds, enterGuestMode, exitGuestMode,
  touchGuestSession, applyServerRemaining, getGuestDeviceId, discardGuestData,
  getGuestProducts, getGuestSales, getGuestStockMovements, getGuestCustomers, getGuestExpenses,
  addGuestSale, addGuestExpense, updateGuestExpense, deleteGuestExpense,
  addGuestCustomer, updateGuestCustomer, deleteGuestCustomer,
} from '@/lib/guest-mode';
import { DEMO_PRODUCTS, GUEST_PRODUCTS, GUEST_LOCATIONS, guestLocation } from '@/lib/demo-data';
import type { Sale } from '@/lib/types';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

const events: string[] = [];

beforeEach(() => {
  events.length = 0;
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('window', { dispatchEvent: (e: Event) => { events.push(e.type); return true; } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 'guest-sale-1', date: new Date().toISOString(), productId: 'demo-cim-01', productName: 'Cimento Portland 32.5N Limak 50kg',
  quantity: 10, unit: 'saco', unitPrice: 580, unitCost: 480, subtotal: 5800, totalValue: 5800, amountPaid: 5800,
  soldBy: 'Gestor Comercial', guideNumber: 'VD-2026/0999', location: 'Armazém Principal', customerId: 'cust-02',
  clientName: 'Mestre Inácio Chissano', status: 'Pago', documentType: 'Venda a Dinheiro', paymentMethod: 'Numerário', ...over,
});

describe('sessão de convidado', () => {
  it('decide-se pela empresa fictícia, não pela chave do localStorage', () => {
    expect(isGuestCompany(GUEST_COMPANY_ID)).toBe(true);
    expect(isGuestCompany('uma-empresa-real')).toBe(false);
    expect(isGuestCompany(null)).toBe(false);
    expect(GUEST_COMPANY.id).toBe(GUEST_COMPANY_ID);
  });

  it('entra, conta 30 minutos e avisa a app', () => {
    enterGuestMode();
    expect(isGuestMode()).toBe(true);
    expect(getGuestRemainingSeconds()).toBeGreaterThan(GUEST_DURATION_MINUTES * 60 - 5);
    expect(events).toContain(GUEST_SESSION_EVENT);
  });

  it('ao fim dos 30 minutos a sessão acaba, mas os dados ficam', () => {
    enterGuestMode();
    addGuestSale(sale());
    const sales = getGuestSales().length;
    localStorage.setItem(GUEST_KEY, String(Date.now() - (GUEST_DURATION_MINUTES * 60 + 5) * 1000));
    expect(getGuestRemainingSeconds()).toBe(0);
    expect(isGuestMode()).toBe(false);
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
    enterGuestMode();
    expect(getGuestSales()).toHaveLength(sales);
  });

  it('sair e voltar a entrar retoma de onde ficou (vendas, stock, despesas, clientes)', () => {
    enterGuestMode();
    const stock = getGuestProducts().find((p) => p.id === 'demo-cim-01')!.stock;
    addGuestSale(sale());
    addGuestExpense({ id: 'e-fica', description: 'fica', amount: 1, category: 'Outros', date: new Date().toISOString(), status: 'Pago', registeredBy: 'a' });
    addGuestCustomer({ id: 'c-fica', name: 'Fica', phone: '', totalPurchases: 0, lastVisit: new Date().toISOString() });

    exitGuestMode();
    expect(isGuestMode()).toBe(false);
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();

    enterGuestMode();
    expect(isGuestMode()).toBe(true);
    expect(getGuestRemainingSeconds()).toBeGreaterThan(GUEST_DURATION_MINUTES * 60 - 5); // quase nada gasto: continua dos 30
    expect(getGuestSales().some((x) => x.id === 'guest-sale-1')).toBe(true);
    expect(getGuestProducts().find((p) => p.id === 'demo-cim-01')!.stock).toBe(stock - 10);
    expect(getGuestExpenses().some((e) => e.id === 'e-fica')).toBe(true);
    expect(getGuestCustomers().some((c) => c.id === 'c-fica')).toBe(true);
  });

  it('não mexe nos dados de outras funcionalidades', () => {
    localStorage.setItem('majorstockx-demo-sale-abc', '1');
    enterGuestMode();
    exitGuestMode();
    expect(localStorage.getItem('majorstockx-demo-sale-abc')).toBe('1');
  });

  it('dados guardados por um formato antigo não se reaproveitam', () => {
    localStorage.setItem('majorstockx-guest-products', JSON.stringify([{ id: 'velho', name: 'Velho', stock: 1, location: 'Setor Metais' }]));
    enterGuestMode();
    const products = getGuestProducts();
    expect(products).toHaveLength(30);
    expect(products.some((p) => p.id === 'velho')).toBe(false);
    // e, uma vez no formato certo, não volta a limpar
    addGuestSale(sale());
    enterGuestMode();
    expect(getGuestSales().some((x) => x.id === 'guest-sale-1')).toBe(true);
  });
});

describe('dados do convidado persistem e mexem uns nos outros', () => {
  it('uma venda tira stock, regista a saída e soma ao cliente', () => {
    enterGuestMode();
    const before = getGuestProducts().find((p) => p.id === 'demo-cim-01')!.stock;
    const customerBefore = getGuestCustomers().find((c) => c.id === 'cust-02')!;
    const salesBefore = getGuestSales().length;
    const movementsBefore = getGuestStockMovements().length;
    events.length = 0;

    addGuestSale(sale());

    expect(getGuestProducts().find((p) => p.id === 'demo-cim-01')!.stock).toBe(before - 10);
    expect(getGuestSales()).toHaveLength(salesBefore + 1);
    const movements = getGuestStockMovements();
    expect(movements).toHaveLength(movementsBefore + 1);
    expect(movements[0]).toMatchObject({ type: 'OUT', quantity: -10, productId: 'demo-cim-01' });
    const customerAfter = getGuestCustomers().find((c) => c.id === 'cust-02')!;
    expect(customerAfter.totalPurchases).toBe(customerBefore.totalPurchases + 5800);
    expect(events).toContain(GUEST_DATA_EVENT);
  });

  it('o stock nunca fica negativo', () => {
    enterGuestMode();
    addGuestSale(sale({ quantity: 99999, subtotal: 1, totalValue: 1 }));
    expect(getGuestProducts().find((p) => p.id === 'demo-cim-01')!.stock).toBe(0);
  });

  it('despesas: criar, editar e apagar guardam-se', () => {
    enterGuestMode();
    addGuestExpense({ id: 'e-novo', description: 'Gasóleo', amount: 900, category: 'Transporte', date: new Date().toISOString(), status: 'Pago', registeredBy: 'a' });
    expect(getGuestExpenses()[0].id).toBe('e-novo');
    updateGuestExpense('e-novo', { amount: 1000 });
    expect(getGuestExpenses().find((e) => e.id === 'e-novo')!.amount).toBe(1000);
    deleteGuestExpense('e-novo');
    expect(getGuestExpenses().some((e) => e.id === 'e-novo')).toBe(false);
  });

  it('clientes: criar, editar e apagar guardam-se', () => {
    enterGuestMode();
    addGuestCustomer({ id: 'c-novo', name: 'Cliente Novo', phone: '', totalPurchases: 0, lastVisit: new Date().toISOString() });
    expect(getGuestCustomers().some((c) => c.id === 'c-novo')).toBe(true);
    updateGuestCustomer('c-novo', { name: 'Cliente Editado' });
    expect(getGuestCustomers().find((c) => c.id === 'c-novo')!.name).toBe('Cliente Editado');
    deleteGuestCustomer('c-novo');
    expect(getGuestCustomers().some((c) => c.id === 'c-novo')).toBe(false);
  });
});

describe('catálogos de demonstração', () => {
  it('a demonstração de primeiros passos continua com os 5 produtos de exemplo', () => {
    expect(DEMO_PRODUCTS).toHaveLength(5);
    expect(DEMO_PRODUCTS.every((p) => p.name.includes('(exemplo)'))).toBe(true);
  });

  it('o convidado tem 30 produtos, todos numa das localizações da empresa', () => {
    expect(GUEST_PRODUCTS).toHaveLength(30);
    const names = GUEST_COMPANY.locations!.map((l) => l.name);
    expect(names).toEqual([...GUEST_LOCATIONS]);
    expect(GUEST_PRODUCTS.every((p) => names.includes(p.location ?? ''))).toBe(true);
    getGuestSales().forEach((s) => expect(names).toContain(s.location));
    getGuestStockMovements().forEach((m) => {
      if (m.fromLocationId) expect(names).toContain(m.fromLocationId);
      if (m.toLocationId) expect(names).toContain(m.toLocationId);
    });
  });

  it('guestLocation agrupa os sub-locais', () => {
    expect(guestLocation('Pátio Aberto')).toBe('Pátio de Produção');
    expect(guestLocation('Prateleira F1')).toBe('Loja Principal');
    expect(guestLocation('Setor Tintas')).toBe('Armazém Principal');
    expect(guestLocation('')).toBe('Armazém Principal');
  });
});

describe('timestamp dos movimentos (como o do Firestore)', () => {
  it('tem toDate() e toMillis(): o dashboard e o histórico dependem disto', () => {
    enterGuestMode();
    const movements = getGuestStockMovements();
    expect(movements.length).toBeGreaterThan(0);
    movements.forEach((m) => {
      const ts = m.timestamp as { toDate: () => Date; toMillis: () => number; seconds: number };
      expect(typeof ts.toDate).toBe('function');
      expect(ts.toDate()).toBeInstanceOf(Date);
      expect(Number.isNaN(ts.toDate().getTime())).toBe(false);
      expect(ts.toMillis()).toBe(ts.toDate().getTime());
      expect(ts.seconds).toBe(Math.floor(ts.toMillis() / 1000));
    });
  });

  it('continua a funcionar depois de uma venda e de ler várias vezes (nada de objetos gravados)', () => {
    enterGuestMode();
    addGuestSale(sale());
    getGuestStockMovements();
    addGuestSale(sale({ id: 'guest-sale-2', quantity: 2, subtotal: 1160, totalValue: 1160 }));
    const movements = getGuestStockMovements();
    expect(movements[0].reason).toContain('VD-2026/0999');
    movements.forEach((m) => expect(Number.isNaN((m.timestamp as { toDate: () => Date }).toDate().getTime())).toBe(false));
    const stored = JSON.parse(localStorage.getItem('majorstockx-guest-movements')!);
    stored.forEach((m: { timestamp: unknown }) => expect(typeof m.timestamp).toBe('string'));
  });
});

describe('o relógio continua (não recomeça)', () => {
  const MIN = 60_000;
  /** Usa a app durante `minutes` minutos: bate de 15 em 15 segundos, como a app. */
  function useFor(minutes: number) {
    for (let i = 0; i < minutes * 4; i++) { vi.advanceTimersByTime(15_000); touchGuestSession(); }
  }

  it('sair e voltar horas depois continua dos minutos que sobravam', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T10:00:00Z'));
    expect(enterGuestMode()).toBe(true);
    useFor(10);
    exitGuestMode();
    vi.advanceTimersByTime(5 * 60 * MIN);
    expect(enterGuestMode()).toBe(true);
    const left = getGuestRemainingSeconds();
    expect(left).toBeGreaterThan(19 * 60 + 40);
    expect(left).toBeLessThanOrEqual(20 * 60);
  });

  it('sem batimentos (separador fechado) o tempo parado não conta', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T10:00:00Z'));
    enterGuestMode();
    useFor(2);
    vi.advanceTimersByTime(40 * MIN); // fechou o separador sem sair
    const left = getGuestRemainingSeconds();
    expect(left).toBeGreaterThan(27 * 60 + 40);
    expect(left).toBeLessThanOrEqual(28 * 60);
  });

  it('ao gastar os 30 minutos já não deixa entrar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T10:00:00Z'));
    enterGuestMode();
    useFor(31);
    expect(isGuestMode()).toBe(false);
    expect(getGuestRemainingSeconds()).toBe(0);
    expect(enterGuestMode()).toBe(false);
    vi.advanceTimersByTime(24 * 60 * MIN);
    expect(enterGuestMode()).toBe(false); // passar um dia não dá tempo novo
  });

  it('limpar os dados do convidado não devolve tempo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T10:00:00Z'));
    enterGuestMode();
    useFor(31);
    discardGuestData();
    expect(enterGuestMode()).toBe(false);
  });

  it('o servidor só pode tirar tempo, nunca dar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T10:00:00Z'));
    enterGuestMode();
    useFor(5);
    applyServerRemaining(10 * MIN); // o servidor diz que só restam 10
    expect(getGuestRemainingSeconds()).toBeLessThanOrEqual(10 * 60);
    applyServerRemaining(30 * MIN); // diz 30: ignora-se
    expect(getGuestRemainingSeconds()).toBeLessThanOrEqual(10 * 60);
  });

  it('o código do aparelho é estável e discardGuestData não o apaga', () => {
    const id = getGuestDeviceId();
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(getGuestDeviceId()).toBe(id);
    enterGuestMode();
    addGuestExpense({ id: 'x', description: 'x', amount: 1, category: 'Outros', date: new Date().toISOString(), status: 'Pago', registeredBy: 'a' });
    discardGuestData();
    expect(getGuestDeviceId()).toBe(id);
    expect(getGuestExpenses().some((e) => e.id === 'x')).toBe(false); // os dados fictícios foram embora (voltam os de exemplo)
  });
});
