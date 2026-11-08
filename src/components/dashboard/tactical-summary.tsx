"use client";

import { useState, useEffect, useContext, useCallback } from 'react';
import { useAuth } from '@/firebase/provider';
import { useCRM } from '@/context/crm-context';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, RefreshCw, FileDown, Printer, MoreHorizontal } from "lucide-react";
import { InventoryContext } from '@/context/inventory-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useTypingEffect } from '@/hooks/use-typing-effect';
import { isToday } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STORAGE_KEY = 'majorstockx-tactical-insights-v2';

export const TacticalSummary = () => {
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFreshlyGenerated, setIsFreshlyGenerated] = useState(false);
  const auth = useAuth();
  const inv = useContext(InventoryContext);
  const { sales, products, dashboardStats, companyData } = inv || {};
  const { customers } = useCRM();

  const generateInsights = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);

    const storageKey = `${STORAGE_KEY}-${auth.currentUser?.uid || 'guest'}`;

    if (!forceRefresh) {
      try {
        const cachedItem = localStorage.getItem(storageKey);
        if (cachedItem) {
          const { insights: cachedInsights, timestamp } = JSON.parse(cachedItem);
          if (isToday(new Date(timestamp))) {
            setIsFreshlyGenerated(false);
            setInsights(cachedInsights);
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error("Failed to read from localStorage", error);
      }
    }

    try {
      const { analyzeBusiness, analysisToMarkdown } = await import('@/lib/business-analysis');

      const text = analysisToMarkdown(analyzeBusiness({ products: products || [], sales: sales || [], customers: customers || [], orders: (inv as any)?.orders || [], productions: (inv as any)?.productions || [], stockMovements: (inv as any)?.stockMovements || [], businessType: companyData?.businessType }));

      setIsFreshlyGenerated(true);
      setInsights(text);

      try {
        localStorage.setItem(storageKey, JSON.stringify({
          insights: text,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error("Failed to write to localStorage", error);
      }
    } catch (error: any) {
      console.error(error);
      setInsights(`Não foi possível gerar os insights táticos locais: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [sales, products, customers, companyData, auth.currentUser?.uid]);

  useEffect(() => {
    if (sales && sales.length > 0 && dashboardStats) {
      generateInsights();
    }
  }, [sales, dashboardStats, generateInsights]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    generateInsights(true);
  };

  const handleDownloadPDF = async () => {
    if (!insights) return;

    try {
      const { generateInsightsPDF } = await import('@/lib/pdf-generator');
      generateInsightsPDF(insights, companyData?.name || 'MajorStockX', new Date());
    } catch (error) {
      console.error("Erro ao gerar PDF de insights:", error);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Insights - ${companyData?.name || 'MajorStockX'}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            h1 { color: #0f172a; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .date { color: #64748b; font-size: 0.9em; margin-bottom: 30px; }
            strong { color: #0369a1; }
            .footer { margin-top: 50px; font-size: 0.8em; color: #94a3b8; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Relatório de Insights Operacionais</h1>
          <div class="date">${companyData?.name || 'MajorStockX'} • ${new Date().toLocaleDateString()}</div>
          <div class="content">
            ${insights?.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
          </div>
          <div class="footer">Gerado por MajorStockX - Inteligência de Negócio</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const displayedInsights = useTypingEffect(insights || "", 15, isFreshlyGenerated, () => {
    setIsFreshlyGenerated(false);
  });

  return (
    <Card className="bg-card/60 dark:bg-slate-900/50 border-border shadow-sm lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-300">
          <Sparkles className="text-cyan-600 dark:text-sky-400 dark:shadow-neon-sky" strokeWidth={1.5} />
          Insights da IA
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading} className="h-8 w-8">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadPDF} disabled={!insights || isLoading}>
                <FileDown className="mr-2 h-4 w-4" />
                Descarregar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} disabled={!insights || isLoading}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72 overflow-y-auto p-4 rounded-lg font-mono text-xs border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-slate-100 dark:scrollbar-track-slate-900">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <ReactMarkdown
              className="prose prose-sm dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-strong:text-cyan-600 dark:prose-strong:text-sky-400 prose-ul:list-disc prose-ul:pl-4 prose-li:mb-1"
              components={{
                p: ({ node, ...props }) => <p {...props} className="mb-3 leading-relaxed" />,
                strong: ({ node, ...props }) => (
                  <strong {...props} className="text-cyan-600 dark:text-sky-400 font-bold bg-cyan-500/5 dark:bg-sky-500/10 px-1 rounded" />
                ),
                li: ({ node, ...props }) => <li {...props} className="text-slate-600 dark:text-slate-400" />,
              }}
              remarkPlugins={[remarkGfm]}
            >
              {isFreshlyGenerated ? displayedInsights : (insights || "Nenhum insight disponível no momento.")}
            </ReactMarkdown>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
