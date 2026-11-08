import { NextResponse } from 'next/server';
import { takeAiQuota } from '@/lib/usage-quota-server';
import { verifyIdToken } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const decodedToken = await verifyIdToken(req);

        if (!decodedToken || !decodedToken.uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!(await takeAiQuota(decodedToken as any))) {
            return NextResponse.json({ error: 'Limite diário de pedidos ao assistente atingido. Tente amanhã.' }, { status: 429 });
        }

        const body = await req.json();
        const { cartItems, catalogItems } = body;

        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            return NextResponse.json({ suggestions: [] });
        }

        if (!catalogItems || !Array.isArray(catalogItems) || catalogItems.length === 0) {
            return NextResponse.json({ error: 'Catálogo vazio' }, { status: 400 });
        }

        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is not set');
            return NextResponse.json({ error: 'AI Suggestion Service Unavailable' }, { status: 503 });
        }

        // Filter out items already in the cart from the catalog
        const cartNames = cartItems.map((item: any) => item.productName.toLowerCase());
        const availableCatalog = catalogItems.filter(
            (item: any) => !cartNames.includes(item.name.toLowerCase())
        );

        if (availableCatalog.length === 0) {
            return NextResponse.json({ suggestions: [] });
        }

        // Limit catalog size to avoid token overflow
        const catalogContext = availableCatalog
            .slice(0, 150) // Adjust based on catalog size and token limits
            .map((item: any) => `ID: ${item.id} | Name: ${item.name} | Category: ${item.category || 'N/A'}`)
            .join('\n');

        const cartContext = cartItems
            .map((item: any) => `Name: ${item.productName} | Labeled Quantity: ${item.quantity}`)
            .join('\n');

        const prompt = `
            You are an expert sales assistant and cross-selling AI for a retail/wholesale store.
            The customer currently has the following items in their shopping cart:
            
            CART ITEMS:
            ${cartContext}

            Based on what they are buying, your goal is to suggest logic complementary products that they might have forgotten or that usually go well together.
            For example, if they bought Cimento (Cement), suggest Areia (Sand) or Colher de Pedreiro (Trowel). If they bought a phone, suggest a case or screen protector.

            Available Catalog (Do not suggest anything not in this list):
            ${catalogContext}

            RULES:
            1. Suggest exactly 3 product IDs from the Available Catalog that makes the most sense. If there are fewer than 3 good matches, suggest 1 or 2.
            2. Return ONLY a pure JSON array containing the String IDs of the suggested products. 
            3. Do not include markdown formatting like \`\`\`json. Just the raw array, e.g., ["id1", "id2", "id3"].
            4. Make sure the IDs exactly match the IDs in the Available Catalog list.
            `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let textResult = response.text().trim();

        // Clean up markdown block if Gemini still returns it
        if (textResult.startsWith('```json')) {
            textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        } else if (textResult.startsWith('```')) {
            textResult = textResult.replace(/```/g, '').trim();
        }

        let suggestedIds: string[] = [];
        try {
            suggestedIds = JSON.parse(textResult);
            if (!Array.isArray(suggestedIds)) {
                suggestedIds = [];
            }
        } catch (parseError) {
            console.error("Error parsing Gemini response:", textResult);
            // Fallback: try to extract something that looks like an array
            const match = textResult.match(/\[(.*?)\]/);
            if (match) {
                try {
                    suggestedIds = JSON.parse(match[0]);
                } catch {
                    suggestedIds = [];
                }
            }
        }

        // Ensure we only return IDs that actually exist in the provided catalog
        const validIds = suggestedIds.filter(id => availableCatalog.some((p: any) => p.id === id)).slice(0, 3);

        return NextResponse.json({ suggestions: validIds });

    } catch (error: any) {
        console.error('Error suggesting upsell:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
