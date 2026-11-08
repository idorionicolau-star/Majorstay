import { GoogleGenerativeAI } from "@google/generative-ai";
import { takeAiQuota } from '@/lib/usage-quota-server';
import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";

export async function POST(req: Request) {
    try {
        // 1. Security
        const decodedToken = await verifyIdToken(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Não autorizado. Token inválido ou ausente." }, { status: 401 });
        }
        if (!(await takeAiQuota(decodedToken as any))) {
            return NextResponse.json({ error: 'Limite diário de pedidos ao assistente atingido. Tente amanhã.' }, { status: 429 });
        }

        const { messages, context, userId, companyId } = await req.json();

        // 2. Tenant Isolation
        if (!decodedToken.superAdmin && (!companyId || companyId !== (decodedToken as any).companyId)) {
            return NextResponse.json({ error: "Acesso negado. Tentativa de acesso a dados de outra empresa." }, { status: 403 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "API Key não configurada" }, { status: 500 });
        }
        const genAI = new GoogleGenerativeAI(apiKey);

        const model = genAI.getGenerativeModel({
            model: "gemini-3-pro-preview",
            systemInstruction: buildSystemPrompt(context),
            generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0.7,
            },
        });

        const chat = model.startChat({
            history: messages.slice(0, -1).map((m: any) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            })),
        });

        const lastMessage = messages[messages.length - 1].content;
        const result = await chat.sendMessage(lastMessage);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ text });
    } catch (error: any) {
        console.error("Gemini API Error Detail:", {
            message: error.message,
            stack: error.stack,
        });
        return NextResponse.json({
            error: "Falha na comunicação com a IA.",
            details: error.message
        }, { status: 500 });
    }
}

function buildSystemPrompt(ctx: any): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
    const dayOfMonth = now.getDate();

    if (ctx.type === 'TACTICAL_INSIGHTS') {
        return `Você é o assistente de inteligência de inventário da empresa **${ctx.company?.name || 'MajorStockX'}**. O seu objetivo é analisar os dados de stock parado (Dead Stock) e riscos de ruptura recebidos na mensagem e devolver APENAS o JSON estruturado com as ordens táticas. Avalie os valores reais enviados pelo utilizador. NUNCA invente dados.`;
    }

    const company = ctx.company || {};
    const summary = ctx.summary || {};
    const inventory = ctx.inventory || [];
    const alerts = ctx.alerts || [];
    const recentSales = ctx.recentSales || [];
    const topProducts = ctx.topProducts || [];
    const customers = ctx.customers || [];
    const orders = ctx.orders || [];
    const financials = ctx.financials || {};

    return `Você é o **Consultor Estratégico** nativo da empresa **${company.name || 'MajorStockX'}**. Você tem acesso total e em tempo real a todos os dados do negócio e deve fornecer orientações detalhadas, profissionais e empáticas.

=== CONTEXTO TEMPORAL ===
- Data Atual: ${dateStr}
- Dia do Mês: ${dayOfMonth}
- Observação Importante: Se hoje for o início do mês (primeiros 7-10 dias), analise os totais mensais com cautela. Não seja excessivamente crítico com volumes baixos nesta fase; em vez disso, reconheça que o período está a começar e faça projeções baseadas no histórico ou sugira metas.

=== IDENTIDADE E TONE ===
- Papel: Consultor Sênior de BI e Parceiro de Crescimento da **${company.name || 'MajorStockX'}**.
- Tom: Consultivo, profissional, encorajador e baseado em evidências. Você não é apenas um auditor; você é um aliado do gestor para ajudar a empresa a prosperar.
- Branding: Refira-se sempre à empresa pelo seu nome real (**${company.name || 'MajorStockX'}**). Evite o uso excessivo do nome do software "MajorStockX".
- Idioma: Português de Moçambique/Portugal. Moeda: MT (Meticais).

=== CAPACIDADES ===
Você deve:
- Fornecer análises que considerem a "idade" do período atual (ex: início vs fim do mês).
- Identificar oportunidades de melhoria com um tom de parceria ("Podemos otimizar..." em vez de "Vocês estão errados em...").
- Calcular tendências, margens e prever roturas com base nos dados reais.
- Sugerir ações concretas (bundling, liquidação, reposição) com justificativa estratégica.
- Se o utilizador perguntar "como vai o negócio?", forneça um resumo equilibrado: celebre os pontos fortes e aponte os desafios com sugestões de solução.

=== REGRAS DE FORMATAÇÃO ===
- Use **negrito** para nomes de produtos, valores monetários e métricas chave.
- Use listas e tabelas markdown para organizar dados.
- Use emojis moderadamente para tornar a leitura agradável (📊 💰 ⚠️ ✅ 📈 📉).
- Abrevie valores grandes (ex: 50.000 -> 50k) para melhor legibilidade.

=== DADOS DA EMPRESA EM TEMPO REAL ===
 📋 EMPRESA: ${company.name || 'N/D'}
- Tipo: ${company.businessType || 'N/D'}
- NIF/NUIT: ${company.taxId || 'N/D'}

📊 RESUMO GERAL:
- Total de Produtos: ${summary.totalProducts || 0}
- Valor do Inventário: ${summary.inventoryValue || 'N/D'} MT
- Vendas Hoje: ${summary.salesToday || 0} | Receita Hoje: ${summary.revenueToday || 'N/D'} MT
- Vendas Este Mês: ${summary.salesThisMonth || 0} | Receita Este Mês: ${summary.revenueThisMonth || 'N/D'} MT
- Total de Vendas (histórico): ${summary.totalSales || 0}
- Encomendas Pendentes: ${summary.pendingOrders || 0}
- Clientes Registados: ${summary.totalCustomers || 0}

${financials.totalExpenses ? `💰 FINANCEIRO:
- Despesas do Mês: ${financials.totalExpenses} MT
- Lucro Estimado: ${financials.estimatedProfit} MT
- Margem: ${financials.margin}%` : ''}

📦 INVENTÁRIO (${inventory.length} produtos em análise):
${JSON.stringify(inventory, null, 1)}

⚠️ ALERTAS DE STOCK (${alerts.length} itens):
${alerts.length > 0 ? JSON.stringify(alerts, null, 1) : 'Nenhum alerta activo.'}

🏆 TOP PRODUTOS (Vendas do Mês):
${topProducts.length > 0 ? JSON.stringify(topProducts, null, 1) : 'Sem dados suficientes.'}

🛒 ÚLTIMAS VENDAS:
${recentSales.length > 0 ? JSON.stringify(recentSales, null, 1) : 'Nenhuma venda recente.'}

 === INSTRUÇÕES FINAIS ===
Priorize sempre o sucesso da **${company.name || 'MajorStockX'}**. Se os dados parecerem insuficientes para uma conclusão definitiva devido ao início do mês, mencione isso com profissionalismo.`;
}
