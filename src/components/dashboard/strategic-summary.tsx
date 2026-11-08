'use client';

import { useState, useEffect, useContext, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw } from 'lucide-react';
import { InventoryContext } from '@/context/inventory-context';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isToday } from 'date-fns';
import { useTypingEffect } from '@/hooks/use-typing-effect';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const STORAGE_KEY = 'majorstockx-strategic-summary';

export function StrategicSummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFreshlyGenerated, setIsFreshlyGenerated] = useState(false);
  const { sales, products, dashboardStats, stockMovements, user, companyData, firebaseUser } = useContext(InventoryContext) || {};

  const generateSummary = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);

    const storageKey = `${STORAGE_KEY}-${firebaseUser?.uid || 'guest'}`;

    if (!forceRefresh) {
      try {
        const cachedItem = localStorage.getItem(storageKey);
        if (cachedItem) {
          const { summary: cachedSummary, timestamp } = JSON.parse(cachedItem);
          if (isToday(new Date(timestamp))) {
            setIsFreshlyGenerated(false);
            setSummary(cachedSummary);
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error("Failed to read from localStorage", error);
      }
    }

    setSummary(null);

    try {
      const fbToken = await firebaseUser?.getIdToken();
      const response = await fetch('/api/generate-strategic-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${fbToken}`
        },
        body: JSON.stringify({
          contextData: {
            stats: dashboardStats,
            recentSales: sales?.slice(0, 10),
            inventoryProducts: products,
            stockMovements: stockMovements?.slice(0, 20),
            user,
            company: companyData,
          }
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao gerar o resumo.');
      }
      const data = await response.json();
      setIsFreshlyGenerated(true);
      setSummary(data.text);
      try {
        localStorage.setItem(storageKey, JSON.stringify({ summary: data.text, timestamp: new Date().toISOString() }));
      } catch (error) {
        console.error("Failed to write to localStorage", error);
      }
    } catch (error: any) {
      console.error(error);
      setSummary(`Não foi possível gerar o resumo estratégico: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [sales, products, dashboardStats, stockMovements, user, companyData, firebaseUser?.uid]);

  useEffect(() => {
    // Make sure we only generate summary when data is available
    if (sales && products && dashboardStats) {
      generateSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, products, dashboardStats]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    generateSummary(true);
  };

  const displayedSummary = useTypingEffect(summary || "", 15, isFreshlyGenerated, () => {
    setIsFreshlyGenerated(false);
  });

  return (
    <Card className="glass-card shadow-sm p-0">
      <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="hover:no-underline p-4 sm:p-6">
            <div className="flex flex-row items-center justify-between w-full">
              <div className="text-left">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Sparkles className="text-primary" />
                  Relatório de Operações Estratégico
                </h3>
                <p className="text-sm text-muted-foreground">Análise da IA com base nos dados atuais.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading} className="mr-2">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )}
            {summary && (
              <div className="prose dark:prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {isFreshlyGenerated ? displayedSummary : summary}
                </ReactMarkdown>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
