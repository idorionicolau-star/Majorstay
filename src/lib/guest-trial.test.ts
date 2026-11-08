import { describe, it, expect } from 'vitest';
import {
  GUEST_TRIAL_LIMIT_MS, GUEST_TRIAL_GAP_MS, GUEST_TRIAL_MAX_DEVICES_PER_IP,
  EMPTY_GUEST_TRIAL, applyGuestTrial, registerDevice, type GuestTrialState,
} from '@/lib/guest-trial';
import { trackGuestTrial, type TrialDb, type TrialTx } from '@/lib/guest-trial-server';

const MIN = 60_000;

/** Base de dados falsa em memória, com o mesmo formato que o servidor usa. */
function fakeDb() {
  const store = new Map<string, Record<string, unknown>>();
  let writes = 0;
  const db: TrialDb = {
    ref: (id) => id,
    runTransaction: async (fn) => {
      const staged: Array<[string, Record<string, unknown>]> = [];
      const tx: TrialTx = {
        get: async (ref) => ({ exists: store.has(ref as string), data: () => store.get(ref as string) }),
        set: (ref, data) => { staged.push([ref as string, data]); },
      };
      const out = await fn(tx);
      for (const [k, v] of staged) { store.set(k, { ...(store.get(k) || {}), ...v }); writes++; }
      return out;
    },
  };
  return { db, store, writes: () => writes };
}

/** Uma sessão: bate de 30 em 30 segundos durante `minutes` minutos e fecha. Devolve o fim. */
async function useFor(db: TrialDb, device: string, ip: string | null, from: number, minutes: number) {
  let t = from;
  await trackGuestTrial(db, { deviceId: device, ipHash: ip, action: 'start', now: t });
  for (let i = 0; i < minutes * 2; i++) { t += 30_000; await trackGuestTrial(db, { deviceId: device, ipHash: ip, action: 'ping', now: t }); }
  await trackGuestTrial(db, { deviceId: device, ipHash: ip, action: 'end', now: t });
  return t;
}

describe('relógio do convidado (regra)', () => {
  it('só conta o tempo lá dentro e continua depois de sair', () => {
    let s: GuestTrialState = EMPTY_GUEST_TRIAL;
    s = applyGuestTrial(s, 'start', 0).state;
    for (let at = 30_000; at <= 10 * MIN; at += 30_000) s = applyGuestTrial(s, 'ping', at).state; // bate de 30 em 30 s
    const out = applyGuestTrial(s, 'end', 10 * MIN);
    expect(out.remainingMs).toBe(GUEST_TRIAL_LIMIT_MS - 10 * MIN);
    // horas depois, volta: continua com 20 minutos
    const back = applyGuestTrial(out.state, 'start', 5 * 60 * MIN);
    expect(back.allowed).toBe(true);
    expect(back.remainingMs).toBe(20 * MIN);
  });

  it('sem batimentos (fechou o separador) o tempo parado não conta', () => {
    let s = applyGuestTrial(EMPTY_GUEST_TRIAL, 'start', 0).state;
    s = applyGuestTrial(s, 'ping', 30_000).state;
    const out = applyGuestTrial(s, 'status', 30_000 + GUEST_TRIAL_GAP_MS + 5 * MIN);
    expect(out.remainingMs).toBe(GUEST_TRIAL_LIMIT_MS - 30_000);
  });

  it('ao fim dos 30 minutos fecha e não volta a abrir', () => {
    const t = 31 * MIN;
    let s = applyGuestTrial(EMPTY_GUEST_TRIAL, 'start', 0).state;
    for (let at = 30_000; at <= t; at += 30_000) s = applyGuestTrial(s, 'ping', at).state;
    const out = applyGuestTrial(s, 'ping', t);
    expect(out.allowed).toBe(false);
    expect(out.remainingMs).toBe(0);
    expect(applyGuestTrial(out.state, 'start', t + 100 * MIN).allowed).toBe(false);
  });
});

