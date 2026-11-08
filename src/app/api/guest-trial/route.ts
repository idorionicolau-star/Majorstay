export const dynamic = 'force-dynamic';

import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebase-admin';
import { GUEST_TRIAL_ACTIONS, GUEST_TRIAL_MAX_DEVICES_PER_IP, type GuestTrialAction } from '@/lib/guest-trial';
import { trackGuestTrial, type TrialDb } from '@/lib/guest-trial-server';

// Relógio do teste de convidado (ver lib/guest-trial.ts). Sem login: é o que se usa ANTES de ter conta.
// O tempo conta por APARELHO (cookie + código do aparelho) e a rede (IP) limita quantos aparelhos pode abrir.
// Só se guardam hashes (nunca o IP nem o código) e uns números, na coleção `guestTrials` — que as regras do Firestore
// não abrem ao cliente (só o servidor lê e escreve).

const COOKIE = 'msx_gt';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~13 meses
const DEVICE_RE = /^[a-f0-9]{32}$/;

// Limite simples por instância, para ninguém encher a base de dados com pedidos.
const recent = new Map<string, number[]>();
function tooMany(key: string) {
    const now = Date.now();
    const list = (recent.get(key) || []).filter((t) => now - t < 60_000);
    list.push(now);
    recent.set(key, list);
    if (recent.size > 1000) recent.clear();
    return list.length > 120; // o batimento é de poucos em poucos segundos; redes partilhadas têm vários convidados
}

function clientIp(req: Request): string | null {
    const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = fwd || req.headers.get('x-real-ip')?.trim() || '';
    return ip || null;
}

const pepper = () => process.env.GUEST_TRIAL_PEPPER || 'majorstockx-guest-trial';
const hash = (kind: string, value: string) =>
    createHash('sha256').update(`${pepper()}|${kind}|${value}`).digest('hex').slice(0, 40);

function cookieOf(req: Request, name: string): string | null {
    const raw = req.headers.get('cookie') || '';
    for (const part of raw.split(';')) {
        const [k, ...v] = part.trim().split('=');
        if (k === name) return v.join('=') || null;
    }
    return null;
}

function maxDevices(): number {
    const n = parseInt(process.env.GUEST_TRIAL_MAX_DEVICES_PER_IP || '', 10);
    return Number.isFinite(n) && n > 0 ? n : GUEST_TRIAL_MAX_DEVICES_PER_IP;
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const action = body?.action as GuestTrialAction;
        if (!GUEST_TRIAL_ACTIONS.includes(action)) return NextResponse.json({ ok: false }, { status: 400 });

        const ip = clientIp(req);
        if (tooMany(ip || 'anon')) return NextResponse.json({ ok: false }, { status: 429 });

        // o aparelho: o cookie (sobrevive a limpar só o armazenamento da página); senão o código que a app guardou; senão um novo
        const fromCookie = cookieOf(req, COOKIE);
        const fromBody = typeof body?.deviceId === 'string' ? body.deviceId : '';
        const known = [fromCookie, fromBody].find((d): d is string => !!d && DEVICE_RE.test(d));
        const device = known || randomBytes(16).toString('hex');

        const admin = initializeAdmin();
        const firestore = admin.firestore();
        const col = firestore.collection('guestTrials');
        const db: TrialDb = {
            ref: (id) => col.doc(id),
            // o Transaction do Firestore tem o mesmo formato que o TrialTx
            runTransaction: (fn) => firestore.runTransaction((tx) => fn(tx as unknown as Parameters<typeof fn>[0])),
        };

        const result = await trackGuestTrial(db, {
            deviceId: hash('device', device),
            ipHash: ip ? hash('ip', ip) : null,
            action,
            now: Date.now(),
            maxDevices: maxDevices(),
        });

        const res = NextResponse.json({ ok: true, tracked: true, ...result });
        if (fromCookie !== device) {
            res.cookies.set(COOKIE, device, {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                maxAge: COOKIE_MAX_AGE,
                path: '/',
            });
        }
        return res;
    } catch (e) {
        console.error('guest-trial falhou:', e);
        // a app continua com o relógio do aparelho
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
