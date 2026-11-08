// Emails de acompanhamento (follow-up): prazos da conta, primeiros passos, falta de uso e contagem de stock.
// Lógica pura (sem Firebase), para ser testada. O cron /api/cron/followups junta os factos de cada empresa,
// pede aqui o próximo email (no máximo um por dia) e regista o que foi enviado para nunca repetir.
//
// Regras para não ser invasivo:
//  - no máximo 1 email por dia e 3 por semana por empresa;
//  - cada lembrete vai uma vez (ou, na contagem, uma vez por período);
//  - pára quando a pessoa faz o que se pedia;
//  - "dicas" (primeiros passos, falta de uso, contagem) respeitam o "não quero receber"; os avisos de prazos
//    (teste / subscrição a acabar) são sobre a conta e vão sempre.

import { GRACE_DAYS } from '@/lib/plans';

const DAY = 86_400_000;

/** Prazo da contagem por defeito (dias); cada empresa pode mudar em Ajustes. */
export const DEFAULT_COUNT_EVERY_DAYS = 30;
export const MAX_PER_WEEK = 3;

export type FollowupKind = 'account' | 'tips';

export type FollowupType =
    | 'trial-3d' | 'trial-last' | 'trial-ended'
    | 'sub-3d' | 'sub-ended'
    | 'start-products' | 'start-sale'
    | 'inactive-5' | 'inactive-14'
    | 'count';

/** Lista dos emails (para a Administração: testar e mostrar o que cada um é). */
export const FOLLOWUP_CATALOG: { type: FollowupType; kind: FollowupKind; label: string; when: string }[] = [
    { type: 'trial-3d', kind: 'account', label: 'Teste a acabar', when: 'faltam 1–3 dias para o fim do teste' },
    { type: 'trial-last', kind: 'account', label: 'Último dia do teste', when: 'no dia em que o teste acaba' },
    { type: 'trial-ended', kind: 'account', label: 'Teste terminou', when: 'até 7 dias depois do fim do teste' },
    { type: 'sub-3d', kind: 'account', label: 'Subscrição a acabar', when: 'faltam 0–3 dias para o fim da subscrição' },
    { type: 'sub-ended', kind: 'account', label: 'Subscrição terminou', when: 'logo depois do fim (tolerância)' },
    { type: 'start-products', kind: 'tips', label: 'Adicionar produtos', when: '2 dias depois do registo, sem produtos' },
    { type: 'start-sale', kind: 'tips', label: 'Primeira venda', when: '3 dias depois do registo, com produtos e sem vendas' },
    { type: 'inactive-5', kind: 'tips', label: 'Está tudo bem?', when: '5 dias sem usar a app' },
    { type: 'inactive-14', kind: 'tips', label: 'Sentimos a sua falta', when: '14 dias sem usar a app' },
    { type: 'count', kind: 'tips', label: 'Contagem do stock', when: 'passou o prazo (30 dias) sem contagem' },
];

export type CompanyFacts = {
    status?: string;
    trialEndsAt?: string | null;
    subscriptionEndsAt?: string | null;
    /** quando a empresa começou (registo / início do teste) */
    startedAt?: string | null;
    /** última vez que alguém da empresa abriu a app */
    lastActiveAt?: string | null;
    hasProducts: boolean;
    hasSale: boolean;
    /** houve contagem nos últimos `countEveryDays` dias? (null = não se sabe — não lembra) */
    countedRecently: boolean | null;
    countEveryDays?: number | null;
    /** false = pediu para não receber dicas */
    tipsAllowed: boolean;
    /** chave → ISO da última vez que foi enviado */
    sent: Record<string, string>;
};

export type Followup = { type: FollowupType; kind: FollowupKind; key: string };

const valid = (iso?: string | null) => { if (!iso) return null; const d = new Date(iso); return isNaN(d.getTime()) ? null : d; };
/** Dia de calendário de Maputo (UTC+2), para contas de "faltam N dias". */
const mzDay = (d: Date) => Math.floor((d.getTime() + 2 * 3600_000) / DAY);
const dayKey = (d: Date) => new Date(d.getTime() + 2 * 3600_000).toISOString().slice(0, 10);
const daysBetween = (from: Date, to: Date) => mzDay(to) - mzDay(from);

