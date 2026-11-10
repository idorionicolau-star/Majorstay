import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateStayPricing } from '../hospitality-calc';

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

describe('PARTE 1 — Consumos do Bar no Servidor', () => {
  describe('Saneamento em calculateStayPricing', () => {
    const baseIn = new Date('2026-11-10T10:00:00Z');
    const baseOut = new Date('2026-11-10T11:00:00Z');

    it('calcula o valor dos consumos como quantity * unitPrice', () => {
      const pricing = calculateStayPricing({
        checkInAt: baseIn,
        checkOutAt: baseOut,
        contractedHours: 1,
        ratePerHour: 300,
        consumptions: [
          { id: '1', productName: 'Cerveja 2M', quantity: 3, unitPrice: 100, totalPrice: 999, addedAt: baseIn, addedBy: 'u1' },
          { id: '2', productName: 'Água', quantity: 2, unitPrice: 50, totalPrice: 10, addedAt: baseIn, addedBy: 'u1' },
        ],
      });

      // 3 * 100 + 2 * 50 = 400 (ignora totalPrice adulterado 999 e 10)
      expect(pricing.consumptionsAmountDue).toBe(400);
      expect(pricing.totalAmountDue).toBe(700); // 300 estadia + 400 consumos
    });

    it('recusa e lança erro quando há quantidade negativa', () => {
      expect(() =>
        calculateStayPricing({
          checkInAt: baseIn,
          checkOutAt: baseOut,
          contractedHours: 1,
          ratePerHour: 300,
          consumptions: [
            { id: '1', productName: 'Cerveja', quantity: -2, unitPrice: 100, totalPrice: -200, addedAt: baseIn, addedBy: 'u1' },
          ],
        })
      ).toThrowError(/Consumo inválido/);
    });

    it('recusa e lança erro quando há preço unitário negativo', () => {
      expect(() =>
        calculateStayPricing({
          checkInAt: baseIn,
          checkOutAt: baseOut,
          contractedHours: 1,
          ratePerHour: 300,
          consumptions: [
            { id: '1', productName: 'Cerveja', quantity: 2, unitPrice: -50, totalPrice: -100, addedAt: baseIn, addedBy: 'u1' },
          ],
        })
      ).toThrowError(/Consumo inválido/);
    });

    it('recusa e lança erro quando quantity ou unitPrice não são numéricos', () => {
      expect(() =>
        calculateStayPricing({
          checkInAt: baseIn,
          checkOutAt: baseOut,
          contractedHours: 1,
          ratePerHour: 300,
          consumptions: [
            { id: '1', productName: 'Cerveja', quantity: NaN as any, unitPrice: 100, totalPrice: 0, addedAt: baseIn, addedBy: 'u1' },
          ],
        })
      ).toThrowError(/Consumo inválido/);
    });
  });

  describe('Endpoint POST /api/stays/consumption', () => {
    const companyId = 'comp-123';
    const stayId = 'stay-456';
    const productId = 'prod-789';

    let fakeDatabase: Record<string, any> = {};

    beforeEach(() => {
      vi.clearAllMocks();

      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-admin',
        email: 'admin@stay.com',
        superAdmin: false,
        companyId,
      });

      fakeDatabase = {
        [`companies/${companyId}/employees/user-admin`]: {
          username: 'Administrador',
          role: 'Admin',
          permissions: { rooms: 'write' },
        },
        [`companies/${companyId}/stays/${stayId}`]: {
          status: 'open',
          roomName: 'Quarto 4',
          roomId: 'room-4',
          contractedHours: 1,
          ratePerHourApplied: 300,
          consumptions: [],
          totalAmountDue: 300,
        },
        [`companies/${companyId}/products/${productId}`]: {
          name: 'Cerveja 2M 330ml',
          price: 120,
          stock: 10,
          location: 'Bar Principal',
        },
      };

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

    it('utiliza o preço do catálogo e IGNORA o unitPrice enviado pelo cliente', async () => {
      const req = new Request('http://localhost/api/stays/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          stayId,
          action: 'add',
          items: [
            {
              productId,
              productName: 'Nome enviado pelo cliente',
              quantity: 2,
              unitPrice: 10, // Preço fraudulento do cliente
            },
          ],
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      const updatedStay = fakeDatabase[`companies/${companyId}/stays/${stayId}`];
      expect(updatedStay.consumptions).toHaveLength(1);
      // Preço do catálogo (120 MT), ignorando os 10 MT enviados pelo cliente
      expect(updatedStay.consumptions[0].unitPrice).toBe(120);
      expect(updatedStay.consumptions[0].totalPrice).toBe(240);
      expect(updatedStay.totalAmountDue).toBe(540); // 300 h + 240 bar
    });

    it('abate o stock do produto no catálogo e gera movimento de saída', async () => {
      const req = new Request('http://localhost/api/stays/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          stayId,
          action: 'add',
          items: [
            {
              productId,
              quantity: 3,
            },
          ],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const updatedProd = fakeDatabase[`companies/${companyId}/products/${productId}`];
      // Stock inicial era 10, abateu 3 -> deve ficar 7
      expect(updatedProd.stock).toBe(7);
    });

    it('abate até 0 quando o stock é insuficiente e não bloqueia a operação', async () => {
      const req = new Request('http://localhost/api/stays/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          stayId,
          action: 'add',
          items: [
            {
              productId,
              quantity: 15, // Pede 15, mas só há 10 em stock
            },
          ],
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const updatedProd = fakeDatabase[`companies/${companyId}/products/${productId}`];
      expect(updatedProd.stock).toBe(0);
    });

    it('rejeita quantidade inválida (0, negativa, superior a 100 ou não inteira)', async () => {
      const invalidQuantities = [0, -1, 101, 2.5];

      for (const invalidQty of invalidQuantities) {
        const req = new Request('http://localhost/api/stays/consumption', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            stayId,
            action: 'add',
            items: [{ productId, quantity: invalidQty }],
          }),
        });

        const res = await POST(req);
        const json = await res.json();
        expect(res.status).toBe(400);
        expect(json.error).toMatch(/Quantidade inválida/);
      }
    });

    it('rejeita lançamento em estadia já fechada', async () => {
      fakeDatabase[`companies/${companyId}/stays/${stayId}`].status = 'closed';

      const req = new Request('http://localhost/api/stays/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          stayId,
          action: 'add',
          items: [{ productId, quantity: 1 }],
        }),
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toMatch(/já está encerrada/);
    });

    it('permite item livre (sem productId) para Admin/Dono e rejeita para funcionário comum', async () => {
      // 1. Como funcionário comum
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'user-rec',
        email: 'rec@stay.com',
        superAdmin: false,
        companyId,
      });
      fakeDatabase[`companies/${companyId}/employees/user-rec`] = {
        username: 'Rececionista',
        role: 'Funcionario',
        permissions: { rooms: 'write' },
      };

      const reqRec = new Request('http://localhost/api/stays/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          stayId,
          action: 'add',
          items: [{ productName: 'Serviço de Lavandaria', quantity: 1, unitPrice: 200 }],
        }),
      });

      const resRec = await POST(reqRec);
      const jsonRec = await resRec.json();
      expect(resRec.status).toBe(400);
      expect(jsonRec.error).toMatch(/Apenas Administradores ou Donos/);

      // 2. Como Admin
      const reqAdmin = new Request('http://localhost/api/stays/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          stayId,
          action: 'add',
          items: [{ productName: 'Serviço de Lavandaria', quantity: 1, unitPrice: 200 }],
        }),
      });

      const resAdmin = await POST(reqAdmin);
      expect(resAdmin.status).toBe(200);
    });

    it('rejeita item livre com preço negativo ou zero', async () => {
      const req = new Request('http://localhost/api/stays/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          stayId,
          action: 'add',
          items: [{ productName: 'Item Livre', quantity: 1, unitPrice: -50 }],
        }),
      });

      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toMatch(/maior que zero/);
    });

    it('na remoção, devolve o stock ao produto e exige motivo não vazio', async () => {
      // Configurar estadia com um consumo existente
      const existingConsumption = {
        id: 'cons-existing-1',
        productId,
        productName: 'Cerveja 2M 330ml',
        quantity: 3,
        unitPrice: 120,
        totalPrice: 360,
      };
      fakeDatabase[`companies/${companyId}/stays/${stayId}`].consumptions = [existingConsumption];
      fakeDatabase[`companies/${companyId}/stays/${stayId}`].totalAmountDue = 660;
      fakeDatabase[`companies/${companyId}/products/${productId}`].stock = 7;

      // 1. Tentar remover sem motivo
      const reqNoReason = new Request('http://localhost/api/stays/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          stayId,
          action: 'remove',
          consumptionId: 'cons-existing-1',
          reason: '   ', // Motivo em branco
        }),
      });

      const resNoReason = await POST(reqNoReason);
      const jsonNoReason = await resNoReason.json();
      expect(resNoReason.status).toBe(400);
      expect(jsonNoReason.error).toMatch(/motivo da remoção.*obrigatório/);

      // 2. Remover com motivo válido
      const reqValid = new Request('http://localhost/api/stays/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          stayId,
          action: 'remove',
          consumptionId: 'cons-existing-1',
          reason: 'Cliente cancelou pedido antes da entrega',
        }),
      });

      const resValid = await POST(reqValid);
      expect(resValid.status).toBe(200);

      // Consumo removido da estadia
      const updatedStay = fakeDatabase[`companies/${companyId}/stays/${stayId}`];
      expect(updatedStay.consumptions).toHaveLength(0);
      expect(updatedStay.totalAmountDue).toBe(300);

      // Stock do produto devolvido: 7 + 3 = 10
      const updatedProd = fakeDatabase[`companies/${companyId}/products/${productId}`];
      expect(updatedProd.stock).toBe(10);
    });
  });
});
