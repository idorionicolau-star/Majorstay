
export const dynamic = 'force-dynamic';

import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { formatCurrency } from '@/lib/utils';
import { initializeAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { cleanSubject, EMAIL_DAILY_LIMIT, escapeAll, escapeHtml, normEmail, notAllowed, parseRecipients, safeImageUrl } from '@/lib/email-guard';

export async function POST(req: Request) {
  // 1. Verificação de Segurança
  const decodedToken = await verifyIdToken(req);
  if (!decodedToken) {
    return NextResponse.json({ error: "Não autorizado. Token inválido ou ausente." }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;

  const resend = new Resend(apiKey);

  const raw = await req.json().catch(() => ({}));
  const { to, type, companyId } = raw;

  // 1.5 Tenant Isolation Check
  if (!decodedToken.superAdmin && (!companyId || typeof companyId !== 'string' || companyId !== (decodedToken as any).companyId)) {
    return NextResponse.json({ error: "Acesso negado. Tentativa de envio de e-mail por outra empresa." }, { status: 403 });
  }

  // 1.6 Só para endereços da empresa (avisos, equipa, quem está a enviar) ou, num recibo, para um cliente dela.
  // Antes qualquer conta podia enviar, em nome da MajorStockX, para qualquer endereço.
  const recipients = parseRecipients(to);
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Nenhum destinatário válido fornecido.' }, { status: 400 });
  }
  const db = initializeAdmin().firestore();
  if (!decodedToken.superAdmin) {
    const company = (await db.doc(`companies/${companyId}`).get()).data() || {};
    const employees = await db.collection(`companies/${companyId}/employees`).select('email').get();
    const allowed = new Set<string>([
      ...(company.email ? [company.email] : []),
      ...((company.notificationSettings?.emails || []) as { email?: string }[]).map((e) => e?.email || '').filter(Boolean),
      ...(company.notificationSettings?.email ? [company.notificationSettings.email] : []),
      ...employees.docs.map((d) => String(d.get('email') || '')).filter(Boolean),
      ...(decodedToken.email ? [decodedToken.email] : []),
    ].map(normEmail));
    if (type === 'RECEIPT') {
      for (const r of recipients.slice(0, 10)) {
        const c = await db.collection(`companies/${companyId}/customers`).where('email', '==', r).limit(1).get();
        if (!c.empty) allowed.add(r);
      }
    }
    const refused = notAllowed(recipients, allowed);
    if (refused.length) {
      return NextResponse.json({ error: 'Só é possível enviar para os emails da empresa ou dos seus clientes.' }, { status: 403 });
    }

    // 1.7 Limite diário por empresa
    const quotaRef = db.doc(`emailQuota/${companyId}_${new Date().toISOString().slice(0, 10)}`);
    const okQuota = await db.runTransaction(async (tx) => {
      const used = Number((await tx.get(quotaRef)).get('count')) || 0;
      if (used + recipients.length > EMAIL_DAILY_LIMIT) return false;
      tx.set(quotaRef, { companyId, count: used + recipients.length, updatedAt: new Date().toISOString() }, { merge: true });
      return true;
    });
    if (!okQuota) return NextResponse.json({ error: 'Limite diário de emails atingido. Tente amanhã.' }, { status: 429 });
  }

  // 1.8 Tudo o que vem do navegador é texto (nunca HTML); o logótipo só por https
  const body = escapeAll(raw);
  const subject = cleanSubject(raw.subject, 'MajorStockX');
  const logoUrl = escapeHtml(safeImageUrl(raw.logoUrl));
  const { companyName } = body;

  try {
    let htmlContent = '';

    const displayName = companyName || 'MajorStockX';
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
          &copy; ${new Date().getFullYear()} MajorStockX
        </div>
    `;

    if (type === 'CRITICAL') {
      const { productName, quantity, location, threshold } = body;
      const color = '#ef4444';
      const accentColor = '#fef2f2';
      htmlContent = `
            ${headerHtml}
            <div style="padding: 24px;">
              <h2 style="color: ${color}; font-size: 22px; margin-top: 0;">
                ⚠️ Alerta de Stock Crítico
              </h2>
              <p>Olá,</p>
              <p>O sistema registou uma atualização importante no seu inventário:</p>
              <div style="background-color: ${accentColor}; border: 1px solid ${color}; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 16px;"><strong>Produto:</strong> ${productName}</p>
                <p style="margin: 4px 0; font-size: 16px;"><strong>Localização:</strong> ${location}</p>
                <p style="margin: 4px 0; font-size: 16px;"><strong>Quantidade Atual:</strong> <span style="font-size: 20px; font-weight: bold; color: ${color};">${quantity}</span></p>
                <p style="margin: 4px 0; font-size: 16px;"><strong>Limite Crítico:</strong> ${threshold}</p>
              </div>
              <p style="font-size: 14px; color: #64748b;">Este é um e-mail automático enviado pelo seu Sistema de Gestão de Inventário, MajorStockX.</p>
            </div>
            ${footerHtml}
        `;
    } else if (type === 'SALE') {
      const { productName, quantity, location, guideNumber, totalValue, soldBy, items } = body;
      const color = '#3b82f6';
      // venda com vários produtos: a lista toda (antes só o primeiro)
      const lines: any[] = Array.isArray(items) ? items : [];
      const productsHtml = lines.length > 1
        ? `<p style="margin: 4px 0; font-size: 16px;"><strong>Produtos (${lines.length}):</strong></p>
           <table style="width: 100%; border-collapse: collapse; margin: 4px 0 8px;">${lines.map((l) => `
             <tr><td style="padding: 4px 0; border-bottom: 1px solid #dbeafe;">${l.productName}</td>
             <td style="padding: 4px 0; border-bottom: 1px solid #dbeafe; text-align: right; white-space: nowrap;">${l.quantity}${l.unit ? ` ${l.unit}` : ''}</td>
             <td style="padding: 4px 0 4px 12px; border-bottom: 1px solid #dbeafe; text-align: right; white-space: nowrap;">${formatCurrency(Number(l.subtotal) || 0)}</td></tr>`).join('')}
           </table>`
        : `<p style="margin: 4px 0; font-size: 16px;"><strong>Produto:</strong> ${productName}</p>
           <p style="margin: 4px 0; font-size: 16px;"><strong>Quantidade:</strong> ${quantity}</p>`;
      const accentColor = '#eff6ff';
      htmlContent = `
            ${headerHtml}
            <div style="padding: 24px;">
              <h2 style="color: ${color}; font-size: 22px; margin-top: 0;">
                ✅ Nova Venda Registada
              </h2>
              <p>Olá,</p>
              <p>Uma nova venda foi registada com sucesso no sistema:</p>
              <div style="background-color: ${accentColor}; border: 1px solid ${color}; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 16px;"><strong>Guia N.º:</strong> ${guideNumber}</p>
                ${productsHtml}
                <p style="margin: 4px 0; font-size: 16px;"><strong>Valor Total:</strong> <span style="font-weight: bold;">${formatCurrency(totalValue)}</span></p>
                <p style="margin: 4px 0; font-size: 16px;"><strong>Localização:</strong> ${location}</p>
                <p style="margin: 4px 0; font-size: 16px;"><strong>Vendedor:</strong> ${soldBy}</p>
              </div>
              <p style="font-size: 14px; color: #64748b;">Este é um e-mail automático enviado pelo seu Sistema de Gestão de Inventário, MajorStockX.</p>
            </div>
            ${footerHtml}
        `;
    } else if (type === 'WELCOME') {
      const { companyName } = body;
      const color = '#10b981'; // Emerald
      const accentColor = '#ecfdf5';
      htmlContent = `
            ${headerHtml}
            <div style="padding: 24px;">
              <h2 style="color: ${color}; font-size: 22px; margin-top: 0;">
                🎉 Bem-vindo ao MajorStockX!
              </h2>
              <p>Olá,</p>
              <p>A sua conta para a empresa <strong>${companyName}</strong> foi criada com sucesso. Estamos entusiasmados por tê-lo a bordo.</p>
              <div style="background-color: ${accentColor}; border: 1px solid ${color}; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 16px;">Pode agora aceder ao seu dashboard para começar a gerir o seu inventário, vendas e produção.</p>
                <a href="${req.headers.get('origin')}/dashboard" style="display: inline-block; background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px; font-weight: bold;">Aceder ao Dashboard</a>
              </div>
              <p style="font-size: 14px; color: #64748b;">Este é um e-mail automático enviado pelo seu Sistema de Gestão de Inventário, MajorStockX.</p>
            </div>
            ${footerHtml}
        `;
    } else if (type === 'RECEIPT') {
      const { customerName, guideNumber, items, totalValue, date, companyName } = body;
      const color = '#8b5cf6'; // Violet
      const accentColor = '#f5f3ff';
      const itemsHtml = items.map((item: any) => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
          <span>${item.productName} (x${item.quantity})</span>
          <span>${formatCurrency(item.subtotal)}</span>
        </div>
      `).join('');

      htmlContent = `
            ${headerHtml}
            <div style="padding: 24px;">
              <h2 style="color: ${color}; font-size: 22px; margin-top: 0;">
                🧾 Recibo de Venda
              </h2>
              <p>Olá ${customerName || 'Cliente'},</p>
              <p>Obrigado pela sua compra na <strong>${companyName}</strong>. Aqui está o seu recibo:</p>
              
              <div style="background-color: ${accentColor}; border: 1px solid ${color}; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <div style="border-bottom: 2px dashed ${color}; padding-bottom: 10px; margin-bottom: 10px;">
                  <p style="margin: 4px 0;"><strong>Guia N.º:</strong> ${guideNumber}</p>
                  <p style="margin: 4px 0;"><strong>Data:</strong> ${new Date(date).toLocaleDateString('pt-BR')}</p>
                </div>
                ${itemsHtml}
                <div style="margin-top: 10px; padding-top: 10px; border-top: 2px solid ${color}; display: flex; justify-content: space-between; font-weight: bold; font-size: 18px;">
                  <span>Total</span>
                  <span>${formatCurrency(totalValue)}</span>
                </div>
              </div>

              <p style="font-size: 14px; color: #64748b;">Se tiver alguma dúvida, não hesite em contactar-nos.</p>
            </div>
            ${footerHtml}
        `;
    } else if (type === 'END_OF_DAY_REPORT') {
      const {
        totalSales,
        salesValue,
        criticalItemsCount,
        date
      } = body;
      const color = '#f59e0b'; // Amber
      const accentColor = '#fffbeb';

      htmlContent = `
            ${headerHtml}
            <div style="padding: 24px;">
              <h2 style="color: ${color}; font-size: 22px; margin-top: 0;">
                📊 Relatório de Fecho do Dia
              </h2>
              <p>Olá,</p>
              <p>Aqui está o resumo das atividades da sua empresa no dia <strong>${date}</strong>:</p>
              
              <div style="background-color: ${accentColor}; border: 1px solid ${color}; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 16px;"><strong>Vendas Realizadas:</strong> ${totalSales}</p>
                <p style="margin: 4px 0; font-size: 16px;"><strong>Valor Total de Vendas:</strong> <span style="font-weight: bold; color: #15803d;">${formatCurrency(salesValue)}</span></p>
                <p style="margin: 4px 0; font-size: 16px;"><strong>Produtos em Stock Crítico:</strong> <span style="font-weight: bold; color: #b91c1c;">${criticalItemsCount}</span></p>
              </div>

              <p style="font-size: 14px; color: #64748b;">Aceda ao seu painel para ver mais detalhes.</p>
            </div>
            ${footerHtml}
        `;
    } else {
      return NextResponse.json({ error: 'Tipo de e-mail inválido.' }, { status: 400 });
    }

    const finalHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        ${htmlContent}
      </div>
    `;

    const finalTo = recipients;

    const { data, error } = await resend.emails.send({
      from: 'Major Assistant <assistant@majorgroup.app>',
      to: finalTo,
      subject: subject,
      html: finalHtml,
    });

    if (error) {
      console.error('Resend API Error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Internal Server Error:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
