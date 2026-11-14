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

describe('Gestão de Restauração e Dedução de Alimentos em Kg', () => {
  const companyId = 'hotel-pousada';
  const stayId = 'stay-101';
  const dishId = 'dish-bife-vaca';
  const rawMeatId = 'raw-carne-vaca';

  let fakeDatabase: Record<string, any> = {};

  beforeEach(() => {
    fakeDatabase = {
      [`companies/${companyId}/employees/user-admin`]: {
        username: 'Chef Carlos',
        role: 'Admin',
        permissions: { rooms: 'write' },
      },
      [`companies/${companyId}/stays/${stayId}`]: {
        id: stayId,
        status: 'open',
        roomName: 'Quarto 101',
        roomId: 'room-101',
        contractedHours: 2,
        ratePerHourApplied: 300,
        consumptions: [],
        totalAmountDue: 600,
      },
      // Matéria-prima na câmara fria (10 kg de carne)
      [`companies/${companyId}/products/${rawMeatId}`]: {
        id: rawMeatId,
        name: 'Carne de Vaca (Lombo)',
        stock: 10.0,
        unit: 'kg',
        cost: 400,
        price: 0,
        location: 'Câmara Frigorífica',
      },
      // Prato confecionado no menu (Bife com Batatas: 650 MT, consome 300g = 0.3 kg por dose)
      [`companies/${companyId}/products/${dishId}`]: {
        id: dishId,
        name: 'Bife à MajorStay com Batata',
        isDish: true,
        rawIngredientId: rawMeatId,
        rawIngredientName: 'Carne de Vaca (Lombo)',
        rawQuantityPerPortion: 0.3,
        price: 650,
        unit: 'dose',
        category: 'Pratos Principais',
      },
    };

    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-admin',
      email: 'chef@hotel.co.mz',
      companyId,
      superAdmin: false,
    });

    mockDocGet.mockImplementation(async (path: string) => {
      const data = fakeDatabase[path];
      return {
        exists: Boolean(data),
        data: () => data,
      };
    });

    mockRunTransaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        get: async (ref: { path: string }) => {
          const data = fakeDatabase[ref.path];
          return {
            exists: Boolean(data),
            data: () => data,
          };
        },
        update: (ref: { path: string }, data: Record<string, any>) => {
          if (fakeDatabase[ref.path]) {
            fakeDatabase[ref.path] = { ...fakeDatabase[ref.path], ...data };
          }
        },
        set: (ref: { path: string }, data: Record<string, any>) => {
          fakeDatabase[ref.path] = data;
        },
      };
      return fn(tx);
    });
  });

  it('ao pedir 2 bifes, abate 0.6 kg de carne de vaca na câmara frigorífica e fatura 1300 MT', async () => {
    const req = new Request('http://localhost/api/stays/consumption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        stayId,
        action: 'add',
        items: [
          {
            productId: dishId,
            quantity: 2,
            notes: 'Um bem passado e outro médio',
          },
        ],
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // 1. A estadia deve ter o prato registado com notas e referência à dedução de carne
    const updatedStay = fakeDatabase[`companies/${companyId}/stays/${stayId}`];
    expect(updatedStay.consumptions).toHaveLength(1);
    const item = updatedStay.consumptions[0];
    expect(item.productName).toBe('Bife à MajorStay com Batata');
    expect(item.quantity).toBe(2);
    expect(item.unitPrice).toBe(650);
    expect(item.totalPrice).toBe(1300);
    expect(item.notes).toBe('Um bem passado e outro médio');
    expect(item.rawDeduction).toEqual({
      ingredientId: rawMeatId,
      ingredientName: 'Carne de Vaca (Lombo)',
      quantityDeducted: 0.6,
      unit: 'kg',
    });

    // Total a pagar: 600 MT (quarto) + 1300 MT (2 bifes) = 1900 MT
    expect(updatedStay.totalAmountDue).toBe(1900);

    // 2. A matéria-prima deve ter passado de 10.0 kg para 9.4 kg (10 - 0.6 kg)
    const rawMeat = fakeDatabase[`companies/${companyId}/products/${rawMeatId}`];
    expect(rawMeat.stock).toBe(9.4);
  });

  it('ao cancelar/remover o consumo de comida, devolve os 0.6 kg de carne ao stock da cozinha', async () => {
    // 1. Lança primeiro o pedido
    const addReq = new Request('http://localhost/api/stays/consumption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        stayId,
        action: 'add',
        items: [{ productId: dishId, quantity: 2 }],
      }),
    });
    await POST(addReq);

    const stayBefore = fakeDatabase[`companies/${companyId}/stays/${stayId}`];
    const consumptionId = stayBefore.consumptions[0].id;
    expect(fakeDatabase[`companies/${companyId}/products/${rawMeatId}`].stock).toBe(9.4);

    // 2. Cancela o consumo
    const removeReq = new Request('http://localhost/api/stays/consumption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        stayId,
        action: 'remove',
        consumptionId,
        reason: 'Hóspede desistiu do pedido antes do preparo',
      }),
    });

    const res = await POST(removeReq);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // O stock da carne deve voltar para os 10.0 kg iniciais
    expect(fakeDatabase[`companies/${companyId}/products/${rawMeatId}`].stock).toBe(10);
    expect(fakeDatabase[`companies/${companyId}/stays/${stayId}`].consumptions).toHaveLength(0);
    expect(fakeDatabase[`companies/${companyId}/stays/${stayId}`].totalAmountDue).toBe(600);
  });

  const post = (items: unknown[]) =>
    POST(
      new Request('http://localhost/api/stays/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, stayId, action: 'add', items }),
      })
    );

  it('prato vendido ao peso: 0,5 kg a 800 MT/kg fatura 400 MT e abate 0,5 kg', async () => {
    fakeDatabase[`companies/${companyId}/products/dish-peixe`] = {
      id: 'dish-peixe', name: 'Peixe ao peso', isDish: true, soldByWeight: true,
      price: 800, unit: 'kg', rawIngredientId: rawMeatId, rawIngredientName: 'Carne de Vaca (Lombo)',
    };
    const res = await post([{ productId: 'dish-peixe', quantity: 1, weightKg: 0.5 }]);
    expect(res.status).toBe(200);
    const item = fakeDatabase[`companies/${companyId}/stays/${stayId}`].consumptions[0];
    expect(item.totalPrice).toBe(400);
    expect(item.weightKg).toBe(0.5);
    expect(item.rawDeduction.quantityDeducted).toBe(0.5);
    expect(fakeDatabase[`companies/${companyId}/products/${rawMeatId}`].stock).toBe(9.5);
  });

  it('prato ao peso sem peso é recusado e não mexe no stock', async () => {
    fakeDatabase[`companies/${companyId}/products/dish-peixe`] = {
      id: 'dish-peixe', name: 'Peixe ao peso', isDish: true, soldByWeight: true, price: 800, unit: 'kg',
    };
    const res = await post([{ productId: 'dish-peixe', quantity: 1 }]);
    expect(res.status).not.toBe(200);
    expect(fakeDatabase[`companies/${companyId}/stays/${stayId}`].consumptions).toHaveLength(0);
  });

  it('ingrediente em unidades: 3 meios frangos abatem 1,5 un', async () => {
    fakeDatabase[`companies/${companyId}/products/raw-frango`] = {
      id: 'raw-frango', name: 'Frango inteiro', stock: 10, unit: 'un', cost: 300, price: 0,
    };
    fakeDatabase[`companies/${companyId}/products/dish-frango`] = {
      id: 'dish-frango', name: 'Meio frango', isDish: true, price: 450, unit: 'dose',
      rawIngredientId: 'raw-frango', rawIngredientName: 'Frango inteiro', rawQuantityPerPortion: 0.5,
    };
    const res = await post([{ productId: 'dish-frango', quantity: 3 }]);
    expect(res.status).toBe(200);
    expect(fakeDatabase[`companies/${companyId}/products/raw-frango`].stock).toBe(8.5);
    const item = fakeDatabase[`companies/${companyId}/stays/${stayId}`].consumptions[0];
    expect(item.rawDeduction).toMatchObject({ quantityDeducted: 1.5, unit: 'un' });
  });
});
