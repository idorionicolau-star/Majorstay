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
    collection: (path: string) => ({
      isCollection: true, path,
      doc: () => refOf(`${path}/auto${++autoId}`),
      orderBy: () => ({ limit: () => ({ get: async () => ({ docs: Object.keys(db).filter((k) => k.startsWith(`${path}/`)).map((k) => ({ id: k.split('/').pop(), data: () => db[k] })) }) }) }),
    }),
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const pending: (() => void)[] = [];
      const tx = {
        get: async (ref: any) => {
          if (ref.isCollection) {
            const docs = Object.keys(db).filter((k) => k.startsWith(`${ref.path}/`) && !k.slice(ref.path.length + 1).includes('/')).map((k) => ({ id: k.split('/').pop(), data: () => db[k] }));
            return { docs };
          }
          return { exists: ref.path in db, id: ref.id, data: () => db[ref.path] };
        },
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

import { POST as checkin } from '@/app/api/stays/checkin/route';
import { POST as extend } from '@/app/api/stays/extend/route';
import { POST as roomConfig, GET as roomChanges } from '@/app/api/rooms/config/route';

const C = 'h1';
const req = (url: string, body: unknown) => new Request(`http://localhost${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const stays = () => Object.keys(db).filter((k) => /\/stays\/[^/]+$/.test(k));
const audits = () => Object.entries(db).filter(([k]) => k.includes('/hospitalityAudit/')).map(([, v]) => v);

beforeEach(() => {
  autoId = 0;
  mockVerify.mockResolvedValue({ uid: 'ana', companyId: C });
  db = {
    [`companies/${C}`]: { name: 'Hotel', status: 'active' },
    [`companies/${C}/employees/ana`]: { username: 'Ana', role: 'Employee', permissions: { rooms: 'write' } },
    [`companies/${C}/employees/boss`]: { username: 'Chefe', role: 'Admin' },
    [`companies/${C}/rooms/r8`]: { name: 'Quarto 8', ratePerHour: 1000, minimumHours: 2, status: 'free', active: true },
  };
});

describe('check-in no servidor', () => {
  it('ignora preços enviados pelo computador: usa o do quarto (1000 a cada 2h)', async () => {
    const r = (await checkin(req('/api/stays/checkin', {
      companyId: C, roomId: 'r8', contractedHours: 2,
      ratePerHourApplied: 1, totalAmountDue: 1, ratePerHour: 1, blockHours: 1, totalAmountPaid: 0,
    }))) as Response;
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.totalAmountDue).toBe(1000);
    const s = db[stays()[0]];
    expect(s.ratePerHourApplied).toBe(500);
    expect(s.blockHours).toBe(2);
    expect(s.contractedHours).toBe(2);
    expect(s.totalAmountDue).toBe(1000);
    expect(s.openedBy).toBe('ana');
    expect(s.status).toBe('open');
    expect(db[`companies/${C}/rooms/r8`].status).toBe('occupied');
    expect(db[`companies/${C}/rooms/r8`].currentStayId).toBe(j.stayId);
    expect(audits().some((a) => a.action === 'open_stay')).toBe(true);
  });

  it('o ecrã mostrou um valor diferente do quarto: 409 e não grava nada', async () => {
    const r = (await checkin(req('/api/stays/checkin', { companyId: C, roomId: 'r8', contractedHours: 2, expectedTotal: 2000 }))) as Response;
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe('PRICE_CHANGED');
    expect(stays()).toHaveLength(0);
    expect(db[`companies/${C}/rooms/r8`].status).toBe('free');
  });

  it('com o valor certo no ecrã, grava', async () => {
    const r = (await checkin(req('/api/stays/checkin', { companyId: C, roomId: 'r8', contractedHours: 2, expectedTotal: 1000 }))) as Response;
    expect(r.status).toBe(200);
  });

  it('quarto ocupado: recusa', async () => {
    db[`companies/${C}/rooms/r8`].status = 'occupied';
    const r = (await checkin(req('/api/stays/checkin', { companyId: C, roomId: 'r8', contractedHours: 2 }))) as Response;
    expect(r.status).toBe(409);
    expect(stays()).toHaveLength(0);
  });

  it('funcionária sem escrita em Quartos: 403', async () => {
    db[`companies/${C}/employees/ana`].permissions = { rooms: 'read' };
    const r = (await checkin(req('/api/stays/checkin', { companyId: C, roomId: 'r8', contractedHours: 2 }))) as Response;
    expect(r.status).toBe(403);
  });

  it('outra empresa: 403', async () => {
    mockVerify.mockResolvedValue({ uid: 'ana', companyId: 'outra' });
    const r = (await checkin(req('/api/stays/checkin', { companyId: C, roomId: 'r8', contractedHours: 2 }))) as Response;
    expect(r.status).toBe(403);
  });

  it('subscrição suspensa: 403', async () => {
    db[`companies/${C}`].status = 'suspended';
    const r = (await checkin(req('/api/stays/checkin', { companyId: C, roomId: 'r8', contractedHours: 2 }))) as Response;
    expect(r.status).toBe(403);
  });

  it('pernoite sem preço no quarto: 400', async () => {
    const r = (await checkin(req('/api/stays/checkin', { companyId: C, roomId: 'r8', packageType: 'pernoite' }))) as Response;
    expect(r.status).toBe(400);
  });
});

describe('prorrogação no servidor', () => {
  beforeEach(() => {
    db[`companies/${C}/stays/s1`] = {
      status: 'open', roomName: 'Quarto 8', checkInAt: new Date(Date.now() - 3600_000).toISOString(),
      contractedHours: 2, ratePerHourApplied: 500, extensions: [], consumptions: [], totalAmountDue: 1000,
    };
  });

  it('acrescenta horas e recalcula o total com o preço gravado na estadia', async () => {
    const r = (await extend(req('/api/stays/extend', { companyId: C, stayId: 's1', hours: 2, totalAmountDue: 1 }))) as Response;
    expect(r.status).toBe(200);
    const s = db[`companies/${C}/stays/s1`];
    expect(s.extensions).toHaveLength(1);
    expect(s.extensions[0].hours).toBe(2);
    expect(s.totalAmountDue).toBe(2000);
    expect(audits().some((a) => a.action === 'extend_stay')).toBe(true);
  });

  it('horas inválidas e estadia fechada são recusadas', async () => {
    expect(((await extend(req('/api/stays/extend', { companyId: C, stayId: 's1', hours: 0 }))) as Response).status).toBe(400);
    db[`companies/${C}/stays/s1`].status = 'closed';
    expect(((await extend(req('/api/stays/extend', { companyId: C, stayId: 's1', hours: 1 }))) as Response).status).toBe(409);
  });
});

describe('editar quartos: só o administrador, com registo', () => {
  it('funcionária não consegue mudar o mínimo de horas: 403 e o quarto fica igual', async () => {
    const r = (await roomConfig(req('/api/rooms/config', { companyId: C, action: 'update', roomId: 'r8', data: { minimumHours: 1 } }))) as Response;
    expect(r.status).toBe(403);
    expect(db[`companies/${C}/rooms/r8`].minimumHours).toBe(2);
    expect(audits()).toHaveLength(0);
  });

  it('administrador muda o preço e fica registado quem, antes e depois', async () => {
    mockVerify.mockResolvedValue({ uid: 'boss', companyId: C });
    const r = (await roomConfig(req('/api/rooms/config', { companyId: C, action: 'update', roomId: 'r8', data: { ratePerHour: 1200, minimumHours: 2, status: 'free' } }))) as Response;
    expect(r.status).toBe(200);
    expect(db[`companies/${C}/rooms/r8`].ratePerHour).toBe(1200);
    const [a] = audits();
    expect(a.action).toBe('update_room');
    expect(a.userName).toBe('Chefe');
    expect(a.before.ratePerHour).toBe(1000);
    expect(a.after.ratePerHour).toBe(1200);
    expect(a.after.minimumHours).toBeUndefined();
  });

  it('valor inválido: 400', async () => {
    mockVerify.mockResolvedValue({ uid: 'boss', companyId: C });
    const r = (await roomConfig(req('/api/rooms/config', { companyId: C, action: 'update', roomId: 'r8', data: { ratePerHour: -1 } }))) as Response;
    expect(r.status).toBe(400);
  });

  it('administrador cria quarto; funcionária não', async () => {
    const denied = (await roomConfig(req('/api/rooms/config', { companyId: C, action: 'create', data: { name: 'Q9', ratePerHour: 500 } }))) as Response;
    expect(denied.status).toBe(403);
    mockVerify.mockResolvedValue({ uid: 'boss', companyId: C });
    const ok = (await roomConfig(req('/api/rooms/config', { companyId: C, action: 'create', data: { name: 'Q9', ratePerHour: 500, minimumHours: 1 } }))) as Response;
    expect(ok.status).toBe(200);
    const { roomId } = await ok.json();
    expect(db[`companies/${C}/rooms/${roomId}`]).toMatchObject({ name: 'Q9', ratePerHour: 500, status: 'free', active: true });
  });

  it('limite de quartos do plano é respeitado no servidor', async () => {
    mockVerify.mockResolvedValue({ uid: 'boss', companyId: C });
    db[`companies/${C}`] = { name: 'Hotel', status: 'active', tier: 'basico' }; // 15 quartos
    for (let i = 0; i < 14; i++) db[`companies/${C}/rooms/x${i}`] = { name: `X${i}`, active: true };
    // já há 15 (r8 + 14): o 16.º é recusado
    const r = (await roomConfig(req('/api/rooms/config', { companyId: C, action: 'create', data: { name: 'Q16' } }))) as Response;
    expect(r.status).toBe(409);
    delete db[`companies/${C}/rooms/x0`];
    const ok = (await roomConfig(req('/api/rooms/config', { companyId: C, action: 'create', data: { name: 'Q15' } }))) as Response;
    expect(ok.status).toBe(200);
  });

  it('o administrador vê o registo; a funcionária não', async () => {
    mockVerify.mockResolvedValue({ uid: 'boss', companyId: C });
    await roomConfig(req('/api/rooms/config', { companyId: C, action: 'update', roomId: 'r8', data: { minimumHours: 1 } }));
    const g = (await roomChanges(new Request(`http://localhost/api/rooms/config?companyId=${C}`))) as Response;
    expect(g.status).toBe(200);
    const { changes } = await g.json();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ roomName: 'Quarto 8', by: 'Chefe', before: { minimumHours: 2 }, after: { minimumHours: 1 } });
    mockVerify.mockResolvedValue({ uid: 'ana', companyId: C });
    expect(((await roomChanges(new Request(`http://localhost/api/rooms/config?companyId=${C}`))) as Response).status).toBe(403);
  });
});
