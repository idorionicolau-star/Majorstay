import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, any>;
let db: Record<string, Doc> = {};
const mockVerify = vi.fn();

function docsOf(path: string, wheres: [string, any][]) {
  return Object.keys(db)
    .filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/'))
    .map((k) => ({ id: k.slice(path.length + 1), data: () => db[k], ref: refOf(k), exists: true }))
    .filter((d) => wheres.every(([f, op, v]: any) => (op === '>=' ? Number(d.data()[f]?.ms ?? d.data()[f]) >= Number(v?.ms ?? v) : d.data()[f] === v)));
}
function refOf(path: string): any {
  return {
    path, id: path.split('/').pop(),
    get: async () => ({ exists: path in db, id: path.split('/').pop(), data: () => db[path], ref: refOf(path) }),
    set: async (d: Doc) => { db[path] = d; },
    update: async (d: Doc) => { db[path] = { ...db[path], ...d }; },
    delete: async () => { delete db[path]; },
  };
}

vi.mock('@/lib/firebase-admin', () => {
  const firestoreInstance = () => ({
    doc: (p: string) => refOf(p),
    collection: (path: string) => {
      const wheres: any[] = [];
      const b: any = {
        where: (f: string, op: string, v: any) => { wheres.push([f, op, v]); return b; },
        orderBy: () => b,
        limit: () => b,
        get: async () => { const docs = docsOf(path, wheres); return { empty: docs.length === 0, docs }; },
      };
      return b;
    },
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      let wrote = false;
      const pending: (() => void)[] = [];
      const tx = {
        get: async (ref: any) => {
          if (wrote) throw new Error('reads after writes');
          return { exists: ref.path in db, id: ref.id, data: () => db[ref.path] };
        },
        set: (ref: any, d: Doc) => { wrote = true; pending.push(() => { db[ref.path] = d; }); },
      };
      const out = await fn(tx);
      pending.forEach((f) => f());
      return out;
    },
  });
  (firestoreInstance as any).FieldValue = { serverTimestamp: () => ({ ms: Date.now() }) };
  (firestoreInstance as any).Timestamp = { fromDate: (d: Date) => ({ ms: d.getTime() }) };
  return { verifyIdToken: (...a: unknown[]) => mockVerify(...a), initializeAdmin: () => ({ firestore: firestoreInstance }) };
});

import { GET, POST } from '@/app/api/shifts/route';

const C = 'h1';
const req = (body: unknown) => new Request('http://localhost/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const as = (uid: string) => mockVerify.mockResolvedValue({ uid, companyId: C });

beforeEach(() => {
  db = {
    [`companies/${C}/employees/ana`]: { username: 'Ana', role: 'Employee', permissions: { rooms: 'write' } },
    [`companies/${C}/employees/rui`]: { username: 'Rui', role: 'Employee', permissions: { rooms: 'write' } },
    [`companies/${C}/employees/boss`]: { username: 'Chefe', role: 'Admin', permissions: {} },
  };
});

describe('uma só caixa: um turno aberto de cada vez', () => {
  it('o segundo recepcionista não consegue abrir turno enquanto o primeiro está aberto', async () => {
    as('ana');
    expect((await POST(req({ companyId: C, action: 'open', openingCash: 500 }))).status).toBe(200);
    as('rui');
    const r = await POST(req({ companyId: C, action: 'open', openingCash: 500 }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain('Ana');
  });

  it('depois de a Ana fechar, o Rui abre', async () => {
    as('ana');
    await POST(req({ companyId: C, action: 'open', openingCash: 500 }));
    await POST(req({ companyId: C, action: 'close', countedCash: 500 }));
    as('rui');
    expect((await POST(req({ companyId: C, action: 'open', openingCash: 500 }))).status).toBe(200);
  });

  it('o gerente fecha o turno de quem se esqueceu, e a caixa fica livre', async () => {
    as('ana');
    await POST(req({ companyId: C, action: 'open', openingCash: 500 }));
    const shiftId = Object.keys(db).find((k) => k.includes('/shifts/'))!.split('/').pop();
    as('rui');
    expect((await POST(req({ companyId: C, action: 'close', shiftId, countedCash: 0 }))).status).toBe(403);
    as('boss');
    const r = await POST(req({ companyId: C, action: 'close', shiftId, countedCash: 450 }));
    expect(r.status).toBe(200);
    expect((await r.json()).difference).toBe(-50);
    as('rui');
    expect((await POST(req({ companyId: C, action: 'open', openingCash: 450 }))).status).toBe(200);
  });

  it('quem não tem turno vê quem está com a caixa, sem valores', async () => {
    as('ana');
    await POST(req({ companyId: C, action: 'open', openingCash: 500 }));
    as('rui');
    const j = await (await GET(new Request(`http://localhost/api/shifts?companyId=${C}`))).json();
    expect(j.current).toBeNull();
    expect(j.otherOpen.employeeName).toBe('Ana');
    expect(JSON.stringify(j)).not.toContain('500');
  });
});
