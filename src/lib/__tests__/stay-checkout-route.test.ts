import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, any>;
let db: Record<string, Doc> = {};
let autoId = 0;
const mockVerify = vi.fn();

const refOf = (path: string): any => ({
  path, id: path.split('/').pop(),
  get: async () => ({ exists: path in db, id: path.split('/').pop(), data: () => db[path] }),
});

vi.mock('@/lib/firebase-admin', () => {
  const firestoreInstance = () => ({
    doc: (p: string) => refOf(p),
    collection: (path: string) => {
      const b: any = {
        where: () => b,
        limit: () => b,
        doc: () => refOf(`${path}/auto${++autoId}`),
        get: async () => ({ docs: [], empty: true }),
      };
      return b;
    },
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const pending: (() => void)[] = [];
      const tx = {
        get: async (ref: any) => ({ exists: ref.path in db, id: ref.id, data: () => db[ref.path] }),
        set: (ref: any, d: Doc) => { pending.push(() => { db[ref.path] = d; }); },
        update: (ref: any, d: Doc) => { pending.push(() => { db[ref.path] = { ...db[ref.path], ...d }; }); },
      };
      const out = await fn(tx);
      pending.forEach((f) => f());
      return out;
    },
  });
  (firestoreInstance as any).FieldValue = { serverTimestamp: () => ({ serverTs: true }) };
  return { verifyIdToken: (...a: unknown[]) => mockVerify(...a), initializeAdmin: () => ({ firestore: firestoreInstance }) };
});

import { POST } from '@/app/api/stays/checkout/route';

const C = 'h1';
const req = (body: unknown) => new Request('http://localhost/api/stays/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const base = { companyId: C, stayId: 's1', roomId: 'r1' };

beforeEach(() => {
  autoId = 0;
  mockVerify.mockResolvedValue({ uid: 'ana', companyId: C });
  // entrou há 3 horas: contratou 2h, já passou da tolerância → o servidor cobra 3h (3000)
  db = {
    [`companies/${C}`]: { name: 'Hotel', saleCounter: 0 },
    [`companies/${C}/employees/ana`]: { username: 'Ana', role: 'Employee', permissions: { rooms: 'write' } },
    [`companies/${C}/rooms/r1`]: { name: 'Quarto 1', ratePerHour: 1000 },
    [`companies/${C}/stays/s1`]: { status: 'open', roomName: 'Quarto 1', checkInAt: new Date(Date.now() - 3 * 3600_000).toISOString(), contractedHours: 2, ratePerHourApplied: 1000, consumptions: [] },
  };
});

describe('check-out: a hora e o valor são os do servidor', () => {
  it('a cotação devolve a hora do servidor e o valor, sem gravar nada', async () => {
    const before = JSON.stringify(db);
    const r = (await POST(req({ ...base, action: 'quote' }))) as Response;
    expect(r.status).toBe(200);
    const { quote } = await r.json();
    expect(Math.abs(quote.serverNow - Date.now())).toBeLessThan(5000);
    expect(quote.pricing.billedHours).toBe(3);
    expect(quote.pricing.totalAmountDue).toBe(3000);
    expect(JSON.stringify(db)).toBe(before);
  });

  it('o ecrã mostrou 2000 (relógio atrasado) e o servidor calcula 3000: trava com 409 e não grava', async () => {
    const before = JSON.stringify(db);
    const r = (await POST(req({ ...base, amountPaid: 2000, expectedTotal: 2000 }))) as Response;
    expect(r.status).toBe(409);
    const j = await r.json();
    expect(j.code).toBe('PRICE_CHANGED');
    expect(j.serverTotal).toBe(3000);
    expect(j.quote.pricing.billedHours).toBe(3);
    expect(JSON.stringify(db)).toBe(before);
    expect((db[`companies/${C}/stays/s1`] as Doc).status).toBe('open');
  });

  it('com o valor certo no ecrã, o check-out conclui', async () => {
    const r = (await POST(req({ ...base, amountPaid: 3000, expectedTotal: 3000 }))) as Response;
    expect(r.status).toBe(200);
    expect(db[`companies/${C}/stays/s1`].status).toBe('closed');
    expect(db[`companies/${C}/stays/s1`].totalAmountDue).toBe(3000);
  });

  it('ecrã antigo, sem valor esperado, continua a funcionar como antes', async () => {
    const r = (await POST(req({ ...base, amountPaid: 3000 }))) as Response;
    expect(r.status).toBe(200);
  });
});
