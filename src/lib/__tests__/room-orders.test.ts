import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, any>;
let db: Record<string, Doc> = {};
const mockVerify = vi.fn();

function docsOf(path: string, wheres: [string, any][]) {
  return Object.keys(db)
    .filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/'))
    .map((k) => ({ id: k.slice(path.length + 1), data: () => db[k] }))
    .filter((d) => wheres.every(([f, v]) => d.data()[f] === v));
}

vi.mock('@/lib/firebase-admin', () => {
  let counter = 0;
  const firestoreInstance = () => ({
    doc: (path: string) => ({
      path,
      id: path.split('/').pop(),
      get: async () => ({ exists: path in db, id: path.split('/').pop(), data: () => db[path] }),
      set: async (d: Doc) => { db[path] = d; },
    }),
    collection: (path: string) => {
      const wheres: [string, any][] = [];
      const b: any = {
        where: (f: string, _op: string, v: any) => { wheres.push([f, v]); return b; },
        limit: () => b,
        get: async () => { const docs = docsOf(path, wheres); return { empty: docs.length === 0, docs }; },
        doc: () => {
          const id = `auto-${++counter}`;
          return { path: `${path}/${id}`, id, set: async (d: Doc) => { db[`${path}/${id}`] = d; } };
        },
      };
      return b;
    },
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      // Imita o Firestore: todas as leituras antes de qualquer escrita; escritas só no fim (atómicas)
      let wrote = false;
      const pending: (() => void)[] = [];
      const tx = {
        get: async (ref: any) => {
          if (wrote) throw new Error('Firestore transactions require all reads to be executed before all writes.');
          return { exists: ref.path in db, id: ref.id || ref.path.split('/').pop(), data: () => db[ref.path] };
        },
        update: (ref: any, d: Doc) => { wrote = true; pending.push(() => { db[ref.path] = { ...db[ref.path], ...d }; }); },
        set: (ref: any, d: Doc) => { wrote = true; pending.push(() => { db[ref.path] = d; }); },
      };
      const out = await fn(tx);
      pending.forEach((f) => f());
      return out;
    },
  });
  (firestoreInstance as any).FieldValue = { serverTimestamp: () => 'TS' };
  return {
    verifyIdToken: (...a: unknown[]) => mockVerify(...a),
    initializeAdmin: () => ({ firestore: firestoreInstance }),
  };
});

import { POST as consumption } from '@/app/api/stays/consumption/route';
import { POST as order } from '@/app/api/room-hub/order/route';
import { POST as checkout } from '@/app/api/stays/checkout/route';
import { GET as listOrders, POST as resolveOrders } from '@/app/api/room-orders/route';

const C = 'emp1';
const json = (url: string, body: unknown, method = 'POST') =>
  new Request(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  db = {
    [`companies/${C}/rooms/r1`]: { name: 'Quarto 1', status: 'occupied', currentStayId: 's1', ratePerHour: 300 },
    [`companies/${C}/stays/s1`]: {
      status: 'open', roomId: 'r1', roomName: 'Quarto 1', accessPin: '4321',
      contractedHours: 2, ratePerHourApplied: 300, extensions: [], consumptions: [], totalAmountDue: 600,
    },
    [`companies/${C}/products/p1`]: { name: 'Corona', price: 120, stock: 10 },
    [`companies/${C}/products/p2`]: { name: 'Água', price: 50, stock: 5 },
    [`companies/${C}/employees/e1`]: { username: 'Rita', role: 'Funcionario', permissions: { rooms: 'write' } },
  };
  mockVerify.mockResolvedValue({ uid: 'e1', companyId: C });
});

describe('consumos: vários produtos numa só chamada', () => {
  it('lança 2 produtos diferentes (antes falhava: leitura depois de escrita)', async () => {
    const res = await consumption(json('/api/stays/consumption', {
      companyId: C, stayId: 's1', action: 'add',
      items: [{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 1 }],
    }));
    expect(res.status).toBe(200);
    expect(db[`companies/${C}/products/p1`].stock).toBe(8);
    expect(db[`companies/${C}/products/p2`].stock).toBe(4);
    expect(db[`companies/${C}/stays/s1`].totalAmountDue).toBe(600 + 240 + 50);
  });

  it('o mesmo produto em duas linhas abate a soma', async () => {
    const res = await consumption(json('/api/stays/consumption', {
      companyId: C, stayId: 's1', action: 'add',
      items: [{ productId: 'p1', quantity: 2 }, { productId: 'p1', quantity: 3 }],
    }));
    expect(res.status).toBe(200);
    expect(db[`companies/${C}/products/p1`].stock).toBe(5);
  });
});

