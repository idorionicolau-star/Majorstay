import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDocGet = vi.fn();
const mockDocUpdate = vi.fn();
const mockCollectionGet = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock('@/lib/firebase-admin', () => {
  const firestoreInstance = () => ({
    doc: (path: string) => ({
      path,
      get: () => mockDocGet(path),
    }),
    collection: (path: string) => {
      let limitCount = 100;
      const whereClauses: [string, string, any][] = [];

      const builder: any = {
        where: (field: string, op: string, val: any) => {
          whereClauses.push([field, op, val]);
          return builder;
        },
        limit: (l: number) => {
          limitCount = l;
          return builder;
        },
        get: () => mockCollectionGet(path, { whereClauses, limitCount }),
      };
      return builder;
    },
    runTransaction: (fn: any) => mockRunTransaction(fn),
  });

  return {
    initializeAdmin: () => ({
      firestore: firestoreInstance,
    }),
  };
});

import { GET } from '@/app/api/room-hub/route';
import { POST } from '@/app/api/room-hub/unlock/route';

describe('PARTE 1 — Segurança do PIN e QR (/api/room-hub & /unlock)', () => {
  const companyId = 'company-test';
  const roomId = 'room-101';

  let fakeDatabase: Record<string, any> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    fakeDatabase = {
      [`companies/${companyId}/rooms/${roomId}`]: {
        name: 'Quarto 101 - Presidencial',
        type: 'suite',
        status: 'occupied',
        ratePerHour: 500,
        currentStayId: 'stay-101',
      },
      [`companies/${companyId}`]: {
        name: 'Hotel Boa Vista',
        phone: '+258 84 999 8888',
        wifiSsid: 'BoaVista-VIP',
        wifiPassword: 'senhaUltraSecreta',
      },
      [`companies/${companyId}/stays/stay-101`]: {
        status: 'open',
        roomId,
        checkInAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        contractedHours: 2,
        ratePerHourApplied: 500,
        accessPin: '4821',
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        clientName: 'Carlos Mondlane',
        clientPhone: '841234567',
        clientDoc: '110293847B',
        openedBy: 'user-reception',
      },
      [`companies/${companyId}/products`]: [
        { id: 'p1', name: 'Água Mineral 500ml', price: 50, category: 'Bebidas' },
        { id: 'p2', name: 'Cerveja 2M', price: 120, category: 'Bebidas' },
        { id: 'p3', name: 'Item Eliminado', price: 80, deletedAt: '2026-11-01T00:00:00Z' },
        { id: 'p4', name: 'Produto Preço Zero', price: 0 },
      ],
    };

    mockDocGet.mockImplementation(async (path: string) => {
      const data = fakeDatabase[path];
      return {
        exists: Boolean(data),
        id: path.split('/').pop(),
        data: () => data,
      };
    });

    mockDocUpdate.mockImplementation(async (path: string, updates: any) => {
      if (fakeDatabase[path]) {
        fakeDatabase[path] = { ...fakeDatabase[path], ...updates };
      }
    });

    mockCollectionGet.mockImplementation(async (path: string) => {
      const docs = fakeDatabase[path] || [];
      return {
        empty: docs.length === 0,
        docs: docs.map((d: any) => ({
          id: d.id,
          data: () => d,
        })),
      };
    });

    mockRunTransaction.mockImplementation(async (updateFunction: any) => {
      const transaction = {
        get: async (ref: any) => {
          const path = typeof ref === 'string' ? ref : ref.path;
          return mockDocGet(path);
        },
        update: (ref: any, data: any) => {
          const path = typeof ref === 'string' ? ref : ref.path;
          mockDocUpdate(path, data);
        },
      };
      return updateFunction(transaction);
    });
  });

  // 1. GET /api/room-hub sem PIN
  it('sem PIN, a resposta NÃO contém stay, wifi, accessPin nem dados do hóspede', async () => {
    const res = await GET(new Request(`http://localhost/api/room-hub?c=${companyId}&r=${roomId}`));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Contém dados públicos mínimos
    expect(body.room.name).toBe('Quarto 101 - Presidencial');
    expect(body.room.status).toBe('occupied');
    expect(body.hotel.name).toBe('Hotel Boa Vista');
    expect(body.hotel.phone).toBe('+258 84 999 8888');
    expect(body.pinRequired).toBe(true);
    expect(body.barProducts).toHaveLength(2); // p3 e p4 excluídos

    // NUNCA devolve stay, wifi nem accessPin nem dados de hóspede
    expect(body.stay).toBeUndefined();
    expect(body.wifi).toBeUndefined();
    expect(body.hotel.wifiSsid).toBeUndefined();
    expect(body.hotel.wifiPassword).toBeUndefined();
    expect(body.accessPin).toBeUndefined();
    expect(body.clientName).toBeUndefined();
    expect(body.clientPhone).toBeUndefined();
    expect(body.clientDoc).toBeUndefined();
  });

  // 2. PIN errado -> 403
  it('POST /api/room-hub/unlock com PIN errado devolve 403 e incrementa tentativas', async () => {
    const req = new Request('http://localhost/api/room-hub/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: companyId, r: roomId, pin: '0000' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('PIN incorreto');

    // Tentativas incrementadas no banco
    const stayData = fakeDatabase[`companies/${companyId}/stays/stay-101`];
    expect(stayData.pinFailedAttempts).toBe(1);
  });

  // 3. 5 erros consecutivos -> 429 (bloqueio 15 min)
  it('ao 5.º erro consecutivo, bloqueia 15 minutos e devolve 429', async () => {
    fakeDatabase[`companies/${companyId}/stays/stay-101`].pinFailedAttempts = 4;

    const req = new Request('http://localhost/api/room-hub/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: companyId, r: roomId, pin: '0000' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('bloqueado');

    const stayData = fakeDatabase[`companies/${companyId}/stays/stay-101`];
    expect(stayData.pinFailedAttempts).toBe(5);
    expect(stayData.pinLockedUntil).toBeDefined();

    // Próxima chamada dentro dos 15 minutos é imediatamente 429 sem testar PIN
    const req2 = new Request('http://localhost/api/room-hub/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: companyId, r: roomId, pin: '4821' }), // mesmo se colocar o certo
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(429);
  });

  // 4. PIN certo -> dados da estadia e Wi-Fi (sem dados pessoais)
  it('POST /api/room-hub/unlock com PIN certo devolve 200, stay e wifi, e zera tentativas', async () => {
    fakeDatabase[`companies/${companyId}/stays/stay-101`].pinFailedAttempts = 2;

    const req = new Request('http://localhost/api/room-hub/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: companyId, r: roomId, pin: '4821' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.stay).toBeDefined();
    expect(body.stay.contractedHours).toBe(2);
    expect(body.stay.ratePerHour).toBe(500);

    // Wi-Fi desbloqueado
    expect(body.wifi.ssid).toBe('BoaVista-VIP');
    expect(body.wifi.password).toBe('senhaUltraSecreta');

    // NUNCA devolve dados pessoais
    expect(body.stay.clientName).toBeUndefined();
    expect(body.stay.clientPhone).toBeUndefined();
    expect(body.stay.clientDoc).toBeUndefined();
    expect(body.stay.accessPin).toBeUndefined();

    // Contadores de falhas zerados
    const stayData = fakeDatabase[`companies/${companyId}/stays/stay-101`];
    expect(stayData.pinFailedAttempts).toBe(0);
    expect(stayData.pinLockedUntil).toBeNull();
  });

  // 5. Quarto livre ou estadia fechada -> livre
  it('estadia fechada ou quarto livre: GET indica pinRequired=false e unlock retorna 404', async () => {
    fakeDatabase[`companies/${companyId}/rooms/${roomId}`].status = 'free';
    fakeDatabase[`companies/${companyId}/rooms/${roomId}`].currentStayId = null;

    const resGet = await GET(new Request(`http://localhost/api/room-hub?c=${companyId}&r=${roomId}`));
    expect(resGet.status).toBe(200);
    const bodyGet = await resGet.json();
    expect(bodyGet.room.status).toBe('free');
    expect(bodyGet.pinRequired).toBe(false);

    const reqUnlock = new Request('http://localhost/api/room-hub/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: companyId, r: roomId, pin: '4821' }),
    });
    const resUnlock = await POST(reqUnlock);
    expect(resUnlock.status).toBe(404);
  });

  // 6. Estadia sem PIN -> bloqueada (403, sem 1234 em empresas reais)
  it('estadia aberta sem accessPin fica bloqueada (403, sem 1234 em empresas reais)', async () => {
    delete fakeDatabase[`companies/${companyId}/stays/stay-101`].accessPin;

    const req = new Request('http://localhost/api/room-hub/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: companyId, r: roomId, pin: '1234' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('PIN indisponível ou acesso bloqueado');
  });

  // Modo convidado (guest): aceita '1234'
  it('modo convidado guest aceita 1234 fixo', async () => {
    const req = new Request('http://localhost/api/room-hub/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: 'guest', r: 'room-1', pin: '1234' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.wifi.ssid).toBe('MajorStay-VIP');
  });
});
