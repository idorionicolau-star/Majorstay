import { NextRequest, NextResponse } from 'next/server';
import { takeAiQuota } from '@/lib/usage-quota-server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyIdToken } from '@/lib/firebase-admin';
import { validateCompanyId, checkRateLimit } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    // 1. Verificação de Segurança
    const decodedToken = await verifyIdToken(req);
    if (!decodedToken) {
      return NextResponse.json({ error: "Não autorizado. Token inválido ou ausente." }, { status: 401 });
    }
    if (!(await takeAiQuota(decodedToken as any))) {
        return NextResponse.json({ error: 'Limite diário de pedidos ao assistente atingido. Tente amanhã.' }, { status: 429 });
    }

    const data = await req.json();
    const { companyId } = data;

    // 2. Input Validation
    try {
      validateCompanyId(companyId);
    } catch (validationError: any) {
      return NextResponse.json({ error: validationError.message }, { status: 400 });
    }

    // 3. Rate Limiting
    if (!checkRateLimit(decodedToken.uid, 20, 60000)) { // 20 requests per minute
      return NextResponse.json({ error: "Demasiados pedidos. Tente novamente em breve." }, { status: 429 });
    }

    // 4. Tenant Isolation Check
    if (!decodedToken.superAdmin && (!companyId || companyId !== (decodedToken as any).companyId)) {
      return NextResponse.json({ error: "Acesso negado. Tentativa de acesso a dados de outra empresa." }, { status: 403 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Configuração do servidor incompleta. Chave de API indisponível." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // CORREÇÃO 1: Adicionado o prefixo 'models/' (Essencial para evitar Erro 404)
    const model = genAI.getGenerativeModel({ model: "models/gemini-3-pro-preview" });

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
    const dayOfMonth = now.getDate();

    const systemPrompt = `
      Atue como um Consultor Sênior de Operações e BI para a empresa **${data.company?.name || 'MajorStockX'}**.
      Analise os dados fornecidos e gere "Insights da IA" baseados nestes pilares:
      
      === CONTEXTO TEMPORAL ===
      - Data Atual: ${dateStr}
      - Dia do Mês: ${dayOfMonth}
      - IMPORTANTE: Se hoje for o início do mês (dia 1 a 7), não critique o baixo volume de vendas mensais. Em vez disso, projete a tendência ou dê sugestões preventivas para o mês que começa.

      === TONALIDADE E BRANDING ===
      - Seja um parceiro estratégico da **${data.company?.name || 'MajorStockX'}**.
      - Use um tom profissional, encorajador e focado em soluções (Empático).
      - Evite mencionar o nome do software "MajorStockX", foque no nome da empresa.

      === PILARES DA ANÁLISE ===
      1. Preditivo: Calcule a velocidade de vendas e preveja quando itens críticos esgotarão.
      2. Financeiro: Identifique produtos sem vendas (stock parado) e o capital imobilizado.
      3. Padrões: Detete tendências de vendas recentes ou anomalias de registo.
      4. Acionável: Recomende ações claras (ex: repor, liquidar, ajustar alertas).
      5. Integridade: Alerte sobre dados em falta ou potenciais erros de registo.

      Instruções de Formatação:
      - Use Emojis moderadamente para dar vida ao texto.
      - Use Negrito para destacar números e nomes de produtos.
      - Use Listas para organizar recomendações.
      - Limite a resposta a 3 parágrafos ou secções curtas.
    `;

    const prompt = `
      ${systemPrompt}
      
      DADOS PARA ANÁLISE:
      Vendas Recentes: ${JSON.stringify(data.sales).substring(0, 3000)}
      Inventário: ${JSON.stringify(data.products).substring(0, 3000)}
      KPIs atuais: ${JSON.stringify(data.stats)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    // CORREÇÃO 2: .text() é um método/função, precisa dos parênteses
    const text = response.text();

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Erro na API de Insights:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}