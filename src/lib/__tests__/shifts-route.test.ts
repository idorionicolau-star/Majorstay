import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, any>;
let db: Record<string, Doc> = {};
const mockVerify = vi.fn();
const mockEmail = vi.fn();
let autoId = 0;
vi.mock('@/lib/shift-email-server', () => ({ sendShiftCloseEmail: (...a: unknown[]) => mockEmail(...a) }));

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
        doc: (id?: string) => refOf(`${path}/${id ?? `auto${++autoId}`}`),
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
  (firestoreInstance as any).FieldValue = { serverTimestamp: () => { const ms = Date.now(); return { ms, toDate: () => new Date(ms) }; } };
  (firestoreInstance as any).Timestamp = { fromDate: (d: Date) => ({ ms: d.getTime() }) };
  return { verifyIdToken: (...a: unknown[]) => mockVerify(...a), initializeAdmin: () => ({ firestore: firestoreInstance }) };
});

import { GET, POST } from '@/app/api/shifts/route';

const C = 'h1';
const req = (body: unknown) => new Request('http://localhost/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const as = (uid: string) => mockVerify.mockResolvedValue({ uid, companyId: C });

beforeEach(() => {
  mockEmail.mockClear();
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

describe('vários turnos, e o email ao fechar', () => {
  it('a mesma pessoa fecha e volta a abrir outro turno logo a seguir', async () => {
    as('ana');
    expect((await POST(req({ companyId: C, action: 'open', openingCash: 500 }))).status).toBe(200);
    expect((await POST(req({ companyId: C, action: 'close', countedCash: 500 }))).status).toBe(200);
    expect((await POST(req({ companyId: C, action: 'open', openingCash: 500 }))).status).toBe(200);
    expect(Object.keys(db).filter((k) => /\/shifts\/[^/]+$/.test(k))).toHaveLength(2);
    // continua a ser uma só caixa: não abre um terceiro com o segundo aberto
    expect((await POST(req({ companyId: C, action: 'open', openingCash: 500 }))).status).toBe(409);
  });

  it('o GET diz quando a pessoa fechou o último turno', async () => {
    as('ana');
    let j = await (await GET(new Request(`http://localhost/api/shifts?companyId=${C}`))).json();
    expect(j.lastClosed).toBeNull();
    await POST(req({ companyId: C, action: 'open', openingCash: 500 }));
    await POST(req({ companyId: C, action: 'close', countedCash: 500 }));
    j = await (await GET(new Request(`http://localhost/api/shifts?companyId=${C}`))).json();
    expect(typeof j.lastClosed.closedAt).toBe('string');
  });

  it('fechar o turno envia o email ao gerente com a diferença', async () => {
    as('ana');
    await POST(req({ companyId: C, action: 'open', openingCash: 500 }));
    await POST(req({ companyId: C, action: 'close', countedCash: 450, notes: 'troco' }));
    expect(mockEmail).toHaveBeenCalledTimes(1);
    const [cid, info] = mockEmail.mock.calls[0];
    expect(cid).toBe(C);
    expect(info).toMatchObject({ employee: 'Ana', openingCash: 500, countedCash: 450, expectedCash: 500, difference: -50, notes: 'troco' });
  });
});

describe('janela do turno (para os totais do turno)', () => {
  const get = async () => (await (await GET(new Request(`http://localhost/api/shifts?companyId=${C}`))).json()).window;

  it('sem turnos não há janela; aberto dá desde a abertura; fechado dá o último turno', async () => {
    as('ana');
    expect(await get()).toBeNull();
    await POST(req({ companyId: C, action: 'open', openingCash: 500 }));
    const open = await get();
    expect(open).toMatchObject({ status: 'open', to: null });
    expect(typeof open.from).toBe('string');
    as('rui'); // quem não tem o turno também vê a janela da caixa aberta
    expect((await get()).status).toBe('open');
    as('ana');
    await POST(req({ companyId: C, action: 'close', countedCash: 500 }));
    const closed = await get();
    expect(closed.status).toBe('closed');
    expect(typeof closed.to).toBe('string');
  });
});
