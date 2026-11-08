"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { InventoryContext } from "@/context/inventory-context"
import { CRMContext } from "@/context/crm-context"
import type { Product } from "@/lib/types"
import { answerOffline, ASSISTANT_SUGGESTIONS } from "@/lib/offline-assistant"
import { Box, Sparkles, ArrowLeft } from "lucide-react"

import { useFuse } from "@/hooks/use-fuse"

interface CommandMenuProps {
  open: boolean
  setOpen: (open: boolean) => void
}

/**
 * Pesquisa Rápida (lupa / Ctrl+K): procura produtos e, para o dono e administradores, responde a perguntas
 * em português com os dados do aparelho (o Major Assistant, sem internet) — aqui, em vez de um bloco fixo no painel.
 */
export function CommandMenu({ open, setOpen }: CommandMenuProps) {
  const router = useRouter()
  const inv = React.useContext(InventoryContext)
  const crm = React.useContext(CRMContext)
  const products = inv?.products
  const role = inv?.user?.role
  // as respostas incluem vendas e dinheiro: só para quem vê os números no painel
  const canAsk = role === 'Admin' || role === 'Dono'

  const [search, setSearch] = React.useState("")
  const [answer, setAnswer] = React.useState<{ question: string; text: string } | null>(null)

  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSearch("")
        setAnswer(null)
      }, 200);
    }
  }, [open])

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('navigation-start'))
    command()
  }, [setOpen])

  const ask = (question: string) => {
    const q = question.trim()
    if (!q || !inv) return
    let text: string
    try {
      text = answerOffline(q, {
        products: inv.products || [],
        sales: inv.sales || [],
        orders: inv.orders || [],
        productions: inv.productions || [],
        customers: crm?.customers || [],
        stockMovements: inv.stockMovements || [],
        locations: inv.locations || [],
        companyName: inv.companyData?.name,
        userName: inv.user?.username,
      })
    } catch (error) {
      console.error("Assistant Error:", error)
      text = "Não consegui responder a isso. Tente: **\"O que devo fazer hoje?\"** ou **\"Stock de bloco 15\"**."
    }
    setAnswer({ question: q, text })
    setSearch("")
  }

  const uniqueProducts = React.useMemo(() => {
    if (!products) return [];
    const seen = new Set<string>();
    return products.filter(p => {
      if (seen.has(p.name)) {
        return false;
      }
      seen.add(p.name);
      return true;
    });
  }, [products]);

  const onSearchChange = (value: string) => {
    setSearch(value);
    if (value) setAnswer(null);
  }

  const filteredProducts = useFuse(uniqueProducts, search, { keys: ['name'] });

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder={canAsk ? "Procurar um produto ou fazer uma pergunta..." : "Procurar um produto..."}
        value={search}
        onValueChange={onSearchChange}
      />
      {answer ? (
        <div className="max-h-[60vh] overflow-y-auto p-4" data-tour="search-answer">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" /> {answer.question}
          </p>
          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>ul]:list-disc [&>ul]:pl-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer.text}</ReactMarkdown>
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setAnswer(null)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Outra pergunta
          </Button>
        </div>
      ) : (
        <CommandList>
          <CommandEmpty>Nenhum produto encontrado com esse nome.</CommandEmpty>

          {canAsk && !search && (
            <CommandGroup heading="Perguntas">
              {ASSISTANT_SUGGESTIONS.map((q) => (
                <CommandItem key={q} value={`ask-${q}`} onSelect={() => ask(q)}>
                  <Sparkles className="mr-2 h-4 w-4 text-primary" />
                  <span>{q}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {canAsk && search && (
            <CommandGroup>
              <CommandItem onSelect={() => ask(search)} value={`ask-${search}`}>
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                <span>Perguntar: «{search}»</span>
              </CommandItem>
            </CommandGroup>
          )}

          {filteredProducts.length > 0 && (
            <CommandGroup heading="Produtos do Inventário">
              {filteredProducts.map((product: Product) => (
                <CommandItem
                  key={product.instanceId}
                  value={product.name}
                  onSelect={() => {
                    runCommand(() => router.push(`/inventory?filter=${encodeURIComponent(product.name)}`))
                  }}
                >
                  <Box className="mr-2 h-4 w-4" />
                  <span>{product.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      )}
    </CommandDialog>
  )
}