describe('aparelhos por rede', () => {
  it('um aparelho conhecido passa sempre; um novo só se houver lugar', () => {
    expect(registerDevice([], 'a')).toMatchObject({ allowed: true, changed: true, devices: ['a'] });
    expect(registerDevice(['a'], 'a')).toMatchObject({ allowed: true, changed: false });
    expect(registerDevice(['a', 'b'], 'c', 2)).toMatchObject({ allowed: false, changed: false });
    expect(registerDevice(['a', 'b'], 'a', 2)).toMatchObject({ allowed: true });
    expect(registerDevice('lixo', 'a')).toMatchObject({ allowed: true, devices: ['a'] });
    expect(GUEST_TRIAL_MAX_DEVICES_PER_IP).toBeGreaterThan(1);
  });
});

describe('servidor: tempo por aparelho, limite por rede', () => {
  it('sair e voltar continua a contagem do mesmo aparelho', async () => {
    const { db } = fakeDb();
    const end = await useFor(db, 'dev-A', 'ip-1', 0, 10);
    const back = await trackGuestTrial(db, { deviceId: 'dev-A', ipHash: 'ip-1', action: 'start', now: end + 3 * 60 * MIN });
    expect(back.allowed).toBe(true);
    expect(back.remainingMs).toBe(20 * MIN);
  });

  it('gastar os 30 minutos bloqueia esse aparelho, não os outros da mesma rede', async () => {
    const { db } = fakeDb();
    await useFor(db, 'dev-A', 'ip-1', 0, 31);
    const a = await trackGuestTrial(db, { deviceId: 'dev-A', ipHash: 'ip-1', action: 'start', now: 100 * MIN });
    expect(a).toMatchObject({ allowed: false, reason: 'time', remainingMs: 0 });
    // outra pessoa na mesma rede (IP partilhado) tem os seus 30 minutos
    const b = await trackGuestTrial(db, { deviceId: 'dev-B', ipHash: 'ip-1', action: 'start', now: 100 * MIN });
    expect(b).toMatchObject({ allowed: true, remainingMs: GUEST_TRIAL_LIMIT_MS });
  });

  it('limpar os dados do browser (aparelho novo) não dá tempo infinito: a rede limita os aparelhos', async () => {
    const { db } = fakeDb();
    const max = 3;
    for (let i = 0; i < max; i++) {
      const r = await trackGuestTrial(db, { deviceId: `novo-${i}`, ipHash: 'ip-1', action: 'start', now: i * MIN, maxDevices: max });
      expect(r.allowed).toBe(true);
    }
    const extra = await trackGuestTrial(db, { deviceId: 'novo-extra', ipHash: 'ip-1', action: 'start', now: 10 * MIN, maxDevices: max });
    expect(extra).toMatchObject({ allowed: false, reason: 'network', remainingMs: 0 });
    // os que já estavam continuam a poder entrar
    expect((await trackGuestTrial(db, { deviceId: 'novo-0', ipHash: 'ip-1', action: 'ping', now: 10 * MIN, maxDevices: max })).allowed).toBe(true);
    // e outra rede não é afetada
    expect((await trackGuestTrial(db, { deviceId: 'novo-extra', ipHash: 'ip-2', action: 'start', now: 10 * MIN, maxDevices: max })).allowed).toBe(true);
  });

  it('"status" só lê: ver o login não grava nada nem gasta um lugar da rede', async () => {
    const { db, store, writes } = fakeDb();
    const r = await trackGuestTrial(db, { deviceId: 'dev-A', ipHash: 'ip-1', action: 'status', now: 0 });
    expect(r).toMatchObject({ allowed: true, remainingMs: GUEST_TRIAL_LIMIT_MS });
    expect(store.size).toBe(0);
    expect(writes()).toBe(0);
  });

  it('sem IP conhecido segue só o aparelho', async () => {
    const { db, store } = fakeDb();
    const r = await trackGuestTrial(db, { deviceId: 'dev-A', ipHash: null, action: 'start', now: 0 });
    expect(r.allowed).toBe(true);
    expect([...store.keys()]).toEqual(['dev_dev-A']);
  });
});
