
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Company } from './types';
import { formatCurrency as formatCurrencyUi } from './utils';

// As fontes base do PDF não têm os espaços finos que o Intl pode usar nos números.
const formatCurrency = (value: number, options?: Parameters<typeof formatCurrencyUi>[1]) => formatCurrencyUi(value, options).replace(/[\u00A0\u202F]/g, ' ');

export const generateInventoryReportPDF = (products: any[], company: Company | null, locationName: string = 'Geral') => {
    const doc = new jsPDF();
    const reportTitle = locationName === 'Geral' ? 'Relatório de Inventário Geral' : `Relatório de Inventário: ${locationName}`;

    // Header
    doc.setFontSize(20);
    doc.text(company?.name || 'MajorStockX', 14, 22);

    doc.setFontSize(14);
    doc.setTextColor(52, 152, 219); // Blue
    doc.text(reportTitle, 14, 32);

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 40);

    // Table
    const tableColumn = ["Produto", "Categoria", "Stock", "Preço Unit.", "Valor Stock"];
    const tableRows: any[] = [];

    let totalValue = 0;

    products.forEach(product => {
        const availableStock = product.stock - (product.reservedStock || 0);
        const stockValue = availableStock * product.price;
        totalValue += stockValue;

        const row = [
            product.name,
            product.category,
            `${availableStock} ${product.unit || 'un.'}`,
            formatCurrency(product.price),
            formatCurrency(stockValue)
        ];
        tableRows.push(row);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 2 },
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Valor Total do Inventário: ${formatCurrency(totalValue)}`, 14, finalY);

    // Footer
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`MajorStockX - ${new Date().getFullYear()}`, 105, 290, { align: 'center' });

    doc.save(`Inventario_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateOrdersPDF = (orders: any[], company: Company | null) => {
    const doc = new jsPDF();
    const headers = [["Produto", "Cliente", "Data Entrega", "Qtd.", "Valor Total", "Status"]];
    const data = orders.map(order => [
        order.productName,
        order.clientName || 'N/A',
        order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('pt-BR') : 'N/A',
        `${order.quantity} ${order.unit}`,
        order.totalValue ? formatCurrency(order.totalValue) : 'N/A',
        order.status
    ]);

    doc.setFontSize(20);
    doc.text(company?.name || 'MajorStockX', 14, 22);
    doc.setFontSize(10);
    doc.text("Relatório de Encomendas", 14, 30);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

    autoTable(doc, {
        head: headers,
        body: data,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 2 },
    });

    doc.save(`Encomendas_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateProductionPDF = (productions: any[], company: Company | null, locationMap: any[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const headers = [["Data", "Produto", "Qtd.", "Und.", "Localização", "Registado por", "Status"]];
    const data = productions.map(prod => [
        new Date(prod.date).toLocaleDateString('pt-BR'),
        prod.productName,
        prod.quantity,
        prod.unit || 'un.',
        locationMap.find(l => l.id === prod.location)?.name || 'N/A',
        prod.registeredBy,
        prod.status
    ]);

    doc.setFontSize(20);
    doc.text(company?.name || 'MajorStockX', 14, 22);
    doc.setFontSize(10);
    doc.text("Relatório de Produção", 14, 30);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

    autoTable(doc, {
        head: headers,
        body: data,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 2 },
    });

    doc.save(`Producao_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateRawMaterialsPDF = (type: 'materials' | 'recipes' | 'costs', data: any[], company: Company | null) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(company?.name || 'MajorStockX', 14, 22);
    doc.setFontSize(10);

    let title = "";
    if (type === 'materials') title = "Relatório de Matérias-Primas";
    if (type === 'recipes') title = "Relatório de Receitas";
    if (type === 'costs') title = "Relatório de Custos de Produção";

    doc.text(title, 14, 30);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

    if (type === 'materials') {
        const headers = [["Nome", "Stock", "Custo Unit.", "Unidade", "Nível Mín."]];
        const rows = data.map((m: any) => [
            m.name,
            m.stock,
            m.cost ? formatCurrency(m.cost) : 'N/A',
            m.unit,
            m.lowStockThreshold
        ]);
        autoTable(doc, { head: headers, body: rows, startY: 40, theme: 'striped', headStyles: { fillColor: [41, 128, 185], textColor: 255 }, styles: { fontSize: 9 } });
    } else if (type === 'recipes') {
        let currentY = 40;
        data.forEach((r: any) => {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(r.productName, 14, currentY);
            currentY += 5;

            const ingHeaders = [["Ingrediente", "Quantidade"]];
            const ingRows = r.ingredients.map((ing: any) => [
                ing.rawMaterialName,
                ing.quantity
            ]);

            autoTable(doc, {
                head: ingHeaders,
                body: ingRows,
                startY: currentY,
                theme: 'plain',
                styles: { fontSize: 9 },
                margin: { left: 14 }
            });
            currentY = (doc as any).lastAutoTable.finalY + 10;
        });
    } else if (type === 'costs') {
        const headers = [["Produto Final", "Custo de Produção / Unidade"]];
        const rows = data.map((r: any) => [
            r.productName,
            r.isCalculable ? formatCurrency(r.totalCost) : 'Não calculado'
        ]);
        autoTable(doc, { head: headers, body: rows, startY: 40, theme: 'striped', headStyles: { fillColor: [41, 128, 185], textColor: 255 }, styles: { fontSize: 9 } });
    }

    doc.save(`${title.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateCriticalStockPDF = (products: any[], company: Company | null) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(231, 76, 60); // Red
    doc.text("ALERTA DE STOCK CRÍTICO", 14, 22);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(company?.name || 'MajorStockX', 14, 30);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 38);
    doc.text(`${products.length} itens necessitam de reposição`, 14, 46);

    const headers = [["Produto", "Categoria", "Stock Atual", "Mínimo", "Preço Unit.", "Status"]];
    const rows = products.map(p => {
        const available = p.stock - (p.reservedStock || 0);
        return [
            p.name,
            p.category,
            `${available} ${p.unit || 'un'}`,
            p.criticalStockThreshold,
            formatCurrency(p.price),
            available <= 0 ? 'ESGOTADO' : 'CRÍTICO'
        ];
    });

    autoTable(doc, {
        head: headers,
        body: rows,
        startY: 55,
        theme: 'striped',
        headStyles: { fillColor: [231, 76, 60], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 3 },
    });

    doc.save(`Stock_Critico_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateFinancialReportPDF = (companyName: string, period: string, totalIncome: number, totalExpenses: number, netProfit: number, sales: any[], expenses: any[]) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('Relatório Financeiro', 14, 22);
    doc.setFontSize(12);
    doc.text(`${companyName} • ${period}`, 14, 30);

    // Summary
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 40, 180, 25, 'F');

    doc.setFontSize(10);
    doc.text('Entradas', 20, 50);
    doc.text('Saídas', 80, 50);
    doc.text('Lucro Líquido', 140, 50);

    doc.setFontSize(14);
    doc.setTextColor(22, 163, 74); // Green
    doc.text(formatCurrency(totalIncome), 20, 60);

    doc.setTextColor(220, 38, 38); // Red
    doc.text(formatCurrency(totalExpenses), 80, 60);

    if (netProfit >= 0) {
        doc.setTextColor(37, 99, 235); // Blue
    } else {
        doc.setTextColor(220, 38, 38); // Red
    }
    doc.text(formatCurrency(netProfit), 140, 60);

    doc.setTextColor(0); // Reset color

    // Expenses Table
    doc.setFontSize(14);
    doc.text('Despesas do Período', 14, 80);

    const expHeaders = [["Data", "Descrição", "Categoria", "Valor"]];
    const expRows = expenses.map(e => [
        new Date(e.date).toLocaleDateString('pt-BR'),
        e.description,
        e.category,
        formatCurrency(e.amount)
    ]);

    autoTable(doc, {
        head: expHeaders,
        body: expRows,
        startY: 85,
        theme: 'striped',
        headStyles: { fillColor: [71, 85, 105], textColor: 255 },
        styles: { fontSize: 9 }
    });

    // Sales Table
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('Entradas do Período (Vendas)', 14, finalY);

    const salesHeaders = [["Data", "Produto", "Cliente", "Qtd", "Valor"]];
    const salesRows = sales.map(s => [
        new Date(s.date).toLocaleDateString('pt-BR'),
        s.productName,
        s.clientName || '-',
        s.quantity.toString(),
        formatCurrency(s.amountPaid || s.totalValue)
    ]);

    autoTable(doc, {
        head: salesHeaders,
        body: salesRows,
        startY: finalY + 5,
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74], textColor: 255 }, // Green for income
        styles: { fontSize: 9 }
    });

    doc.save(`Relatorio_Financeiro_${period.replace(/ /g, '_')}.pdf`);
};

