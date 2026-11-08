import { NextRequest, NextResponse } from 'next/server';
import { takeAiQuota } from '@/lib/usage-quota-server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyIdToken } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyIdToken(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Não autorizado. Token inválido ou ausente." }, { status: 401 });
        }
        if (!(await takeAiQuota(decodedToken as any))) {
            return NextResponse.json({ error: 'Limite diário de pedidos ao assistente atingido. Tente amanhã.' }, { status: 429 });
        }

        const { imageBase64, companyId } = await req.json();

        if (!decodedToken.superAdmin && (!companyId || companyId !== (decodedToken as any).companyId)) {
            return NextResponse.json({ error: "Acesso negado. Tentativa de acesso a dados de outra empresa." }, { status: 403 });
        }

        if (!imageBase64) {
            return NextResponse.json({ error: "Nenhuma imagem fornecida." }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Chave de API Gemini não configurada." }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });

        // Format base64 properly for Gemini if it includes data URI
        const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");
        // Extract mime type from data URI or default to image/jpeg
        const mimeTypeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

        const prompt = `Analise esta imagem de um formulário ou papel de contagem de inventário/stock.
    Extraia uma lista em formato JSON contendo objetos onde cada um tem exatamente duas chaves:
    "productName" (string, o nome do produto identificado) e "quantity" (number, a quantidade identificada).
    Se não encontrar nenhum produto, retorne um array vazio [].
    Certifique-se de que a resposta seja APENAS e estritamente o JSON puro em formato de array, sem blocos de código markdown nem explicações em texto fora do array. Exemplo válido:
    [
      {"productName": "T-Shirt Branca M", "quantity": 10},
      {"productName": "Caneta Preta", "quantity": 55}
    ]
    `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            }
        ]);

        const response = await result.response;
        const textResult = response.text();

        // Attempt to parse the resulting JSON. Sometimes LLMs return markdown code brackets anyway.
        let extractedData = [];
        try {
            const cleanedText = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
            extractedData = JSON.parse(cleanedText);
            if (!Array.isArray(extractedData)) {
                extractedData = [];
            }
        } catch (parseError) {
            console.error("Failed to parse Gemini response as JSON:", textResult);
            return NextResponse.json({ error: "O formato de resposta da IA não era válido.", rawText: textResult }, { status: 500 });
        }

        return NextResponse.json({
            items: extractedData
        });

    } catch (error: any) {
        console.error("❌ ERRO NA EXTRAÇÃO POR IA:", error);
        return NextResponse.json({
            error: "Erro ao processar a imagem",
            details: error.message
        }, { status: 500 });
    }
}