export const countEvery = (n?: number | null) => {
    const v = Math.round(Number(n));
    return Number.isFinite(v) && v >= 7 && v <= 180 ? v : DEFAULT_COUNT_EVERY_DAYS;
};

/**
 * Último uso real: o mais recente entre o "abri a app" (/api/activity) e o trabalho registado (vendas, movimentos de
 * stock). Quem trabalha sem internet só avisa o servidor quando a ligação volta, mas as vendas feitas offline trazem a
 * data em que foram feitas — assim não recebe "está tudo bem?" por engano. Sem nenhum "abri a app" registado (contas
 * antigas) continua sem data: a falta de uso só conta a partir do primeiro registo.
 */
export function latestActivity(lastActiveAt: string | null | undefined, work: (string | null | undefined)[], now = new Date()): string | null {
    const base = valid(lastActiveAt);
    if (!base) return null;
    let best = base;
    for (const w of work) {
        const d = valid(w);
        // datas no futuro (relógio do telemóvel adiantado) não contam
        if (d && d > best && d.getTime() <= now.getTime() + 3600_000) best = d;
    }
    return best.toISOString();
}

/** Enviados nos últimos 7 dias / nas últimas 20 h (limites de frequência). */
function recentCount(sent: Record<string, string>, now: Date, ms: number) {
    return Object.values(sent).filter((iso) => { const d = valid(iso); return !!d && now.getTime() - d.getTime() < ms; }).length;
}

/** O próximo email para esta empresa (ou null). Prazos primeiro; depois primeiros passos, falta de uso e contagem. */
export function nextFollowup(f: CompanyFacts, now = new Date()): Followup | null {
    if (recentCount(f.sent, now, 20 * 3600_000) > 0) return null; // no máximo 1 por dia
    const weekFull = recentCount(f.sent, now, 7 * DAY) >= MAX_PER_WEEK;
    const status = f.status || 'active';
    if (status === 'suspended' || status === 'inactive') return null;

    const candidates: Followup[] = [];
    const add = (type: FollowupType, kind: FollowupKind, key: string) => { if (!f.sent[key]) candidates.push({ type, kind, key }); };

    // ---------- prazos da conta ----------
    let accountDead = false; // conta acabada há muito: só os avisos de fim, nada de dicas
    if (status === 'trial') {
        const end = valid(f.trialEndsAt);
        if (end) {
            const left = daysBetween(now, end);
            const k = dayKey(end);
            if (now <= end && left >= 1 && left <= 3) add('trial-3d', 'account', `trial-3d:${k}`);
            if (now <= end && left === 0) add('trial-last', 'account', `trial-last:${k}`);
            if (now > end && -left <= 7) add('trial-ended', 'account', `trial-ended:${k}`);
            if (now > end && -left > 14) accountDead = true;
        }
    } else {
        const end = valid(f.subscriptionEndsAt);
        if (end) {
            const left = daysBetween(now, end);
            const k = dayKey(end);
            if (now <= end && left >= 0 && left <= 3) add('sub-3d', 'account', `sub-3d:${k}`);
            if (now > end && now.getTime() <= end.getTime() + (GRACE_DAYS + 5) * DAY) add('sub-ended', 'account', `sub-ended:${k}`);
            if (now.getTime() > end.getTime() + 14 * DAY) accountDead = true;
        }
    }

    // ---------- dicas ----------
    if (f.tipsAllowed && !accountDead) {
        const started = valid(f.startedAt);
        const age = started ? daysBetween(started, now) : null;
        if (age != null && age >= 2 && !f.hasProducts) add('start-products', 'tips', 'start-products');
        if (age != null && age >= 3 && f.hasProducts && !f.hasSale) add('start-sale', 'tips', 'start-sale');

        // só com o último acesso registado (/api/activity): as contas antigas, sem ele, não recebem "sentimos a sua falta"
        // no primeiro dia — começa a contar quando abrirem a app.
        const last = valid(f.lastActiveAt);
        if (last) {
            const idle = daysBetween(last, now);
            const k = dayKey(last);
            if (idle >= 14) add('inactive-14', 'tips', `inactive-14:${k}`);
            else if (idle >= 5) add('inactive-5', 'tips', `inactive-5:${k}`);
        }

        // contagem: só para quem usa a app (quem está parado recebe o "está tudo bem?") e já tem produtos
        const every = countEvery(f.countEveryDays);
        const lastCountReminder = valid(f.sent.count);
        const activeRecently = last ? daysBetween(last, now) < 5 : false;
        if (f.hasProducts && f.countedRecently === false && activeRecently && (age == null || age >= every)
            && (!lastCountReminder || daysBetween(lastCountReminder, now) >= every)) {
            candidates.push({ type: 'count', kind: 'tips', key: 'count' });
        }
    }

    const account = candidates.find((c) => c.kind === 'account');
    if (account) return account; // os prazos passam à frente do limite semanal
    if (weekFull) return null;
    return candidates[0] || null;
}

