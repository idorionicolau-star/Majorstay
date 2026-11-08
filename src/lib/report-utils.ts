
import { formatCurrency } from "./utils";
import type { Sale, Expense } from "./types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialReportData {
    companyName: string;
    period: string; // e.g. "Fevereiro 2026"
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    sales: Sale[];
    expenses: Expense[];
}

export function printFinancialReport(data: FinancialReportData) {
    const printWindow = window.open('', '', 'height=900,width=800');
    if (!printWindow) return;

    printWindow.document.write('<!DOCTYPE html><html><head><title>Relatório Financeiro</title>');
    printWindow.document.write(`
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
  `);
    printWindow.document.write(`
      <style>
          body { font-family: 'PT Sans', sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 2rem; }
          .container { max-width: 800px; margin: auto; }
          .header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #eee; padding-bottom: 1rem; }
          .header h1 { font-family: 'Space Grotesk', sans-serif; font-size: 2rem; margin: 0; color: #1e293b; }
          .header p { margin: 0.5rem 0 0; color: #64748b; }
          
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
          .summary-card { background: #f8fafc; padding: 1.5rem; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
          .summary-card h3 { margin: 0 0 0.5rem; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
          .summary-card .value { font-size: 1.5rem; font-weight: bold; font-family: 'Space Grotesk', sans-serif; }
          .summary-card.income .value { color: #16a34a; }
          .summary-card.expenses .value { color: #dc2626; }
          .summary-card.profit .value { color: #2563eb; }

          .section { margin-bottom: 2rem; }
          .section h2 { font-family: 'Space Grotesk', sans-serif; font-size: 1.25rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem; color: #334155; }
          
          table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 0.75rem 0.5rem; text-align: left; }
          th { font-weight: bold; color: #475569; background: #f8fafc; }
          td.amount { text-align: right; font-weight: bold; font-family: 'Space Grotesk', sans-serif; }
          td.amount.income { color: #16a34a; }
          td.amount.expense { color: #dc2626; }
          
          .footer { text-align: center; margin-top: 3rem; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #eee; padding-top: 1rem; }
          
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
      </style>
  `);
    printWindow.document.write('</head><body><div class="container">');

    // Header
    printWindow.document.write(`
      <div class="header">
          <h1>Relatório Financeiro</h1>
          <p>${data.companyName} • ${data.period}</p>
      </div>
  `);

    // Summary Cards
    printWindow.document.write(`
      <div class="summary-grid">
          <div class="summary-card income">
              <h3>Entradas</h3>
              <div class="value">${formatCurrency(data.totalIncome)}</div>
          </div>
          <div class="summary-card expenses">
              <h3>Saídas</h3>
              <div class="value">${formatCurrency(data.totalExpenses)}</div>
          </div>
          <div class="summary-card profit">
              <h3>Lucro Líquido</h3>
              <div class="value" style="color: ${data.netProfit >= 0 ? '#16a34a' : '#dc2626'}">${formatCurrency(data.netProfit)}</div>
          </div>
      </div>
  `);

    // Expenses Table
    printWindow.document.write(`
      <div class="section">
          <h2>Despesas do Período</h2>
          <table>
              <thead>
                  <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th style="text-align: right;">Valor</th>
                  </tr>
              </thead>
              <tbody>
                  ${data.expenses.length > 0 ? data.expenses.map(e => `
                      <tr>
                          <td>${format(new Date(e.date), "dd/MM/yyyy", { locale: ptBR })}</td>
                          <td>${e.description}</td>
                          <td><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${e.category}</span></td>
                          <td class="amount expense">-${formatCurrency(e.amount)}</td>
                      </tr>
                  `).join('') : '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #94a3b8;">Nenhuma despesa registada neste período.</td></tr>'}
              </tbody>
          </table>
      </div>
  `);

    // Income Table
    printWindow.document.write(`
      <div class="section">
          <h2>Entradas do Período (Vendas)</h2>
          <table>
              <thead>
                  <tr>
                      <th>Data</th>
                      <th>Produto / Descrição</th>
                      <th>Cliente</th>
                      <th style="text-align: right;">Qtd</th>
                      <th style="text-align: right;">Valor</th>
                  </tr>
              </thead>
              <tbody>
                  ${data.sales.length > 0 ? data.sales.map(s => `
                      <tr>
                          <td>${format(new Date(s.date), "dd/MM/yyyy", { locale: ptBR })}</td>
                          <td>${s.productName}</td>
                          <td>${s.clientName || '-'}</td>
                          <td style="text-align: right;">${s.quantity}</td>
                          <td class="amount income">+${formatCurrency(s.amountPaid || s.totalValue)}</td>
                      </tr>
                  `).join('') : '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #94a3b8;">Nenhuma venda registada neste período.</td></tr>'}
              </tbody>
          </table>
      </div>
  `);

    printWindow.document.write(`
      <div class="footer">
          <p>Gerado em ${new Date().toLocaleString('pt-BR')} • MajorStockX</p>
      </div>
  `);

    printWindow.document.write('</div></body></html>');
    printWindow.document.close();

    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}
