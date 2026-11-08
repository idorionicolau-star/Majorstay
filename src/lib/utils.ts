import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Sale, Company } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  if (maxLength === 0) return 1.0;

  return 1.0 - (distance / maxLength);
}

export function formatCompactNumber(value: number) {
  // negativos (ex.: prejuízo) também ficam curtos: "-2,5M"
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('pt-MZ', { maximumFractionDigits: 1 })}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString('pt-MZ', { maximumFractionDigits: 1 })}k`;
  }
  return value.toLocaleString('pt-MZ', { maximumFractionDigits: 2 });
}

export function formatCurrency(value: number, options?: Intl.NumberFormatOptions & { compact?: boolean }) {
  if (options?.compact) {
    return `${formatCompactNumber(value)} MTn`;
  }

  return new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: 'MZN',
    ...options
  }).format(value);
}

/**
 * Valor para um cartão estreito: num telemóvel o cartão tem pouco mais de 140 px e "1 265 216 537,00 MZN" saía
 * por fora. A partir de um milhão usa o formato curto do painel ("110M MTn"); o valor exacto vai no `title`.
 */
export function formatCardMoney(value: number) {
  return Math.abs(value) >= 1_000_000 ? formatCurrency(value, { compact: true }) : formatCurrency(value);
}

/** Letra mais pequena para os valores compridos (ex.: "999 999,00 MZN"), para caberem numa linha do cartão. */
export function cardMoneySize(text: string) {
  return text.length <= 11 ? "text-xl md:text-2xl" : text.length <= 14 ? "text-lg md:text-xl" : "text-base md:text-lg";
}

/** "1 venda", "3 vendas" */
export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Dias passados em texto: "hoje", "ontem", "há 5 dias". */
export function daysAgo(n: number) {
  if (n <= 0) return "hoje";
  if (n === 1) return "ontem";
  return `há ${n} dias`;
}

export function downloadSaleDocument(saleOrSales: Sale | Sale[], companyData: Company | null) {
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) return;

  const salesArray = Array.isArray(saleOrSales) ? saleOrSales : [saleOrSales];
  if (salesArray.length === 0) return;

  const sale = salesArray[0];

  const docTitle = sale.documentType === 'Factura Proforma'
    ? 'Orçamento / Proposta'
    : sale.documentType === 'Cotação' ? 'Cotação / Proposta'
      : sale.documentType === 'Venda a Dinheiro' ? 'Venda a Dinheiro'
        : (sale.documentType === 'Guia de Remessa' ? 'Guia de Remessa' : (sale.documentType === 'Recibo' ? 'Recibo' : 'Factura'));

  const isProforma = sale.documentType === 'Factura Proforma' || sale.documentType === 'Cotação';

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // O botão "Guardar PDF" da janela chama a app para gerar o ficheiro .pdf verdadeiro
  // (antes só abria a janela de impressão).
  (window as any).__msxSaleDocPdf = async () => {
    const { downloadSaleDocumentPDF } = await import('./sale-document-pdf');
    await downloadSaleDocumentPDF(salesArray, companyData);
  };

  printWindow.document.write(`
    <html>
      <head>
        <title>${docTitle} - ${sale.guideNumber}</title>
        <style>
          :root { --background: #ffffff; --foreground: #09090b; --primary: #000000; --muted: #f4f4f5; --border: #e4e4e7; --muted-foreground: #71717a; }
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            background-color: #f7f7f8; 
            margin: 0; 
            padding: 2rem; 
            color: var(--foreground); 
            line-height: 1.5; 
          }
          .wrapper { 
            max-width: 800px; 
            margin: 0 auto; 
            background: var(--background); 
            padding: 3rem; 
            border: 1px solid var(--border); 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); 
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 3rem; 
            padding-bottom: 2rem; 
            border-bottom: 2px solid var(--primary); 
          }
          .logo { display: flex; flex-direction: column; gap: 0.5rem; }
          .logo-img { max-height: 60px; object-fit: contain; }
          .logo-text { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; }
          .doc-type { text-align: right; }
          .doc-type h1 { margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; text-transform: uppercase; color: var(--primary); }
          .doc-type p { margin: 0.5rem 0 0 0; font-size: 1.25rem; color: var(--muted-foreground); font-weight: 500; }
          .details-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 2rem; 
            margin-bottom: 3rem; 
          }
          .details-box { 
            background: #fafafa; 
            padding: 1.5rem; 
            border-radius: 8px; 
            border: 1px solid var(--border); 
          }
          .details-box h3 { 
            margin-top: 0; 
            margin-bottom: 1rem; 
            font-size: 0.875rem; 
            text-transform: uppercase; 
            letter-spacing: 0.05em; 
            color: var(--muted-foreground); 
            border-bottom: 1px solid var(--border); 
            padding-bottom: 0.5rem; 
          }
          .details-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 0.5rem; 
            font-size: 0.9375rem; 
          }
          .details-row span:first-child { color: #52525b; }
          .details-row span:last-child { font-weight: 500; color: var(--foreground); text-align: right; }
          table { 
            width: 100%; 
            border-collapse: separate; 
            border-spacing: 0; 
            margin-bottom: 3rem; 
          }
          th { 
            background-color: var(--muted); 
            color: #52525b; 
            font-weight: 600; 
            text-transform: uppercase; 
            font-size: 0.75rem; 
            letter-spacing: 0.05em; 
            padding: 1rem; 
            text-align: left; 
            border-top: 1px solid var(--border); 
            border-bottom: 1px solid var(--border); 
          }
          th:first-child { border-left: 1px solid var(--border); border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
          th:last-child { border-right: 1px solid var(--border); border-top-right-radius: 6px; border-bottom-right-radius: 6px; text-align: right; }
          th:nth-child(2), th:nth-child(3) { text-align: right; }
          td { 
            padding: 1rem; 
            border-bottom: 1px solid var(--muted); 
            font-size: 0.9375rem; 
            color: #3f3f46; 
          }
          td:last-child { text-align: right; font-weight: 500; }
          td:nth-child(2), td:nth-child(3) { text-align: right; }
          .totals-wrapper { display: flex; justify-content: flex-end; }
          .totals-table { width: 320px; border-collapse: collapse; margin-bottom: 0; }
          .totals-table td { padding: 0.75rem 0; text-align: right; border-bottom: 1px solid var(--muted); font-size: 0.9375rem; }
          .totals-table td:first-child { text-align: left; color: #52525b; border-bottom: 1px solid var(--muted); }
          .totals-table tr:last-child td { border-bottom: none; }
          .final-total td { font-size: 1.25rem; font-weight: 600; color: var(--foreground); border-top: 2px solid var(--primary); padding-top: 1rem; border-bottom: none !important; }
          .signatures { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 4rem; 
            margin-top: 4rem; 
            margin-bottom: 2rem; 
          }
          .signature-box { text-align: center; }
          .signature-image { max-height: 80px; object-fit: contain; margin-bottom: 0.5rem; }
          .signature-line { border-bottom: 1px solid var(--border); margin-bottom: 0.5rem; height: 40px; }
          .signature-label { font-size: 0.875rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; }
          .payment-info { margin-top: 1rem; padding: 1.5rem; background: #fafafa; border-radius: 8px; border: 1px solid var(--border); font-size: 0.875rem; color: #52525b; line-height: 1.6; }
          .payment-info strong { color: var(--foreground); display: block; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem; }
          .footer { 
            text-align: center; 
            font-size: 0.875rem; 
            color: var(--muted-foreground); 
            border-top: 1px solid var(--border); 
            padding-top: 2rem; 
            margin-top: 2rem; 
          }
          .badge-proforma {
            display: inline-block;
            background-color: #fef08a;
            color: #854d0e;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 1rem;
          }
          .actions-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #fff;
            border-top: 1px solid var(--border);
            padding: 1rem 2rem;
            display: flex;
            justify-content: center;
            gap: 1rem;
            z-index: 100;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.08);
          }
          .actions-bar button {
            padding: 0.75rem 2rem;
            border-radius: 8px;
            font-size: 0.9375rem;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.15s ease;
          }
          .btn-print {
            background: var(--primary);
            color: #fff;
          }
          .btn-print:hover { opacity: 0.9; }
          .btn-pdf {
            background: var(--muted);
            color: var(--foreground);
            border: 1px solid var(--border) !important;
          }
          .btn-pdf:hover { background: #e4e4e7; }
          @media print {
            body { margin: 0; background-color: white; }
            .wrapper { margin: 0; padding: 0; border: none; box-shadow: none; max-width: 100%; }
            .actions-bar { display: none !important; }
          }
      </style>
  `);
  printWindow.document.write('</head><body><div class="wrapper">');

  printWindow.document.write(`
      <div class="header">
           <div class="logo">
              ${companyData?.logoUrl ? `<img src="${companyData.logoUrl}" class="logo-img" alt="Logo" />` : ''}
              <span class="logo-text">${companyData?.name || 'MajorStockX'}</span>
          </div>
          <div class="doc-type">
              ${isProforma ? '<div class="badge-proforma">Orçamento / Proposta</div>' : ''}
              <h1>${docTitle}</h1>
              <p>N.º ${sale.guideNumber}</p>
          </div>
      </div>
  `);

  printWindow.document.write(`
      <div class="details-grid">
          <div class="details-box">
            <h3>Detalhes da Emissão</h3>
            <div class="details-row"><span>Data:</span> <span>${new Date(sale.date).toLocaleDateString('pt-BR')}</span></div>
            ${sale.paymentMethod && !isProforma ? `<div class="details-row"><span>Pagamento:</span> <span>${sale.paymentMethod}</span></div>` : ''}
            <div class="details-row"><span>Operador:</span> <span>${sale.soldBy}</span></div>
          </div>
          <div class="details-box">
            <h3>Cliente</h3>
            <div class="details-row"><span>Nome:</span> <span>${sale.clientName || 'Consumidor Final'}</span></div>
            ${sale.customerId ? `<div class="details-row"><span>Cod.:</span> <span>${sale.customerId}</span></div>` : ''}
          </div>
      </div>
  `);

  printWindow.document.write('<table><thead><tr><th>Artigo / Descrição</th><th>Qtd.</th><th>Preço Unit.</th><th>Subtotal</th></tr></thead><tbody>');

  let totalSubtotals = 0;
  let totalDiscounts = 0;
  let totalVats = 0;
  let totalFinalValue = 0;

  salesArray.forEach(s => {
    printWindow.document.write(`<tr><td>${s.productName}</td><td>${s.quantity} ${s.unit || 'un'}</td><td>${formatCurrency(s.unitPrice)}</td><td>${formatCurrency(s.subtotal)}</td></tr>`);
    totalSubtotals += s.subtotal;
    totalDiscounts += s.discount || 0;
    totalVats += s.vat || 0;
  });

  totalFinalValue = totalSubtotals - totalDiscounts + totalVats;

  printWindow.document.write('</tbody></table>');

  let totalsHtml = '<div class="totals-wrapper"><table class="totals-table">';
  totalsHtml += `<tr><td>Subtotal:</td><td>${formatCurrency(totalSubtotals)}</td></tr>`;
  if (totalDiscounts > 0) {
    totalsHtml += `<tr><td>Desconto:</td><td>-${formatCurrency(totalDiscounts)}</td></tr>`;
  }
  if (totalVats > 0) {
    totalsHtml += `<tr><td>IVA:</td><td>${formatCurrency(totalVats)}</td></tr>`;
  }
  totalsHtml += `<tr class="final-total"><td>Total a Pagar:</td><td>${formatCurrency(totalFinalValue)}</td></tr>`;
  totalsHtml += '</table></div>';
  printWindow.document.write(totalsHtml);

  if (companyData?.paymentInfo) {
    const formattedPaymentInfo = companyData.paymentInfo.replace(/\n/g, '<br/>');
    printWindow.document.write(`
      <div class="payment-info">
        <strong>Informações de Pagamento</strong>
        ${formattedPaymentInfo}
      </div>
    `);
  }

  printWindow.document.write(`
    <div class="signatures">
        <div class="signature-box">
            ${companyData?.signatureUrl ? `<img src="${companyData.signatureUrl}" class="signature-image" alt="Assinatura" />` : '<div class="signature-line"></div>'}
            <span class="signature-label">A Empresa</span>
        </div>
        ${companyData?.documentShowClientSignature ? `<div class="signature-box">
            <div class="signature-line"></div>
            <span class="signature-label">O Cliente</span>
        </div>` : ''}
    </div>
  `);

  printWindow.document.write(`<div class="footer"><p>${companyData?.name || 'MajorStockX'} &copy; ${new Date().getFullYear()} &bull; Processado por Software</p></div>`);
  printWindow.document.write('</div>');

  // Action buttons (hidden during print)
  printWindow.document.write(`
    <div class="actions-bar">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir</button>
      <button class="btn-pdf" onclick="var o=window.opener; if (o && o.__msxSaleDocPdf) { this.disabled=true; this.textContent='A gerar PDF…'; var b=this; o.__msxSaleDocPdf().then(function(){ b.textContent='✓ PDF descarregado'; }).catch(function(){ b.disabled=false; b.textContent='📄 Descarregar PDF'; alert('Não foi possível gerar o PDF.'); }); } else { window.print(); }">📄 Descarregar PDF</button>
    </div>
  `);

  printWindow.document.write('</body></html>');
  printWindow.document.close();
}