// ---------------------------------------------------------------- textos

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export type EmailContext = {
    company: string;
    name?: string | null;
    appUrl: string;
    whatsappUrl: string;
    /** link de "não quero receber dicas" (só nas dicas) */
    unsubscribeUrl?: string | null;
    trialEndsAt?: string | null;
    subscriptionEndsAt?: string | null;
    countEveryDays?: number | null;
};

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', timeZone: 'Africa/Maputo' }) : '');

type Body = { subject: string; title: string; paragraphs: string[]; button: { label: string; path: string } };

function body(f: Followup, c: EmailContext): Body {
    const every = countEvery(c.countEveryDays);
    switch (f.type) {
        case 'trial-3d': return {
            subject: `O seu teste do MajorStockX acaba em breve`,
            title: 'O teste gratuito está a acabar',
            paragraphs: [`O período de teste de <b>${esc(c.company)}</b> termina a <b>${fmtDate(c.trialEndsAt)}</b>.`, 'Para continuar a vender e a controlar o stock sem interrupções, escolha um plano. Os seus dados ficam todos guardados.'],
            button: { label: 'Ver planos', path: '/billing' },
        };
        case 'trial-last': return {
            subject: 'Hoje é o último dia do seu teste do MajorStockX',
            title: 'Último dia do teste',
            paragraphs: [`O teste de <b>${esc(c.company)}</b> termina hoje.`, 'Subscreva para não perder o acesso — pode pagar por M-Pesa, e-Mola ou cartão. Nada do que registou se perde.'],
            button: { label: 'Subscrever agora', path: '/billing' },
        };
        case 'trial-ended': return {
            subject: 'O seu teste do MajorStockX terminou — os dados continuam guardados',
            title: 'O teste terminou',
            paragraphs: [`O teste de <b>${esc(c.company)}</b> terminou. A conta fica só de leitura, mas <b>nada foi apagado</b>.`, 'Assim que subscrever, volta a vender e a registar stock exactamente onde ficou.'],
            button: { label: 'Reactivar a conta', path: '/billing' },
        };
        case 'sub-3d': return {
            subject: 'A sua subscrição do MajorStockX está a acabar',
            title: 'A subscrição está a acabar',
            paragraphs: [`A subscrição de <b>${esc(c.company)}</b> termina a <b>${fmtDate(c.subscriptionEndsAt)}</b>.`, 'Renove antes do fim para não haver interrupções — pagar antes não perde dias.'],
            button: { label: 'Renovar', path: '/billing' },
        };
        case 'sub-ended': return {
            subject: 'A sua subscrição do MajorStockX terminou',
            title: 'A subscrição terminou',
            paragraphs: [`A subscrição de <b>${esc(c.company)}</b> terminou. Tem ${GRACE_DAYS} dias de tolerância; depois a conta fica só de leitura (nada é apagado).`],
            button: { label: 'Renovar agora', path: '/billing' },
        };
        case 'start-products': return {
            subject: 'Vamos pôr os seus produtos no MajorStockX? Leva 2 minutos',
            title: 'Primeiro passo: os seus produtos',
            paragraphs: ['Vimos que ainda não adicionou produtos. É o primeiro passo — depois disso já pode vender e ver o stock a mexer sozinho.', 'Dica: no <b>Stock Rápido</b> escreve o nome, o preço e a quantidade de cada produto, um a seguir ao outro.'],
            button: { label: 'Adicionar produtos', path: '/inventory/quick?modo=entrada' },
        };
        case 'start-sale': return {
            subject: 'Faça a primeira venda no MajorStockX em 1 minuto',
            title: 'Já tem produtos — falta a primeira venda',
            paragraphs: ['Na <b>Venda Rápida</b> escolhe o produto, a quantidade e a forma de pagamento. O stock desce sozinho e o documento (factura ou venda a dinheiro) fica pronto a imprimir ou enviar.', 'Se preferir, experimente primeiro a venda de demonstração — nada é gravado.'],
            button: { label: 'Fazer a primeira venda', path: '/pos' },
        };
        case 'inactive-5': return {
            subject: 'Está tudo bem com o MajorStockX?',
            title: 'Precisa de ajuda?',
            paragraphs: ['Há uns dias que não vemos movimento na sua conta. Se alguma coisa não ficou clara ou não está a funcionar como espera, diga-nos — ajudamos por WhatsApp.', 'Lembre-se: as vendas que não são registadas deixam o stock e os relatórios desactualizados.'],
            button: { label: 'Abrir o MajorStockX', path: '/dashboard' },
        };
        case 'inactive-14': return {
            subject: 'Sentimos a sua falta no MajorStockX',
            title: 'Podemos ajudar?',
            paragraphs: ['Já passaram duas semanas sem usar a app. Se houve alguma dificuldade, conte-nos — muitas vezes resolve-se em 5 minutos.', 'Os seus dados continuam guardados, prontos para quando voltar.'],
            button: { label: 'Voltar ao MajorStockX', path: '/dashboard' },
        };
        case 'count': return {
            subject: 'Hora de contar o stock',
            title: 'Faça a contagem do stock',
            paragraphs: [`Já passaram mais de ${every} dias sem uma contagem. Com o tempo, perdas, enganos e vendas por registar fazem o stock da app afastar-se do que está na prateleira.`, 'Na <b>Contagem</b> só escreve o que conta — a app mostra as diferenças e acerta o stock.'],
            button: { label: 'Fazer a contagem', path: '/inventory/quick?modo=contagem' },
        };
    }
}

