import { NextRequest, NextResponse } from 'next/server';
import { takeAiQuota } from '@/lib/usage-quota-server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyIdToken } from '@/lib/firebase-admin';

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

    const { contextData } = await req.json();
    const companyId = contextData?.company?.id;

    // 2. Tenant Isolation Check
    if (!decodedToken.superAdmin && (!companyId || companyId !== (decodedToken as any).companyId)) {
      return NextResponse.json({ error: "Acesso negado. Tentativa de acesso a dados de outra empresa." }, { status: 403 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key não configurada" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "models/gemini-3-flash-preview" });

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
    const dayOfMonth = now.getDate();

    const systemPrompt = `**Atue como um Consultor Sênior de Business Intelligence (BI) e Parceiro Estratégico da empresa ${contextData?.company?.name || 'MajorStockX'}.**
**Objetivo:** Escrever um resumo executivo estratégico para a diretoria, com um máximo de 4 parágrafos.

=== CONTEXTO TEMPORAL ===
- Data Atual: ${dateStr}
- Dia do Mês: ${dayOfMonth}
- **IMPORTANTE**: Se hoje for o início do mês (dia 1 a 7), analise os totais mensais com cautela. Não critique o baixo volume de vendas em relação ao investimento em stock; em vez disso, reconheça o início do período e foque em projeções ou preparativos para o mês.

**Instruções de Estrutura e Tom:**
*   **Tom:** Consultivo, analítico e empático. Seja um aliado do gestor, não apenas um auditor. Use um tom profissional e focado em soluções.
*   **Branding:** Refira-se à empresa como **${contextData?.company?.name || 'MajorStockX'}**. Evite o uso repetitivo do nome do software "MajorStockX".
*   **Análise Multi-Localização:** Se a empresa tiver múltiplas localizações, as tuas análises devem levar isso em conta.
*   **Estrutura do Resumo:**
1.  **Parágrafo 1: Resumo Executivo.** Comece com uma saudação à equipa da **${contextData?.company?.name || 'MajorStockX'}**. Resuma a saúde geral do negócio considerando a fase do mês em que estamos.
2.  **Parágrafo 2: Oportunidade Principal.** Identifique a maior oportunidade ou ponto positivo nos dados.
3.  **Parágrafo 3: Risco Principal.** Identifique o maior risco ou ponto de melhoria (ex: stock parado, capital imobilizado).
4.  **Parágrafo 4: Recomendação Chave.** Termine com uma recomendação clara, prática e encorajadora.

**Saída Desejada:** Gere o texto em português de Moçambique/Portugal, usando formatação Markdown (negrito) para os pontos-chave. Máximo de 4 parágrafos.`;

    const prompt = `${systemPrompt}

    **Dados Atuais da Empresa:**
    \`\`\`json
    ${JSON.stringify(contextData, null, 2).substring(0, 8000)}
    \`\`\`
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });

  } catch (error: any) {
    console.error("Erro na API de Relatório Estratégico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
