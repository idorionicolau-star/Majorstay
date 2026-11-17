// Relatório do fim do dia: a mesma lógica serve o cron (vercel.json), o botão "Enviar agora" e o registo de execuções.
import { BRAND } from '@/lib/brand';
import { initializeAdmin } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import { formatCurrency } from '@/lib/utils';
import { isCountableSale, saleIncome } from '@/lib/sale-filters';
import { criticalProducts, escapeHtml, reportDayForSlot, isMorningSlot, reportTime, closestReportSlot, saleOnDay, topProducts } from '@/lib/daily-report';

const APP_URL = BRAND.appUrl;
const CRITICAL_SHOWN = 10;

export type CompanyRun = {
    companyId: string;
    companyName: string;
    emails: string[];
    configuredTime: string;
    slot: string;
    status: 'sent' | 'failed' | 'other-slot';
    error?: string;
};
export type EndOfDayRun = { slot: string; day: string; hasApiKey: boolean; results: CompanyRun[]; noReportCompanies: number; sent: number; failed: number };

/** Empresas com relatório ligado, com a hora escolhida e o slot de cron que lhes toca (para diagnóstico). */
export async function listReportCompanies() {
    const db = initializeAdmin().firestore();
    const snap = await db.collection('companies').get();
    const out: { companyId: string; companyName: string; emails: string[]; configuredTime: string; slot: string }[] = [];
    snap.forEach((d) => {
        const s = d.data().notificationSettings;
        const emails: string[] = (Array.isArray(s?.emails) ? s.emails : [])
            .filter((e: { onEndOfDayReport?: boolean; email?: string }) => e.onEndOfDayReport && e.email && e.email.trim() !== '')
            .map((e: { email: string }) => e.email.trim());
        if (!emails.length) return;
        const configuredTime = reportTime(s?.endOfDayTime);
        out.push({ companyId: d.id, companyName: String(d.data().name || d.id), emails, configuredTime, slot: closestReportSlot(configuredTime) });
    });
    return out;
}

/**
 * Envia o relatório. Sem `onlyCompanyId`: as empresas cujo slot é `slot` (o cron). Com `onlyCompanyId`: essa empresa,
 * agora, com as vendas de hoje até este momento (botão "Enviar agora").
 */