export const generateReportPDF = (sales: any[], summary: any, company: Company | null, date: Date, aiSummary: string, period: string, returnBlob: boolean = false) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(59, 130, 246); // Blue-500
    doc.text('Relatório de Vendas', 195, 22, { align: 'right' });

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text(company?.name || 'MajorStockX', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${date.toLocaleDateString('pt-BR')}`, 14, 30);
    doc.text(`Período: ${period}`, 14, 35);

    // AI Summary Box
    if (aiSummary) {
        doc.setFillColor(241, 245, 249); // Slate-100
        doc.setDrawColor(59, 130, 246); // Blue-500
        doc.rect(14, 45, 180, 25, 'F');
        doc.setLineWidth(1);
        doc.line(14, 45, 14, 70); // Left border

        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105); // Slate-600
        doc.setFont("helvetica", "italic");

        const splitText = doc.splitTextToSize(aiSummary, 170);
        doc.text(splitText, 18, 52);
    }

    // Summary Cards Section
    let startY = aiSummary ? 80 : 50;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text("Resumo do Período", 14, startY);

    startY += 10;

    // Draw simplified summary cards (just text for now to keep it clean)
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("TOTAL VENDAS", 14, startY);
    doc.text("VALOR TOTAL", 60, startY);
    doc.text("TICKET MÉDIO", 110, startY);

    startY += 6;
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(summary.totalSales.toString(), 14, startY);
    doc.text(formatCurrency(summary.totalValue), 60, startY);
    doc.text(formatCurrency(summary.averageTicket), 110, startY);

    // Sales Table
    const headers = [["Data", "Produto", "Qtd.", "Preço Unit.", "Total", "Vendedor"]];
    const data = sales.map(s => [
        new Date(s.date).toLocaleDateString('pt-BR'),
        s.productName,
        s.quantity,
        formatCurrency(s.unitPrice),
        formatCurrency(s.totalValue),
        s.sellerName || 'N/A'
    ]);

    autoTable(doc, {
        head: headers,
        body: data,
        startY: startY + 15,
        theme: 'striped',
        headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105] }, // Slate-50, Slate-600
        styles: { fontSize: 9, cellPadding: 3, textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [255, 255, 255] }
    });

    doc.save(`Relatorio_Vendas_${period}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateInsightsPDF = (insights: string, companyName: string, date: Date) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text('Relatório de Insights Operacionais', 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100); // Gray
    doc.text(`${companyName} • ${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 26);

    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(14, 32, 196, 32);

    let y = 40;
    const pageWidth = 170; // Width available for text
    const lineHeight = 6;

    const lines = insights.split('\n');

    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85); // Slate-700

    lines.forEach(line => {
        if (y > 280) {
            doc.addPage();
            y = 20;
        }

        const cleanLine = line.trim();
        if (!cleanLine) {
            y += lineHeight;
            return;
        }

        const isBullet = cleanLine.startsWith('- ') || cleanLine.startsWith('* ');
        const textContent = isBullet ? cleanLine.substring(2) : cleanLine;

        let finalContent = textContent;
        let isBold = false;

        // Simple bold parser: **text**
        if (textContent.startsWith('**') && textContent.endsWith('**')) {
            finalContent = textContent.replace(/\*\*/g, '');
            isBold = true;
        }

        if (isBold) doc.setFont("helvetica", "bold");
        else doc.setFont("helvetica", "normal");

        if (isBullet) {
            doc.text('•', 14, y);
            const splitText = doc.splitTextToSize(finalContent, pageWidth - 5);
            doc.text(splitText, 20, y);
            y += splitText.length * lineHeight;
        } else {
            const splitText = doc.splitTextToSize(finalContent, pageWidth);
            doc.text(splitText, 14, y);
            y += splitText.length * lineHeight;
        }

        // Reset font
        doc.setFont("helvetica", "normal");
        y += 2; // Extra spacing between paragraphs
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text(`${companyName} © MajorStockX - Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`Insights_MajorStockX_${date.toISOString().split('T')[0]}.pdf`);
};

