
import { NextRequest, NextResponse } from 'next/server';
import { takeAiQuota } from '@/lib/usage-quota-server';
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { differenceInDays } from 'date-fns';
import { verifyIdToken } from '@/lib/firebase-admin';
import { validateAIPrompt, validateCompanyId, checkRateLimit } from '@/lib/security';

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

    const { query, contextData, history } = await req.json();
    const companyId = contextData?.companyId;

    // 2. Input Validation
    try {
      validateAIPrompt(query);
      validateCompanyId(companyId);
    } catch (validationError: any) {
      return NextResponse.json({ error: validationError.message }, { status: 400 });
    }

    // 3. Rate Limiting (basic)
    if (!checkRateLimit(decodedToken.uid, 30, 60000)) { // 30 requests per minute
      return NextResponse.json({ error: "Demasiados pedidos. Tente novamente em breve." }, { status: 429 });
    }

    // 4. Tenant Isolation Check
    if (!decodedToken.superAdmin && (!companyId || companyId !== (decodedToken as any).companyId)) {
      return NextResponse.json({ error: "Acesso negado. Tentativa de acesso a dados de outra empresa." }, { status: 403 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API Key não configurada" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "models/gemini-3-flash-preview" });

    const isHealthCheck = query.toLowerCase().includes('diagnóstico') || query.toLowerCase().includes('relatório de saúde');

    let dataAgeContext = '';
    if (isHealthCheck && contextData?.businessStartDate) {
      const startDate = new Date(contextData.businessStartDate);
      const today = new Date();
      const businessAgeInDays = differenceInDays(today, startDate);

      if (businessAgeInDays < 15) {
        dataAgeContext = `
              **Nota CRÍTICA para a IA:** A empresa está na fase de "Nutrição de Dados", com ${businessAgeInDays + 1} dia(s) de operação.
              - **Foco Principal:** O teu objetivo é **validar e encorajar**, não dar conselhos financeiros profundos. Foque em verificar se os dados estão a ser inseridos corretamente.
              - **Exemplo de Abordagem:** Mencione uma venda ou um produto recentemente adicionado. Ex: "Ótimo trabalho ao inserir as primeiras vendas! O produto X parece estar a ter um bom começo." ou "Reparei que o inventário foi atualizado. Continue a registar todos os produtos para que eu possa fazer uma análise mais precisa em breve."
              - **Tom:** Seja um parceiro que está a "aprender" junto com o utilizador. Evite fazer previsões de longo prazo. Não faças julgamentos.
            `;
      } else if (businessAgeInDays < 30) {
        dataAgeContext = `
              **Nota:** A empresa tem menos de 30 dias de dados. A tua análise deve considerar que as tendências ainda estão a emergir e podem não ser representativas a longo prazo.
            `;
      }
    }

    const jsonStructure = `
      \`\`\`json
      {
        "geral": "Um resumo executivo de uma frase sobre a saúde geral do negócio. [SAÚDE ATUAL]",
        "oportunidade": {
          "titulo": "Título da Oportunidade (ex: Produto em Alta) [PONTO DE FOCO]",
          "descricao": "Descrição concisa e quantitativa da oportunidade. (ex: 'O produto X vendeu 50 unidades esta semana, 30% acima da média, mas o stock está em apenas 10.')",
          "sugestao": "Uma sugestão acionável. (ex: 'Focar na reposição imediata para não perder vendas.')"
        },
        "risco": {
          "titulo": "Título do Risco (ex: Stock Parado) [ALERTA DE MELHORIA]",
          "descricao": "Descrição concisa e quantitativa do risco. (ex: 'O item Y não vende há 45 dias e representa 15% do valor total do inventário.')",
          "sugestao": "Uma sugestão acionável. (ex: 'Considere uma promoção para libertar capital.')"
        }
      }
      \`\`\`
    `;

    const systemPrompt = `Você é o **Consultor Sênior de Business Intelligence (BI)** integrado no software de gestão "MajorStockX". O seu objetivo é escrever um 'Relatório de Operações' estratégico, focado na integridade dos dados, análise de rentabilidade e calibração de processos para a diretoria.`;

    const healthCheckInstructions = `
      **Regras de Comportamento e Estrutura:**
      1.  **Tom Profissional:** Seja analítico e focado em soluções, não apenas em listar problemas.
      2.  **Foco no Valor Real (Regra CRÍTICA):** Para todos os cálculos de faturamento, receita ou dinheiro que entrou, use **EXCLUSIVAMENTE** o campo \`amountPaid\` de cada venda. O campo \`totalValue\` representa apenas o valor contratado, não o dinheiro em caixa. **NUNCA** some os valores de \`totalValue\` para calcular a receita. Se precisar mencionar o valor total de uma encomenda, explique a diferença, por exemplo: "A encomenda X, com valor de 63.000 MT, contribuiu com 31.500 MT (valor pago) para a receita deste período."
      3.  **Análise Estratégica:**
          *   **Gestão Financeira e Rentabilidade:** Ao identificar uma venda bem registada, elogie a precisão do registo, explicando que o uso correto do campo \`amountPaid\` permite projetar o fluxo de caixa real (Cash Flow).
          *   **Gestão de Inventário e Riscos:** Ao citar itens com stock baixo ou parado, levante hipóteses estratégicas. Em vez de apenas dizer "o stock está baixo", pergunte: "Será que os nossos limites de alerta (thresholds) estão bem calibrados para este item?". Sugira validações para evitar falsos positivos ou otimizar o capital de giro.
      4.  **Ação, não apenas dado:** Não diga apenas 'O estoque está baixo'. Diga 'Reponha o item X imediatamente para evitar perda de faturamento estimada em Y'.
      5.  **Formato de Saída OBRIGATÓRIO:** A tua resposta DEVE ser um objeto JSON válido, sem nenhum texto fora do JSON. A estrutura deve ser: ${jsonStructure}.
          - O campo "geral" deve corresponder à sua análise geral da saúde do negócio.
          - O campo "oportunidade" deve focar-se na "Gestão Financeira e Rentabilidade".
          - O campo "risco" deve focar-se na "Gestão de Inventário e Riscos".

      ${dataAgeContext}

      **Contexto dos Dados:** Você receberá um objeto JSON contendo as transações recentes, níveis de estoque e estatísticas gerais.`;

    const generalQuestionInstructions = `
      **Instruções para Perguntas Gerais:**
      1.  **Aja como o MajorAssistant:** Mantenha um tom de especialista na aplicação de gestão "MajorStockX".
      2.  **Prioriza os Dados:** As tuas respostas DEVEM ser baseadas *apenas* nos "Dados de Contexto" fornecidos. Não inventes produtos, quantidades ou datas. Responda em texto simples (Markdown).
      3.  **Sê Preciso:** Se questionado sobre um produto, encontra a correspondência exata. Se não houver, indica isso.
      4.  **Orientação de Navegação:** Se o utilizador perguntar como fazer algo, fornece uma resposta clara e um link em Markdown para a página relevante (ex: "Pode adicionar novos produtos na página de [Inventário](/inventory?action=add)").
      5.  **Histórico de Adição de Produtos:** A array "stockAdditionsHistory" contém as adições de produtos ordenadas cronologicamente. O primeiro item é o produto adicionado mais antigo, e o último item é literalmente o último (mais recente) a entrar no sistema. Use esta lista com precisão para responder sobre as primeiras ou últimas inserções, fornecendo sempre datas, utilizador, motivo e horas exatas.`;

    const prompt = `
      ${systemPrompt}

      ${isHealthCheck ? healthCheckInstructions : generalQuestionInstructions}

      Estrutura da Aplicação (para orientação de navegação, se necessário):
      - /dashboard: Painel principal.
      - /inventory: Gerir stock.
      - /sales: Gerir vendas.
      - /production: Registar produção.
      - /orders: Gerir encomendas.
      - /reports: Ver relatórios.
      - /users: Gerir funcionários.
      - /settings: Configurar a aplicação.

      Pergunta do Utilizador: "${query}"

      Dados de Contexto (estado atual da aplicação):
      ${JSON.stringify(contextData, null, 2).substring(0, 150000)}
    `;

    const formattedHistory: Content[] = (history || []).map((msg: { role: 'user' | 'model', text: string }) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    let text = response.text();

    if (isHealthCheck) {
      try {
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : text;
        const jsonObj = JSON.parse(jsonString);
        return NextResponse.json(jsonObj);
      } catch (e) {
        console.error("AI JSON parsing error:", e);
        return NextResponse.json({
          text: `A IA retornou uma resposta, mas o formato JSON era inválido. Resposta: ${text}`
        }, { status: 500 });
      }
    }

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Erro na API de pesquisa AI:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
