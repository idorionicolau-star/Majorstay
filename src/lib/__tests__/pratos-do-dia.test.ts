import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies for the consumption route
const mockVerifyIdToken = vi.fn();
const mockRunTransaction = vi.fn();
const mockDocGet = vi.fn();
const mockDocUpdate = vi.fn();
const mockDocSet = vi.fn();

vi.mock('@/lib/firebase-admin', () => {
  const firestoreInstance = () => ({
    doc: (path: string) => ({
      path,
      get: () => mockDocGet(path),
      update: (data: unknown) => mockDocUpdate(path, data),
      set: (data: unknown) => mockDocSet(path, data),
    }),
    collection: (path: string) => ({
      path,
      doc: () => ({
        path: `${path}/auto-id`,
        set: (data: unknown) => mockDocSet(path, data),
      }),
    }),
    runTransaction: (fn: (tx: any) => Promise<any>) => mockRunTransaction(fn),
  });

  firestoreInstance.FieldValue = {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  };

  return {
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
    initializeAdmin: () => ({
      firestore: firestoreInstance,
    }),
  };
});

import { POST } from '@/app/api/stays/consumption/route';
import { dishDayKey } from '@/lib/dishes';

describe('Pratos do dia', () => {
  const companyId = 'hotel';
  const stayId = 'stay-1';
  const dishPath = `companies/${companyId}/dishes/d1`;
  const stayPath = `companies/${companyId}/stays/${stayId}`;
  let db: Record<string, any> = {};

  const call = (payload: Record<string, unknown>) =>
    POST(new Request('http://localhost/api/stays/consumption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, stayId, ...payload }) }));

  beforeEach(() => {
    db = {
      [`companies/${companyId}/employees/u1`]: { username: 'Rita', role: 'Employee', permissions: { rooms: 'write' } },
      [stayPath]: { status: 'open', roomName: 'Quarto 1', roomId: 'r1', contractedHours: 2, ratePerHourApplied: 300, consumptions: [], totalAmountDue: 600 },
      [dishPath]: { name: 'Frango com batata', price: 450, available: 3, availableDay: dishDayKey(), active: true },
    };
    mockVerifyIdToken.mockResolvedValue({ uid: 'u1', companyId, superAdmin: false });
    mockDocGet.mockImplementation(async (path: string) => ({ exists: Boolean(db[path]), data: () => db[path] }));
    mockRunTransaction.mockImplementation(async (fn: (tx: any) => Promise<any>) =>
      fn({
        get: async (ref: { path: string }) => ({ exists: Boolean(db[ref.path]), data: () => db[ref.path] }),
        update: (ref: { path: string }, data: Record<string, any>) => { if (db[ref.path]) db[ref.path] = { ...db[ref.path], ...data }; },
        set: (ref: { path: string }, data: Record<string, any>) => { db[ref.path] = data; },
      })
    );
  });

  it('vende o prato ao preço do servidor e desconta as doses', async () => {
    const res = await call({ action: 'add', items: [{ productId: 'dish:d1', quantity: 2, unitPrice: 1 }] });
    expect(res.status).toBe(200);
    const c = db[stayPath].consumptions[0];
    expect(c.unitPrice).toBe(450);
    expect(c.totalPrice).toBe(900);
    expect(c.dishId).toBe('d1');
    expect(c.productId).toBeUndefined();
    expect(db[dishPath].available).toBe(1);
    expect(db[stayPath].totalAmountDue).toBe(1500);
  });

  it('recusa mais doses do que as disponíveis', async () => {
    const res = await call({ action: 'add', items: [{ productId: 'dish:d1', quantity: 4 }] });
    expect(res.status).toBe(400);
    expect(db[dishPath].available).toBe(3);
  });

  it('recusa prato de ontem (zera de manhã)', async () => {
    db[dishPath].availableDay = '2000-01-01';
    const res = await call({ action: 'add', items: [{ productId: 'dish:d1', quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('ao remover o consumo as doses voltam', async () => {
    await call({ action: 'add', items: [{ productId: 'dish:d1', quantity: 2 }] });
    const id = db[stayPath].consumptions[0].id;
    const res = await call({ action: 'remove', consumptionId: id, reason: 'Enganei-me' });
    expect(res.status).toBe(200);
    expect(db[dishPath].available).toBe(3);
  });
});