export type MovementPdfRow = { date: string; type: string; product: string; quantity: number; location: string; reason: string; user: string };

/** Histórico de movimentos de stock como PDF verdadeiro (antes era a janela de impressão). */
export const generateMovementsPDF = (rows: MovementPdfRow[], company: Company | null, periodLabel: string) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const W = doc.internal.pageSize.getWidth();
    const TYPE: Record<string, string> = { IN: 'Entrada', OUT: 'Saída', TRANSFER: 'Transferência', ADJUSTMENT: 'Ajuste' };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(company?.name || 'MajorStockX', 14, 18);
    doc.setFontSize(13);
    doc.text('Movimentos de Stock', W - 14, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Período: ${periodLabel} · ${rows.length} movimento${rows.length === 1 ? '' : 's'} · gerado a ${new Date().toLocaleString('pt-PT')}`, 14, 25);
    doc.setTextColor(0);

    autoTable(doc, {
        startY: 30,
        head: [['Data e hora', 'Tipo', 'Produto', 'Qtd.', 'Local', 'Motivo', 'Utilizador']],
        body: rows.map(r => [r.date, TYPE[r.type] || r.type, r.product, `${r.quantity > 0 ? '+' : ''}${r.quantity}`, r.location, r.reason, r.user]),
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 24 }, 3: { halign: 'right', cellWidth: 18 }, 5: { cellWidth: 70 } },
        didDrawPage: () => {
            const H = doc.internal.pageSize.getHeight();
            doc.setFontSize(7.5);
            doc.setTextColor(130);
            doc.text(`${company?.name || 'MajorStockX'} · MajorStockX`, 14, H - 8);
            doc.setTextColor(0);
        },
    });

    doc.save(`Movimentos_Stock_${new Date().toISOString().split('T')[0]}.pdf`);
};
