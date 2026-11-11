import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDocGet = vi.fn();
const mockCollectionGet = vi.fn();

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
  });

  return {
    initializeAdmin: () => ({
      firestore: firestoreInstance,
    }),
  };
});

import { GET } from '@/app/api/room-hub/route';

describe('PARTE 4 — QR do Hóspede (/api/room-hub)', () => {
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
        // Sem wifi configurado propositadamente
      },
      [`companies/${companyId}/stays/stay-101`]: {
        status: 'open',
        checkInAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        contractedHours: 2,
        ratePerHourApplied: 500,
        clientName: 'Joaquim Silva',
        clientPhone: '841112233',
        clientDoc: '110293847B',
        openedBy: 'user-reception',
      },
      [`companies/${companyId}/products`]: [
        {
          id: 'p1',
          name: 'Água Mineral 500ml',
          price: 50,
          category: 'Bebidas',
          // sem campo 'active' (produtos normais do sistema)
        },
        {
          id: 'p2',
          name: 'Água Mineral 500ml', // Produto duplicado em outra localização
          price: 50,
          category: 'Bebidas',
          location: 'Bar Secundário',
        },
        {
          id: 'p3',
          name: 'Cerveja 2M',
          price: 120,
          category: 'Bebidas',
        },
        {
          id: 'p4',
          name: 'Item Eliminado',
          price: 80,
          deletedAt: '2026-11-01T00:00:00Z',
        },
        {
          id: 'p5',
          name: 'Produto Grátis ou Inválido',
          price: 0,
        },
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
  });

  it('retorna 400 se faltar o parâmetro c (empresa) ou r (quarto)', async () => {
    const res = await GET(new Request('http://localhost/api/room-hub'));
    expect(res.status).toBe(400);
  });

  it('devolve wifiSsid e wifiPassword como null quando não configurados pelo dono', async () => {
    const res = await GET(new Request(`http://localhost/api/room-hub?c=${companyId}&r=${roomId}`));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.hotel.name).toBe('Hotel Boa Vista');
    expect(data.hotel.wifiSsid).toBeNull();
    expect(data.hotel.wifiPassword).toBeNull();
  });

  it('devolve wifiSsid e wifiPassword quando o dono os configurou', async () => {
    fakeDatabase[`companies/${companyId}`].wifiSsid = 'BoaVista-Guest';
    fakeDatabase[`companies/${companyId}`].wifiPassword = 'segredoSeguro2026';

    const res = await GET(new Request(`http://localhost/api/room-hub?c=${companyId}&r=${roomId}`));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.hotel.wifiSsid).toBe('BoaVista-Guest');
    expect(data.hotel.wifiPassword).toBe('segredoSeguro2026');
  });

  it('carrega produtos sem filtro active, exclui eliminados/preço zero e deduplica por nome', async () => {
    const res = await GET(new Request(`http://localhost/api/room-hub?c=${companyId}&r=${roomId}`));
    expect(res.status).toBe(200);
    const data = await res.json();

    // Produtos retornados: 'Água Mineral 500ml' (1 vez) e 'Cerveja 2M' (1 vez)
    // p2 duplicado foi ignorado; p4 (deletedAt) foi ignorado; p5 (preço 0) foi ignorado.
    expect(data.barProducts).toHaveLength(2);
    expect(data.barProducts.map((p: any) => p.name)).toEqual(['Água Mineral 500ml', 'Cerveja 2M']);
  });

  it('garante que a rota pública não vaza dados sensíveis (clientDoc, clientPhone, openedBy)', async () => {
    const res = await GET(new Request(`http://localhost/api/room-hub?c=${companyId}&r=${roomId}`));
    expect(res.status).toBe(200);
    const data = await res.json();

    // Estadia ativa tem apenas dados públicos para o visor
    expect(data.stay).toBeDefined();
    expect(data.stay.contractedHours).toBe(2);
    expect(data.stay.ratePerHour).toBe(500);

    // Não deve conter dados pessoais
    expect(data.stay.clientDoc).toBeUndefined();
    expect(data.stay.clientPhone).toBeUndefined();
    expect(data.stay.openedBy).toBeUndefined();
  });
});
