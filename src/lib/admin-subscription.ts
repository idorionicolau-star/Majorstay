// Administração: em que ponto está cada empresa (teste / subscrição) e quanto tempo lhe resta.
// Lógica pura (sem Firebase) — as mesmas regras do useSubscriptionState e das regras do Firestore.
import { GRACE_DAYS } from '@/lib/plans';

export type Standing =
    | 'trial' | 'trial_expired' | 'active' | 'active_open' | 'grace' | 'expired' | 'suspended';

export type CompanyStanding = { kind: Standing; daysLeft: number | null; endsAt: string | null; label: string };

const DAY = 86_400_000;
const valid = (iso?: string | null) => { if (!iso) return null; const d = new Date(iso); return isNaN(d.getTime()) ? null : d; };
/** Dias inteiros até à data (0 = acaba hoje), contados por dia de calendário de Maputo (UTC+2). */
export function daysUntil(end: Date, now: Date): number {
    const day = (d: Date) => Math.floor((d.getTime() + 2 * 3600_000) / DAY);
    return day(end) - day(now);
}
const plural = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

export function companyStanding(c: { status?: string; trialEndsAt?: string | null; subscriptionEndsAt?: string | null }, now = new Date()): CompanyStanding {
    const status = c.status || 'active';
    if (status === 'suspended' || status === 'inactive') return { kind: 'suspended', daysLeft: null, endsAt: null, label: 'Suspensa' };
    if (status === 'trial') {
        const end = valid(c.trialEndsAt);
        if (!end) return { kind: 'trial', daysLeft: null, endsAt: null, label: 'Teste (sem data de fim)' };
        if (now > end) return { kind: 'trial_expired', daysLeft: daysUntil(end, now), endsAt: end.toISOString(), label: `Teste acabou há ${plural(-daysUntil(end, now) || 0)}`.replace('há 0 dias', 'hoje') };
        const d = daysUntil(end, now);
        return { kind: 'trial', daysLeft: d, endsAt: end.toISOString(), label: d === 0 ? 'Teste acaba hoje' : `Teste: faltam ${plural(d)}` };
    }
    const end = valid(c.subscriptionEndsAt);
    if (!end) return { kind: 'active_open', daysLeft: null, endsAt: null, label: 'Activa (sem data de fim)' };
    const d = daysUntil(end, now);
    if (now <= end) return { kind: 'active', daysLeft: d, endsAt: end.toISOString(), label: d === 0 ? 'Subscrição acaba hoje' : `Subscrição: faltam ${plural(d)}` };
    if (now.getTime() <= end.getTime() + GRACE_DAYS * DAY) return { kind: 'grace', daysLeft: d, endsAt: end.toISOString(), label: `Em tolerância — acabou há ${plural(-d)}`.replace('há 0 dias', 'hoje') };
    return { kind: 'expired', daysLeft: d, endsAt: end.toISOString(), label: `Subscrição acabou há ${plural(-d)}` };
}

/** Ordem da lista: o que pede atenção primeiro (a acabar / tolerância), depois os restantes. */
export function standingOrder(s: CompanyStanding): number {
    const base: Record<Standing, number> = { grace: 0, trial: 1, active: 1, trial_expired: 3, expired: 3, active_open: 4, suspended: 5 };
    return base[s.kind] * 100_000 + (s.daysLeft == null ? 50_000 : Math.max(-49_999, Math.min(49_999, s.kind === 'trial_expired' || s.kind === 'expired' ? -s.daysLeft : s.daysLeft)));
}

/** ISO → valor de <input type="date"> (dia de Maputo). */
export function toDateInput(iso?: string | null): string {
    const d = valid(iso);
    if (!d) return '';
    return new Date(d.getTime() + 2 * 3600_000).toISOString().slice(0, 10);
}

/** <input type="date"> → ISO completo no fim desse dia em Maputo (23:59:59, UTC+2) — o formato que as regras lêem. */
export function fromDateInput(v: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return null;
    const d = new Date(`${v}T21:59:59.000Z`);
    return isNaN(d.getTime()) ? null : d.toISOString();
}
