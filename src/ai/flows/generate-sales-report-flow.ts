'use server';
/**
 * @fileOverview A flow to generate a sales report summary from text using AI.
 *
 * - generateSalesReport - A function that takes a text prompt and returns an AI-generated sales report.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from 'zod';

const GenerateSalesReportInputSchema = z.string();
export type GenerateSalesReportInput = z.infer<typeof GenerateSalesReportInputSchema>;

const GenerateSalesReportOutputSchema = z.string();
export type GenerateSalesReportOutput = z.infer<typeof GenerateSalesReportOutputSchema>;

export async function generateSalesReport(input: GenerateSalesReportInput): Promise<GenerateSalesReportOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found in environment variables.");
  }

  const prompt = `És um analista de vendas especialista da MajorStockX. Com base nos seguintes dados ou pedido, gera um resumo conciso e perspicaz do relatório de vendas. A resposta deve ser em português e formatada em Markdown.

Pedido/dados do utilizador:
${input}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // ATUALIZAÇÃO: Mudando para 2.0 Flash para garantir a quota de 1500 req/dia e evitar erro 429
    const model = genAI.getGenerativeModel({ model: "models/gemini-3-flash-preview" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating sales report:", error);
    throw new Error("Failed to generate AI sales report.");
  }
}