/** Assunto e HTML do email (nomes escapados). */
export function followupEmail(f: Followup, c: EmailContext): { subject: string; html: string } {
    const b = body(f, c);
    const hello = c.name ? `Olá, ${esc(c.name.split(' ')[0])}!` : 'Olá!';
    const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background-color: #0f172a; padding: 20px 24px; color: white; font-size: 18px; font-weight: bold;">MajorStockX</div>
  <div style="padding: 24px;">
    <h2 style="margin-top: 0; font-size: 20px; color: #0f172a;">${b.title}</h2>
    <p>${hello}</p>
    ${b.paragraphs.map((p) => `<p>${p}</p>`).join('\n    ')}
    <div style="text-align: center; margin: 28px 0 16px;">
      <a href="${esc(c.appUrl + b.button.path)}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px;">${b.button.label}</a>
    </div>
    <p style="font-size: 14px; color: #64748b;">Dúvidas? Fale connosco pelo <a href="${esc(c.whatsappUrl)}" style="color: #059669;">WhatsApp</a> (só mensagens).</p>
  </div>
  <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
    Recebe este email porque tem uma conta no MajorStockX (${esc(c.company)}).
    ${f.kind === 'tips' && c.unsubscribeUrl ? `<br/><a href="${esc(c.unsubscribeUrl)}" style="color: #94a3b8;">Não quero receber estas dicas</a>` : ''}
  </div>
</div>`;
    return { subject: b.subject, html };
}
