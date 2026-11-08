export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { isCronRequest } from '@/lib/cron-auth';
import { initializeAdmin } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import { formatCurrency } from '@/lib/utils';
import { isCountableSale, saleIncome } from '@/lib/sale-filters';
import { criticalProducts, escapeHtml, reportDay, reportTime, saleOnDay, topProducts } from '@/lib/daily-report';
import { runFollowups } from '@/lib/followups-run';

const APP_URL = 'https://stock.majorgroup.app';
const CRITICAL_SHOWN = 10;

export async function GET(req: Request) {
    if (!isCronRequest(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const adminApp = initializeAdmin();
        const db = adminApp.firestore();
        const apiKey = process.env.RESEND_API_KEY;
        const resend = new Resend(apiKey);

        // Cada hora possível tem o seu cron (vercel.json): este envia só às empresas que escolheram esta hora
        const slot = reportTime(new URL(req.url).searchParams.get('slot'));

        // O dia de hoje em Maputo, da meia-noite até agora — igual ao "Hoje" do Financeiro
        const now = new Date();
        const { day, startISO, endISO, label: formattedDate } = reportDay(now);

        // Fetch all companies
        const companiesSnapshot = await db.collection('companies').get();

        const emailsPromises: Promise<any>[] = [];

        companiesSnapshot.forEach((companyDoc) => {
            const companyData = companyDoc.data();
            const settings = companyData.notificationSettings;

            const targetEmails: any[] = [];
            if (settings?.emails && Array.isArray(settings.emails)) {
                targetEmails.push(...settings.emails.filter((e: any) => e.onEndOfDayReport && e.email && e.email.trim() !== ''));
            }

            if (targetEmails.length > 0 && reportTime(settings?.endOfDayTime) === slot) {
                // We need to fetch stats for this company
                const companyId = companyDoc.id;

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
                    const displayName = escapeHtml(companyData.name || 'MajorStockX');
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
                 &copy; ${now.getFullYear()} MajorStockX
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
               <p>Aqui está o resumo das atividades da sua empresa no dia <strong>${formattedDate}</strong> (até às ${new Date(now.getTime() + 2 * 3600_000).toISOString().slice(11, 16)}):</p>
               
               <div style="background-color: ${accentColor}; border: 1px solid ${color}; padding: 16px; border-radius: 8px; margin: 20px 0;">
                 <p style="margin: 4px 0; font-size: 16px;"><strong>Vendas Realizadas:</strong> ${totalSalesCount}</p>
                 <p style="margin: 4px 0; font-size: 16px;"><strong>Valor Total de Vendas:</strong> <span style="font-weight: bold; color: #15803d;">${formatCurrency(totalSalesValue)}</span></p>
                 <p style="margin: 4px 0; font-size: 16px;"><strong>Produtos em Stock Crítico:</strong> <span style="font-weight: bold; color: #b91c1c;">${criticalItemsCount}</span></p>
               </div>
 
               ${topHtml}
               ${criticalHtml}

               <div style="text-align: center; margin: 28px 0 8px;">
                 <a href="${APP_URL}/dashboard" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px;">Abrir MajorStockX</a>
               </div>
             </div>
             ${footerHtml}
         `;

                    const finalHtml = `
           <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
             ${htmlContent}
           </div>
         `;

                    const toEmails = targetEmails.map((t: any) => t.email);

                    return resend.emails.send({
                        from: 'Major Assistant <assistant@majorgroup.app>',
                        to: toEmails,
                        subject: `📊 Relatório Diário - ${displayName}`,
                        html: finalHtml,
                    });
                };

                emailsPromises.push(computeAndSend());
            }
        });

        await Promise.allSettled(emailsPromises);

        // os emails de acompanhamento saem uma vez por dia, no envio das 18h30 (a hora de sempre)
        let followups: unknown = null;
        if (slot === '18:30') {
            try { followups = await runFollowups(); } catch (e) { console.error('followups', e); }
        }

        return NextResponse.json({ success: true, message: "End of day reports generated and dispatched", slot, sent: emailsPromises.length, followups });
    } catch (error: any) {
        console.error('Error executing End-of-Day cron:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
