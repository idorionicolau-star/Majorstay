import type { Sale, Product, Customer, Company } from './types';
import { formatCurrency } from './utils';

export function generateLocalInsights(
  sales: Sale[] = [],
  products: Product[] = [],
  customers: Customer[] = [],
  companyData: Company | null = null
): string {
  const now = new Date();
  
  // --- Date Helpers ---
  const getDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // --- Filtering sales ---
  const validSales = sales.filter(s => !s.deletedAt && s.documentType !== 'Factura Proforma' && s.documentType !== 'Cotação');
  
  const salesThisMonth = validSales.filter(s => {
    const d = new Date(s.date);
    return d >= startOfThisMonth && d <= now;
  });

  const salesLastMonth = validSales.filter(s => {
    const d = new Date(s.date);
    return d >= startOfLastMonth && d <= endOfLastMonth;
  });

  const salesLast30Days = validSales.filter(s => {
    const d = new Date(s.date);
    return d >= getDaysAgo(30) && d <= now;
  });

  const salesPrev30Days = validSales.filter(s => {
    const d = new Date(s.date);
    return d >= getDaysAgo(60) && d < getDaysAgo(30);
  });

  // --- 1. SALES ANALYSIS & VELOCITY ---
  const revThisMonth = salesThisMonth.reduce((sum, s) => sum + (s.amountPaid ?? s.totalValue ?? 0), 0);
  const revLastMonth = salesLastMonth.reduce((sum, s) => sum + (s.amountPaid ?? s.totalValue ?? 0), 0);
  
  const revLast30Days = salesLast30Days.reduce((sum, s) => sum + (s.amountPaid ?? s.totalValue ?? 0), 0);
  const revPrev30Days = salesPrev30Days.reduce((sum, s) => sum + (s.amountPaid ?? s.totalValue ?? 0), 0);

  const monthGrowth = revLastMonth > 0 ? ((revThisMonth - revLastMonth) / revLastMonth) * 100 : 0;
  const thirtyDaysGrowth = revPrev30Days > 0 ? ((revLast30Days - revPrev30Days) / revPrev30Days) * 100 : 0;

  // Average ticket
  const ticketThisMonth = salesThisMonth.length > 0 ? revThisMonth / salesThisMonth.length : 0;
  const ticketLastMonth = salesLastMonth.length > 0 ? revLastMonth / salesLastMonth.length : 0;

  // Daily run rate
  const dayOfMonth = now.getDate();
  const avgDailySalesThisMonth = revThisMonth / dayOfMonth;
  const projectedMonthRevenue = avgDailySalesThisMonth * new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Top Products by Revenue in last 30 days
  const productRevenueMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  salesLast30Days.forEach(s => {
    if (!productRevenueMap[s.productId]) {
      productRevenueMap[s.productId] = { name: s.productName, qty: 0, revenue: 0 };
    }
    productRevenueMap[s.productId].qty += s.quantity;
    productRevenueMap[s.productId].revenue += (s.amountPaid ?? s.totalValue ?? 0);
  });

  const topProducts = Object.values(productRevenueMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  // Lack of entry check (latest sale date)
  let daysSinceLastSale = -1;
  if (validSales.length > 0) {
    const latestSaleDate = new Date(Math.max(...validSales.map(s => new Date(s.date).getTime())));
    daysSinceLastSale = Math.floor((now.getTime() - latestSaleDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // --- 2. INVENTORY HEALTH & TIED-UP CAPITAL ---
  const activeProducts = products.filter(p => !p.deletedAt);
  const totalInventoryValue = activeProducts.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0);
  const totalInventoryCost = activeProducts.reduce((sum, p) => sum + ((p.cost || p.price * 0.7) * (p.stock || 0)), 0);

  const outOfStock = activeProducts.filter(p => (p.stock || 0) <= 0);
  const criticalStock = activeProducts.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.criticalStockThreshold || 5));

  // Dead stock (in stock but no sales in the last 30 days)
  const productsSoldLast30Days = new Set(salesLast30Days.map(s => s.productId));
  const deadStockItems = activeProducts.filter(p => (p.stock || 0) > 0 && !productsSoldLast30Days.has(p.id || p.name));
  const deadStockValue = deadStockItems.reduce((sum, p) => sum + (p.price * p.stock), 0);

  // Stock Velocity & Days of Stock Left
  // Calculate average daily consumption over last 30 days
  const productDailyVelocity: Record<string, number> = {};
  salesLast30Days.forEach(s => {
    productDailyVelocity[s.productId] = (productDailyVelocity[s.productId] || 0) + (s.quantity / 30);
  });

  const runoutItems = activeProducts
    .filter(p => (p.stock || 0) > 0 && (productDailyVelocity[p.id || p.name] || 0) > 0)
    .map(p => {
      const dailyVelocity = productDailyVelocity[p.id || p.name];
      const daysLeft = Math.round(p.stock / dailyVelocity);
      return { product: p, daysLeft };
    })
    .filter(item => item.daysLeft <= 15)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Anomalies
  const negativeStockProducts = activeProducts.filter(p => (p.stock || 0) < 0);
  const zeroPriceProducts = activeProducts.filter(p => (p.price || 0) <= 0);

  // --- 3. CRM & CLIENT RETENTION ---
  // Top customers last 30 days
  const customerSpendingMap: Record<string, { name: string; email?: string; phone?: string; total: number; count: number }> = {};
  salesLast30Days.forEach(s => {
    if (s.customerId) {
      const cust = customers.find(c => c.id === s.customerId);
      const custName = cust?.name || s.clientName || 'Cliente Identificado';
      if (!customerSpendingMap[s.customerId]) {
        customerSpendingMap[s.customerId] = {
          name: custName,
          email: cust?.email,
          phone: cust?.phone,
          total: 0,
          count: 0
        };
      }
      customerSpendingMap[s.customerId].total += (s.amountPaid ?? s.totalValue ?? 0);
      customerSpendingMap[s.customerId].count += 1;
    }
  });

  const topCustomers = Object.values(customerSpendingMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  // Inactive customers (no visits in last 30 days but registered)
  const inactiveCustomers = customers
    .filter(c => {
      if (!c.lastVisit) return true;
      const daysSinceVisit = (now.getTime() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceVisit > 30 && c.totalPurchases > 0;
    })
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, 3);

  // CRM Data Entry Gaps
  const customersMissingContact = customers.filter(c => !c.phone && !c.email).length;

  // --- 4. OPERATIONAL QUALITY & LACK OF DATA ENTRY ---
  const salesWithoutCustomer = salesLast30Days.filter(s => !s.customerId);
  const anonymousSalesPercent = salesLast30Days.length > 0
    ? Math.round((salesWithoutCustomer.length / salesLast30Days.length) * 100)
    : 0;

  const productsMissingCategory = activeProducts.filter(p => !p.category || p.category.trim() === '' || p.category.toLowerCase() === 'sem categoria').length;
  const productsMissingCost = activeProducts.filter(p => p.cost === undefined || p.cost === null || p.cost <= 0).length;

  // --- BUILD THE SUPER DETAILED MARKDOWN ---
  let md = `### 📊 Diagnóstico e Análise do Consultor IA\n\n`;

  // 1. Resumo Financeiro & Tendência de Vendas
  md += `#### 💵 Performance e Tendência Financeira\n`;
  if (now.getDate() <= 7 && salesThisMonth.length < 5) {
    md += `* 📅 **Início do Mês:** Estamos nos primeiros dias de **${now.toLocaleDateString('pt-PT', { month: 'long' })}**. Foco na captação inicial! `;
    if (revLastMonth > 0) {
      md += `No mês passado fatura-se **${formatCurrency(revLastMonth)}**. A meta sugerida para este mês é ultrapassar este marco.\n`;
    } else {
      md += `Garanta que todos os orçamentos e propostas em aberto sejam acompanhados para iniciar as vendas com força.\n`;
    }
  } else {
    const growthText = thirtyDaysGrowth >= 0
      ? `📈 **+${thirtyDaysGrowth.toFixed(1)}%** face aos 30 dias anteriores`
      : `📉 **${thirtyDaysGrowth.toFixed(1)}%** face aos 30 dias anteriores`;
    md += `* **Faturação (Últimos 30 dias):** **${formatCurrency(revLast30Days)}** (${growthText}).\n`;
    md += `* **Projeção Mensal:** Se a velocidade atual se mantiver, a faturação este mês atingirá aproximadamente **${formatCurrency(projectedMonthRevenue)}**.\n`;
  }

  if (ticketThisMonth > 0) {
    const ticketDiff = ticketLastMonth > 0 ? ((ticketThisMonth - ticketLastMonth) / ticketLastMonth) * 100 : 0;
    const ticketDiffText = ticketDiff >= 0 ? `+${ticketDiff.toFixed(1)}%` : `${ticketDiff.toFixed(1)}%`;
    md += `* **Ticket Médio:** Atualmente em **${formatCurrency(ticketThisMonth)}** por venda (${ticketDiffText} em relação ao mês anterior).\n`;
  }

  if (daysSinceLastSale > 2) {
    md += `* ⚠️ **Falta de Lançamentos:** Não são registadas vendas há **${daysSinceLastSale} dias**. Verifique se existem faturas manuais pendentes de introdução ou se houve uma quebra real de atividade.\n`;
  } else if (daysSinceLastSale === 0) {
    md += `* ✅ **Atividade Recente:** Novas vendas foram lançadas hoje. A consistência nos lançamentos diários garante relatórios fidedignos.\n`;
  }

  // Top products
  if (topProducts.length > 0) {
    md += `* 🏆 **Produtos Estrela (Top Faturação):**\n`;
    topProducts.forEach((tp, i) => {
      md += `  ${i + 1}. **${tp.name}** (${tp.qty} un) — **${formatCurrency(tp.revenue)}**\n`;
    });
  }

  md += `\n`;

  // 2. Saúde de Inventário & Capital Imobilizado
  md += `#### 📦 Gestão de Inventário e Capital Empatado\n`;
  md += `* **Capital Imobilizado em Stock:** **${formatCurrency(totalInventoryValue)}** (Custo estimado: _${formatCurrency(totalInventoryCost)}_).\n`;
  
  if (deadStockValue > 0) {
    const deadPercent = totalInventoryValue > 0 ? Math.round((deadStockValue / totalInventoryValue) * 100) : 0;
    md += `* 💤 **Stock Parado (Sem vendas >30 dias):** Existem **${deadStockItems.length} produtos** sem qualquer saída recente, acumulando **${formatCurrency(deadStockValue)}** (${deadPercent}% do valor total do inventário). Sugere-se uma campanha promocional para escoar este stock e recuperar liquidez financeira.\n`;
  }

  if (outOfStock.length > 0 || criticalStock.length > 0) {
    md += `* ⚠️ **Ruptura de Stock:**\n`;
    if (outOfStock.length > 0) {
      md += `  - **${outOfStock.length} produtos** esgotados (Stock ≤ 0).\n`;
    }
    if (criticalStock.length > 0) {
      md += `  - **${criticalStock.length} produtos** em nível crítico (abaixo do alerta).\n`;
    }
  }

  if (runoutItems.length > 0) {
    md += `* ⏳ **Previsão de Ruptura (Velocidade de Vendas):**\n`;
    runoutItems.slice(0, 3).forEach(item => {
      md += `  - **${item.product.name}** (Stock: ${item.product.stock} ${item.product.unit || 'un'}): Esgotará em aproximadamente **${item.daysLeft} dias**.\n`;
    });
  }

  // Inventory anomalies
  if (negativeStockProducts.length > 0 || zeroPriceProducts.length > 0) {
    md += `* 🛠️ **Falhas/Anomalias no Inventário:**\n`;
    if (negativeStockProducts.length > 0) {
      md += `  - **${negativeStockProducts.length} produtos** com **Stock Negativo** (Ex: _${negativeStockProducts.slice(0,2).map(p=>`"${p.name}": ${p.stock}`).join(', ')}_). Isto aponta para vendas registadas antes do lançamento do stock de entrada.\n`;
    }
    if (zeroPriceProducts.length > 0) {
      md += `  - **${zeroPriceProducts.length} produtos** configurados com preço **zero ou gratuito**.\n`;
    }
  }

  md += `\n`;

  // 3. Clientes e CRM
  md += `#### 👥 Relacionamento com Clientes (CRM)\n`;
  md += `* **Base de Clientes Registada:** **${customers.length} clientes**.\n`;

  if (topCustomers.length > 0) {
    md += `* 🎖️ **Clientes Mais Valiosos (Últimos 30 dias):**\n`;
    topCustomers.forEach((tc, i) => {
      const contact = tc.phone ? ` (${tc.phone})` : (tc.email ? ` (${tc.email})` : '');
      md += `  ${i + 1}. **${tc.name}**${contact} — **${formatCurrency(tc.total)}** (${tc.count} compras)\n`;
    });
  }

  if (inactiveCustomers.length > 0) {
    md += `* 💔 **Clientes Ausentes (Churn Alerta):** Clientes registados que não compram há mais de 30 dias:\n`;
    inactiveCustomers.forEach(ic => {
      const days = Math.round((now.getTime() - new Date(ic.lastVisit).getTime()) / (1000 * 60 * 60 * 24));
      const contact = ic.phone ? ` - Telf: ${ic.phone}` : '';
      md += `  - **${ic.name}** (Inativo há **${days} dias**; compras históricas: _${formatCurrency(ic.totalPurchases)}_${contact})\n`;
    });
  }

  if (customersMissingContact > 0) {
    md += `* ⚠️ **Falta de Dados no CRM:** **${customersMissingContact} clientes** estão sem número de telefone ou e-mail registados. Isto dificulta campanhas de marketing ou notificações pós-venda.\n`;
  }

  md += `\n`;

  // 4. Integridade de Dados Operacionais
  md += `#### ⚙️ Integridade dos Lançamentos Operacionais\n`;
  if (anonymousSalesPercent > 50) {
    md += `* 👤 **Vendas Anónimas Elevadas:** **${anonymousSalesPercent}%** das vendas dos últimos 30 dias foram feitas sem associar um cliente específico. Recomende aos operadores a inserção do cliente no POS para melhorar o histórico do CRM.\n`;
  }
  if (productsMissingCategory > 0) {
    md += `* 📁 **Produtos sem Categoria:** Existem **${productsMissingCategory} produtos** sem categoria associada (ou classificados como "Sem Categoria"). Dificulta relatórios por sector.\n`;
  }
  if (productsMissingCost > 0) {
    md += `* 🏷️ **Margem Desconhecida:** **${productsMissingCost} produtos** estão sem custo unitário registado. Sem estes dados, o sistema não consegue calcular o lucro real e a rentabilidade do negócio.\n`;
  }

  md += `\n`;

  // 5. Recomendações Prioritárias
  md += `#### 💡 Ações Recomendadas da IA Local\n`;
  let recCount = 1;
  
  if (outOfStock.length > 0 || runoutItems.length > 0) {
    const itemsToBuy = outOfStock.slice(0, 2).map(p => p.name).concat(runoutItems.slice(0, 1).map(i => i.product.name));
    md += `${recCount}. 📦 **Reposição Urgente:** Criar guia de entrada ou contactar fornecedores para: **${itemsToBuy.join(', ')}** para evitar perda contínua de vendas.\n`;
    recCount++;
  }

  if (inactiveCustomers.length > 0) {
    const targetCust = inactiveCustomers[0];
    md += `${recCount}. 📞 **Reativar Cliente:** Entrar em contacto com **${targetCust.name}** (ausente há mais de 30 dias) oferecendo uma proposta personalizada.\n`;
    recCount++;
  }

  if (deadStockItems.length > 0) {
    const sampleDead = deadStockItems.slice(0, 2).map(p => p.name).join(', ');
    md += `${recCount}. 🏷️ **Campanha de Escoamento:** Fazer promoção especial ou desconto de volume para os itens **${sampleDead}** para liberar os **${formatCurrency(deadStockValue)}** parados no stock.\n`;
    recCount++;
  }

  if (productsMissingCost > 0 || negativeStockProducts.length > 0 || customersMissingContact > 0) {
    md += `${recCount}. 🧹 **Saneamento de Dados:** Dedicar tempo para corrigir os **${negativeStockProducts.length} stocks negativos**, atualizar os **${productsMissingCost} custos em falta** e recolher contactos dos clientes no CRM.\n`;
    recCount++;
  }

  if (recCount === 1) {
    md += `* 🌟 O seu sistema está com uma integridade excelente! Continue a registar os dados diariamente para manter a qualidade dos insights.\n`;
  }

  return md;
}

export function generateLocalReportSummary(
  sales: Sale[] = [],
  companyName: string = 'empresa',
  periodDescription: string = 'período selecionado'
): string {
  if (sales.length === 0) {
    return `Durante o ${periodDescription}, a ${companyName} não registou nenhuma venda. Recomenda-se analisar as estratégias de captação de clientes.`;
  }

  const totalValue = sales.reduce((sum, s) => sum + (s.amountPaid ?? s.totalValue ?? 0), 0);
  const totalSales = sales.length;
  const averageTicket = totalSales > 0 ? totalValue / totalSales : 0;

  // Find best selling product
  const productQtyMap: Record<string, { name: string; qty: number }> = {};
  sales.forEach(s => {
    if (!productQtyMap[s.productId]) {
      productQtyMap[s.productId] = { name: s.productName, qty: 0 };
    }
    productQtyMap[s.productId].qty += s.quantity;
  });

  const bestProduct = Object.values(productQtyMap)
    .sort((a, b) => b.qty - a.qty)[0];

  const bestProductText = bestProduct 
    ? `, sendo o "${bestProduct.name}" o artigo mais vendido com ${bestProduct.qty} unidades`
    : '';

  return `Durante o ${periodDescription.toLowerCase()}, a ${companyName} registou ${totalSales} vendas, resultando numa faturação de ${formatCurrency(totalValue)} com um ticket médio de ${formatCurrency(averageTicket)}${bestProductText}. Recomenda-se monitorizar a reposição destes itens de alta rotação para garantir a continuidade das operações e maximizar as margens.`;
}
