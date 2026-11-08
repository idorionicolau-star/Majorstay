import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyIdToken } from '@/lib/firebase-admin';
import { format } from 'date-fns';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Verificação de Segurança
    const decodedToken = await verifyIdToken(req);
    if (!decodedToken) {
      return NextResponse.json({ error: "Não autorizado. Token inválido ou ausente." }, { status: 401 });
    }

    const data = await req.json();
    const companyId = data.company?.id;

    // 2. Tenant Isolation Check
    if (!decodedToken.superAdmin && (!companyId || companyId !== (decodedToken as any).companyId)) {
      return NextResponse.json({ error: "Acesso negado. Tentativa de acesso a dados de outra empresa." }, { status: 403 });
    }

    // 2. IA GEMINI 3 FLASH 🧠
    let aiSummaryText = "Análise automática não disponível.";
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });

        const prompt = `Analise estes dados de vendas da empresa ${data.company?.name || 'nossa empresa'}: ${JSON.stringify(data.sales).substring(0, 2000)}. Escreva um resumo executivo de 2 frases em Português.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        aiSummaryText = response.text();

      } catch (aiError: any) {
        console.error("❌ Erro na IA do PDF:", aiError.message);
      }
    }

    return NextResponse.json({
      aiSummary: aiSummaryText,
      sales: data.sales, // Echo back if needed, but client has it. Actually, maybe just summary.
    });

  } catch (error: any) {
    console.error("❌ ERRO CRÍTICO NA API:", error);
    return NextResponse.json({
      error: "Erro ao processar a solicitação",
      details: error.message
    }, { status: 500 });
  }
}