describe('pedido do hóspede (QR)', () => {
  it('PIN errado → 403 e nada gravado', async () => {
    const res = await order(json('/api/room-hub/order', { c: C, r: 'r1', pin: '0000', items: [{ productId: 'p1', quantity: 1 }] }));
    expect(res.status).toBe(403);
    expect(Object.keys(db).some((k) => k.includes('roomOrders'))).toBe(false);
  });

  it('PIN certo → pedido pendente com preço do catálogo (ignora preço enviado)', async () => {
    const res = await order(json('/api/room-hub/order', {
      c: C, r: 'r1', pin: '4321', items: [{ productId: 'p1', quantity: 3, unitPrice: 1 }],
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(360);
    const saved = db[`companies/${C}/roomOrders/${body.orderId}`];
    expect(saved).toMatchObject({ status: 'pending', stayId: 's1', roomName: 'Quarto 1', total: 360 });
    expect(saved.items[0]).toMatchObject({ productName: 'Corona', unitPrice: 120, quantity: 3 });
  });

  it('quantidade inválida e produto inexistente → 400', async () => {
    const a = await order(json('/api/room-hub/order', { c: C, r: 'r1', pin: '4321', items: [{ productId: 'p1', quantity: 0 }] }));
    const b = await order(json('/api/room-hub/order', { c: C, r: 'r1', pin: '4321', items: [{ productId: 'nope', quantity: 1 }] }));
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
  });

  it('mais de 5 pedidos pendentes → 429', async () => {
    for (let i = 0; i < 5; i++) {
      const ok = await order(json('/api/room-hub/order', { c: C, r: 'r1', pin: '4321', items: [{ productId: 'p2', quantity: 1 }] }));
      expect(ok.status).toBe(200);
    }
    const res = await order(json('/api/room-hub/order', { c: C, r: 'r1', pin: '4321', items: [{ productId: 'p2', quantity: 1 }] }));
    expect(res.status).toBe(429);
  });
});

describe('receção: confirmar e recusar', () => {
  async function newOrder() {
    const res = await order(json('/api/room-hub/order', { c: C, r: 'r1', pin: '4321', items: [{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 1 }] }));
    return (await res.json()).orderId as string;
  }

  it('lista só os pendentes', async () => {
    const id = await newOrder();
    const res = await listOrders(new Request(`http://localhost/api/room-orders?companyId=${C}`));
    const body = await res.json();
    expect(body.orders.map((o: any) => o.id)).toEqual([id]);
  });

  it('confirmar lança na conta, abate stock e marca confirmado; segunda vez é recusada', async () => {
    const id = await newOrder();
    const res = await consumption(json('/api/stays/consumption', { companyId: C, stayId: 's1', action: 'add', orderId: id }));
    expect(res.status).toBe(200);
    const stay = db[`companies/${C}/stays/s1`];
    expect(stay.consumptions).toHaveLength(2);
    expect(stay.consumptions[0].orderId).toBe(id);
    expect(stay.totalAmountDue).toBe(600 + 240 + 50);
    expect(db[`companies/${C}/products/p1`].stock).toBe(8);
    expect(db[`companies/${C}/roomOrders/${id}`]).toMatchObject({ status: 'confirmed', resolvedByName: 'Rita' });

    const again = await consumption(json('/api/stays/consumption', { companyId: C, stayId: 's1', action: 'add', orderId: id }));
    expect(again.status).toBe(400);
    expect((await again.json()).error).toMatch(/já foi tratado/);
    expect(db[`companies/${C}/stays/s1`].consumptions).toHaveLength(2);
  });

  it('pedido de outra estadia não se confirma', async () => {
    const id = await newOrder();
    db[`companies/${C}/stays/s2`] = { status: 'open', roomId: 'r2', roomName: 'Quarto 2', contractedHours: 1, ratePerHourApplied: 100, consumptions: [] };
    const res = await consumption(json('/api/stays/consumption', { companyId: C, stayId: 's2', action: 'add', orderId: id }));
    expect(res.status).toBe(400);
    expect(db[`companies/${C}/roomOrders/${id}`].status).toBe('pending');
  });

  it('recusar marca como recusado e não mexe no stock nem na conta', async () => {
    const id = await newOrder();
    const res = await resolveOrders(json('/api/room-orders', { companyId: C, orderId: id, action: 'reject', reason: 'Sem stock' }));
    expect(res.status).toBe(200);
    expect(db[`companies/${C}/roomOrders/${id}`]).toMatchObject({ status: 'rejected', rejectReason: 'Sem stock' });
    expect(db[`companies/${C}/products/p1`].stock).toBe(10);
    const again = await resolveOrders(json('/api/room-orders', { companyId: C, orderId: id, action: 'reject' }));
    expect(again.status).toBe(409);
  });

  it('sem permissão de quartos → 403', async () => {
    db[`companies/${C}/employees/e1`] = { username: 'Rita', role: 'Funcionario', permissions: {} };
    const res = await listOrders(new Request(`http://localhost/api/room-orders?companyId=${C}`));
    expect(res.status).toBe(403);
  });

  it('check-out é recusado enquanto houver pedidos pendentes', async () => {
    await newOrder();
    const res = await checkout(json('/api/stays/checkout', { companyId: C, stayId: 's1', roomId: 'r1' }));
    expect(res?.status).toBe(400);
    expect((await res?.json())?.error).toMatch(/pedido\(s\) de bar pendente/);
    expect(db[`companies/${C}/stays/s1`].status).toBe('open');
  });
});
