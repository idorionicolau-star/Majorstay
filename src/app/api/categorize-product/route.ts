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

        const { productName, existingCategories } = await req.json();

        if (!productName || typeof productName !== 'string') {
            return NextResponse.json({ error: "O nome do produto é obrigatório." }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "API Key não configurada" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // O nome do modelo "preview" deixa de existir sem aviso; tenta alternativas estáveis.
        const MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3-flash-preview"];
        const build = (name: string) => genAI.getGenerativeModel({
            model: name,
            systemInstruction: `Você é um Assistente de Categorização de Frota de Produtos (Data Custodian). O seu objetivo é limpar os dados do cliente e classificar itens rigorosamente.
Regras:
1. O utilizador fornecerá o 'Nome do Produto' e uma lista de 'Categorias Existentes'.
2. Tente enquadrar o produto na lista de 'Categorias Existentes'.
3. Se NENHUMA categoria existente fizer sentido, crie uma NOVA categoria sintética, genérica, com no MÁXIMO 2 palavras (ex: 'Bebidas', 'Ferramentas', 'Cosméticos', 'Carvão', 'Cereais'). 
4. SEMPRE capitalize a primeira letra da categoria (ex: 'Bebidas' e NUNCA 'bebidas').
5. Se for uma nova categoria, use obrigatoriamente a forma PLURAL sempre que aplicável (ex: 'Lâminas' em vez de 'Lâmina', 'Canetas' em vez de 'Caneta').
6. Devolva APENAS o nome da categoria no output e mais nenhuma palavra. Nenhum ponto final, nenhuma explicação. Apenas a categoria.`,
            generationConfig: {
                maxOutputTokens: 20, // We only need 1 or 2 words
                temperature: 0.1, // Very low temperature for consistent categorization
            },
        });

        const prompt = `Categorias Existentes: ${Array.isArray(existingCategories) && existingCategories.length > 0 ? existingCategories.join(', ') : 'Nenhuma (base de dados limpa)'}\nNome do Produto: ${productName}`;

        let result;
        let lastErr: unknown;
        for (const name of MODELS) {
            try { result = await build(name).generateContent(prompt); break; } catch (e) { lastErr = e; }
        }
        if (!result) throw lastErr;
        const response = await result.response;
        // Clean up the output to ensure it's just the trimmed string
        const category = response.text().replace(/\n/g, '').replace(/\./g, '').trim();

        return NextResponse.json({ category });
    } catch (error: any) {
        console.error("Gemini Categorization Error Detail:", {
            message: error.message,
            stack: error.stack,
        });
        return NextResponse.json({
            error: "Falha na comunicação com a IA para categorização.",
            details: error.message
        }, { status: 500 });
    }
}