export async function runEndOfDay(slot: string, onlyCompanyId?: string): Promise<EndOfDayRun> {
    const db = initializeAdmin().firestore();
    const apiKey = process.env.RESEND_API_KEY;
    const resend = new Resend(apiKey);
    const now = new Date();
    // "Enviar agora" é sempre o dia de hoje até agora, mesmo que seja de manhã
    const daySlot = onlyCompanyId ? '21:30' : slot;
    const { day, startISO, endISO, label: formattedDate } = reportDayForSlot(daySlot, now);
    const morning = isMorningSlot(daySlot);

    const companiesSnapshot = await db.collection('companies').get();
    const jobs: Promise<CompanyRun>[] = [];
    let noReportCompanies = 0;

    companiesSnapshot.forEach((companyDoc) => {
        const companyData = companyDoc.data();
        const settings = companyData.notificationSettings;
        const targetEmails: { email: string }[] = (Array.isArray(settings?.emails) ? settings.emails : [])
            .filter((e: { onEndOfDayReport?: boolean; email?: string }) => e.onEndOfDayReport && e.email && e.email.trim() !== '');
        const companyId = companyDoc.id;
        if (onlyCompanyId && companyId !== onlyCompanyId) return;
        if (!targetEmails.length) { noReportCompanies++; return; }
        const configuredTime = reportTime(settings?.endOfDayTime);
        const info = { companyId, companyName: String(companyData.name || companyId), emails: targetEmails.map((t) => t.email.trim()), configuredTime, slot: closestReportSlot(configuredTime) };
        if (!onlyCompanyId && info.slot !== slot) {
            jobs.push(Promise.resolve({ ...info, status: 'other-slot' as const }));
            return;
        }

        const computeAndSend = async () => {
            // 1. Vendas de hoje (as mesmas contas do Financeiro: isCountableSale + saleIncome)
            const salesSnapshot = await db.collection(`companies/${companyId}/sales`)
                .where('date', '>=', startISO)
                .where('date', '<=', endISO)
                .get();

            let totalSalesCount = 0;
            let totalSalesValue = 0;
            const countable: any[] = [];

            salesSnapshot.forEach(saleDoc => {
                const sale = saleDoc.data();
                if (isCountableSale(sale as any) && saleOnDay(sale.date, day)) {
                    totalSalesCount++;
                    totalSalesValue += saleIncome(sale as any);
                    countable.push(sale);
                }
            });
            const top = topProducts(countable, 3);

            // 2. Stock crítico (o mesmo produto no mesmo local conta uma vez)
            const productsSnapshot = await db.collection(`companies/${companyId}/products`).get();
            const critical = criticalProducts(productsSnapshot.docs.map((d) => d.data() as any), companyData.locations || []);
            const criticalItemsCount = critical.length;

            // 3. Prepare HTML
            const displayName = escapeHtml(companyData.name || BRAND.name);
            const logoUrl = companyData.logoUrl ? escapeHtml(companyData.logoUrl) : '';
            const qty = (n: number, unit?: string) => `${n.toLocaleString('pt-PT')}${unit ? ` ${escapeHtml(unit)}` : ''}`;
            const cell = 'padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 14px;';
            const topHtml = top.length ? `
       <h3 style="font-size: 16px; margin: 24px 0 8px;">🏆 Mais vendidos</h3>
       <table style="width: 100%; border-collapse: collapse;">
         ${top.map((t, i) => `<tr>
           <td style="${cell}">${i + 1}. ${escapeHtml(t.name)}</td>
           <td style="${cell} text-align: right; white-space: nowrap;">${qty(t.quantity, t.unit)}</td>
           <td style="${cell} text-align: right; white-space: nowrap; color: #15803d;">${formatCurrency(t.value)}</td>
         </tr>`).join('')}
       </table>` : '';
            const criticalHtml = critical.length ? `
       <h3 style="font-size: 16px; margin: 24px 0 8px;">⚠️ Stock crítico</h3>
       <table style="width: 100%; border-collapse: collapse;">
         <tr><th style="${cell} text-align: left; color: #64748b; font-weight: normal;">Produto</th><th style="${cell} text-align: right; color: #64748b; font-weight: normal;">Disponível</th><th style="${cell} text-align: right; color: #64748b; font-weight: normal;">Limite</th></tr>
         ${critical.slice(0, CRITICAL_SHOWN).map((c) => `<tr>
           <td style="${cell}">${escapeHtml(c.name)}${c.location ? ` <span style="color: #94a3b8;">· ${escapeHtml(c.location)}</span>` : ''}</td>
           <td style="${cell} text-align: right; white-space: nowrap; font-weight: bold; color: #b91c1c;">${qty(c.available, c.unit)}</td>
           <td style="${cell} text-align: right; white-space: nowrap; color: #64748b;">${qty(c.threshold, c.unit)}</td>
         </tr>`).join('')}
       </table>
       ${critical.length > CRITICAL_SHOWN ? `<p style="font-size: 13px; color: #64748b; margin: 6px 0 0;">e mais ${critical.length - CRITICAL_SHOWN} produto${critical.length - CRITICAL_SHOWN === 1 ? '' : 's'} no painel.</p>` : ''}` : '';
            const logoHtml = logoUrl
                ? `<img src="${logoUrl}" alt="${displayName}" style="max-height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 8px;" /><br/>`
                : '';

            const headerHtml = `
       <div style="background-color: #0f172a; padding: 24px; text-align: center;">
         ${logoHtml}
         <h1 style="color: white; margin: 0; font-size: 20px; font-weight: bold;">${displayName}</h1>
       </div>
     `;
            const footerHtml = `
       <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
         &copy; ${now.getFullYear()} ${BRAND.name}
       </div>
   `;

            const color = '#f59e0b'; // Amber
            const accentColor = '#fffbeb';

            const htmlContent = `
     ${headerHtml}
     <div style="padding: 24px;">
       <h2 style="color: ${color}; font-size: 22px; margin-top: 0;">
         📊 Relatório de Fecho do Dia
       </h2>
       <p>Olá,</p>
       <p>Aqui está o resumo das atividades da sua empresa no dia <strong>${formattedDate}</strong> ${morning ? '(dia completo)' : `(até às ${new Date(now.getTime() + 2 * 3600_000).toISOString().slice(11, 16)})`}:</p>
       
       <div style="background-color: ${accentColor}; border: 1px solid ${color}; padding: 16px; border-radius: 8px; margin: 20px 0;">
         <p style="margin: 4px 0; font-size: 16px;"><strong>Vendas Realizadas:</strong> ${totalSalesCount}</p>
         <p style="margin: 4px 0; font-size: 16px;"><strong>Valor Total de Vendas:</strong> <span style="font-weight: bold; color: #15803d;">${formatCurrency(totalSalesValue)}</span></p>
         <p style="margin: 4px 0; font-size: 16px;"><strong>Produtos em Stock Crítico:</strong> <span style="font-weight: bold; color: #b91c1c;">${criticalItemsCount}</span></p>
       </div>
 
       ${topHtml}
       ${criticalHtml}

       <div style="text-align: center; margin: 28px 0 8px;">
         <a href="${APP_URL}/dashboard" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px;">Abrir ${BRAND.name}</a>
       </div>
     </div>
     ${footerHtml}
 `;

            const finalHtml = `
   <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
     ${htmlContent}
   </div>
 `;

            const toEmails = targetEmails.map((t) => t.email);
            const r = await resend.emails.send({
                from: 'Major Assistant <assistant@majorgroup.app>',
                to: toEmails,
                subject: `📊 Relatório Diário - ${displayName}`,
                html: finalHtml,
            });
            if (r?.error) throw new Error(r.error.message || String(r.error));
        };

        jobs.push(computeAndSend().then(
            (): CompanyRun => ({ ...info, status: 'sent' }),
            (e: unknown): CompanyRun => {
                const error = String((e as Error)?.message || e).slice(0, 300);
                console.error('[end-of-day] email não enviado:', companyId, error);
                return { ...info, status: 'failed', error };
            },
        ));
    });

    const results = await Promise.all(jobs);
    if (!apiKey) console.error('[end-of-day] RESEND_API_KEY não está configurada: nenhum relatório é enviado.');
    return {
        slot, day, hasApiKey: !!apiKey, results, noReportCompanies,
        sent: results.filter((r) => r.status === 'sent').length,
        failed: results.filter((r) => r.status === 'failed').length,
    };
}
