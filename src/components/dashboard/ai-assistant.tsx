
'use client';

import React, { useState, useContext, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot, User, Send, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { InventoryContext } from '@/context/inventory-context';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/context/crm-context';
import { generateLocalInsights } from '@/lib/local-ai';


export function AIAssistant({ initialQuery }: { initialQuery?: string }) {
  const {
    chatHistory: messages,
    setChatHistory: setMessages,
    sales,
    products,
    dashboardStats,
    stockMovements,
    firebaseUser,
    companyId: contextCompanyId,
    companyData
  } = useContext(InventoryContext) || {
    chatHistory: [],
    setChatHistory: () => { },
    sales: [],
    products: [],
    stockMovements: [],
    dashboardStats: {},
    firebaseUser: null,
    companyId: null,
    companyData: null
  };

  const { customers } = useCRM();

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, 'like' | 'dislike' | null>>({});
  const [showFeedbackInputFor, setShowFeedbackInputFor] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const { toast } = useToast();
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);

  useEffect(() => {
    // We only want to auto-scroll when new messages are added, not on initial load.
    if (isMounted.current && lastMessageRef.current) {
      // Use a short timeout to allow the DOM to update before scrolling.
      setTimeout(() => {
        lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } else {
      isMounted.current = true;
    }
  }, [messages]); // This effect runs every time the messages array changes.


  const handleAskAI = async (currentQuery: string) => {
    if (!currentQuery || !setMessages) return;
    setIsLoading(true);

    const newMessages: { role: 'user' | 'model', text: string, toolCalls?: any[], toolResponse?: any }[] = [...messages, { role: 'user', text: currentQuery }];
    setMessages(newMessages);
    setQuery('');

    try {
      const q = currentQuery.toLowerCase().trim();
      let responseText = '';

      const localInsights = generateLocalInsights(sales || [], products || [], customers || [], companyData || null);

      if (q.includes('diagnóstico') || q.includes('saúde') || q.includes('health') || q.includes('geral') || q.includes('tudo') || q.includes('relatório')) {
        responseText = localInsights;
      } else if (q.includes('venda') || q.includes('fatura') || q.includes('receita') || q.includes('financeiro') || q.includes('dinheiro') || q.includes('crescimento') || q.includes('faturamento')) {
        const salesSection = localInsights.split('#### 💵 Performance e Tendência Financeira')[1]?.split('####')[0];
        responseText = salesSection 
          ? `#### 💵 Performance e Tendência Financeira (Offline)\n${salesSection}`
          : localInsights;
      } else if (q.includes('stock') || q.includes('inventário') || q.includes('produto') || q.includes('artigo') || q.includes('ruptura') || q.includes('capital') || q.includes('insumo')) {
        const inventorySection = localInsights.split('#### 📦 Gestão de Inventário e Capital Empatado')[1]?.split('####')[0];
        responseText = inventorySection
          ? `#### 📦 Gestão de Inventário e Capital Empatado (Offline)\n${inventorySection}`
          : localInsights;
      } else if (q.includes('cliente') || q.includes('crm') || q.includes('valioso') || q.includes('ausente') || q.includes('churn')) {
        const crmSection = localInsights.split('#### 👥 Relacionamento com Clientes (CRM)')[1]?.split('####')[0];
        responseText = crmSection
          ? `#### 👥 Relacionamento com Clientes (CRM) (Offline)\n${crmSection}`
          : localInsights;
      } else if (q.includes('falha') || q.includes('erro') || q.includes('anomalia') || q.includes('dados') || q.includes('integridade')) {
        const integritySection = localInsights.split('#### ⚙️ Integridade dos Lançamentos Operacionais')[1]?.split('####')[0];
        responseText = integritySection
          ? `#### ⚙️ Integridade dos Lançamentos Operacionais (Offline)\n${integritySection}`
          : localInsights;
      } else if (q.includes('ação') || q.includes('recomendação') || q.includes('sugestão') || q.includes('fazer') || q.includes('ia')) {
        const recommendationsSection = localInsights.split('#### 💡 Ações Recomendadas da IA Local')[1];
        responseText = recommendationsSection
          ? `#### 💡 Ações Recomendadas da IA Local (Offline)\n${recommendationsSection}`
          : localInsights;
      } else {
        // Navigation guidelines or default local analysis
        if (q.includes('adicionar') || q.includes('criar') || q.includes('novo')) {
          if (q.includes('produto') || q.includes('stock')) {
            responseText = "Pode adicionar novos produtos diretamente na página de [Inventário](/inventory?action=add).";
          } else if (q.includes('venda') || q.includes('pos')) {
            responseText = "Pode registar novas vendas no [POS / Ponto de Venda](/pos) ou na página de [Vendas](/sales).";
          } else if (q.includes('encomenda')) {
            responseText = "Pode registar encomendas na página de [Encomendas](/orders/new).";
          } else if (q.includes('produção')) {
            responseText = "Pode lançar novas ordens de produção na página de [Produção](/production/new).";
          } else {
            responseText = "Para adicionar novos dados, aceda aos links rápidos:\n" +
              "- [Novo Produto no Inventário](/inventory?action=add)\n" +
              "- [Nova Venda no POS](/pos)\n" +
              "- [Nova Encomenda](/orders/new)\n" +
              "- [Nova Produção](/production/new)";
          }
        } else {
          responseText = `Olá! Sou o **MajorAssistant** local e estou a correr offline.\n\nCom base nos dados atuais da sua empresa, preparei um diagnóstico detalhado:\n\n${localInsights}`;
        }
      }

      // Simulate a slight typing latency so it feels interactive
      await new Promise(resolve => setTimeout(resolve, 500));
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (e: any) {
      console.error("Erro na pesquisa local:", e);
      setMessages(prev => [...prev, { role: 'model', text: `Erro no processamento local: ${e.message || 'Não foi possível processar offline.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      handleAskAI(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && query) {
      e.preventDefault();
      handleAskAI(query);
    }
  };

  const handleFeedback = (index: number, choice: 'like' | 'dislike') => {
    setFeedback(prev => ({ ...prev, [index]: choice }));
    if (choice === 'dislike') {
      setShowFeedbackInputFor(index);
      setFeedbackText('');
    } else {
      setShowFeedbackInputFor(null);
    }
  };

  const handleSendFeedback = (index: number) => {
    console.log(`Feedback for message ${index}:`, feedbackText);
    toast({ title: 'Obrigado!', description: 'O seu feedback ajuda-nos a melhorar.' });
    setShowFeedbackInputFor(null);
    setFeedbackText('');
  };

  return (
    <Card className="glass-card shadow-sm flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
          <Bot className="text-primary" />
          MajorAssistant
        </CardTitle>
        <CardDescription>
          Faça uma pergunta sobre seus dados de negócio para obter uma resposta detalhada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col gap-4">
        <ScrollArea className="flex-grow h-[200px] pr-4 -mr-4">
          <div className="space-y-4">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-6 border-2 border-dashed rounded-xl h-full">
                <Bot size={40} className="mb-4" />
                <p>Faça uma pergunta para começar.</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                ref={index === messages.length - 1 ? lastMessageRef : null}
                className={cn("flex items-start gap-3", message.role === 'user' ? 'justify-end' : '')}
              >
                {message.role === 'model' && <Avatar className="h-8 w-8"><AvatarFallback><Bot /></AvatarFallback></Avatar>}
                <div className={cn(
                  "p-3 rounded-2xl max-w-lg",
                  message.role === 'user'
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-muted rounded-bl-none"
                )}>
                  <div className="prose dark:prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ node, ...props }) => {
                          const href = props.href || '';
                          if (href.startsWith('/')) {
                            return <Link href={href} {...props} className="text-primary hover:underline font-bold" />;
                          }
                          return <a {...props} className="text-primary hover:underline font-bold" target="_blank" rel="noopener noreferrer" />;
                        },
                      }}
                    >
                      {message.text}
                    </ReactMarkdown>
                  </div>
                  {message.role === 'model' && (
                    <>
                      <div className="mt-3 flex items-center gap-1 border-t pt-2">
                        <Button variant="ghost" size="icon" className={`h-7 w-7 rounded-md ${feedback[index] === 'like' ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`} onClick={() => handleFeedback(index, 'like')}>
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className={`h-7 w-7 rounded-md ${feedback[index] === 'dislike' ? 'text-destructive bg-destructive/10' : 'text-muted-foreground'}`} onClick={() => handleFeedback(index, 'dislike')}>
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                      {showFeedbackInputFor === index && (
                        <div className="mt-2 space-y-2">
                          <Textarea placeholder="O que podemos melhorar?" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowFeedbackInputFor(null)}>Cancelar</Button>
                            <Button size="sm" onClick={() => handleSendFeedback(index)}>Enviar</Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {message.role === 'user' && <Avatar className="h-8 w-8"><AvatarFallback><User /></AvatarFallback></Avatar>}
              </div>
            ))}
            {isLoading && messages.length > 0 && (
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8"><AvatarFallback><Bot /></AvatarFallback></Avatar>
                <div className="p-3 rounded-2xl bg-muted rounded-bl-none">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <div className="flex items-center gap-2 w-full">
          <Input
            placeholder="Peça um insight ou faça uma pergunta..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <Button type="button" onClick={() => handleAskAI(query)} size="icon" disabled={isLoading || !query}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
