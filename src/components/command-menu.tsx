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
import { RoomsContext } from "@/context/rooms-context"
import type { Product, Room, Stay } from "@/lib/types"
import { answerOffline, ASSISTANT_SUGGESTIONS } from "@/lib/offline-assistant"
import { Bed, Wine, User, Sparkles, ArrowLeft, LogIn } from "lucide-react"

import { useFuse } from "@/hooks/use-fuse"

interface CommandMenuProps {
  open: boolean
  setOpen: (open: boolean) => void
}

/**
 * Pesquisa Rápida (lupa / Ctrl+K):
 * Permite encontrar instantaneamente quartos, hóspedes em estadia, produtos do bar/minibar
 * e responde offline a perguntas sobre o alojamento com o Major Assistant.
 */
export function CommandMenu({ open, setOpen }: CommandMenuProps) {
  const router = useRouter()
  const inv = React.useContext(InventoryContext)
  const crm = React.useContext(CRMContext)
  const roomsCtx = React.useContext(RoomsContext)

  const products = inv?.products
  const rooms: Room[] = React.useMemo(() => roomsCtx?.rooms || [], [roomsCtx?.rooms])
  const stays: Stay[] = React.useMemo(() => roomsCtx?.stays || [], [roomsCtx?.stays])
  const openStays: Stay[] = React.useMemo(() => roomsCtx?.openStays || [], [roomsCtx?.openStays])

  const role = inv?.user?.role
  // as respostas do assistente incluem valores financeiros: só para quem vê o painel
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
        rooms: rooms,
        stays: stays,
      })
    } catch (error) {
      console.error("Assistant Error:", error)
      text = 'Não consegui responder a isso. Tente: **"Quartos ocupados agora"** ou **"Quartos a precisar de limpeza"**.'
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

  const normalizedSearch = search.trim().toLowerCase();

  const matchingRooms = React.useMemo(() => {
    if (!normalizedSearch) return [];
    return rooms.filter((r: Room) => 
      (r.name || '').toLowerCase().includes(normalizedSearch) || 
      (r.type || '').toLowerCase().includes(normalizedSearch)
    ).slice(0, 6);
  }, [rooms, normalizedSearch]);

  const matchingStays = React.useMemo(() => {
    if (!normalizedSearch) return [];
    return openStays.filter((s: Stay) => 
      (s.clientName || '').toLowerCase().includes(normalizedSearch) ||
      (s.clientPhone || '').includes(normalizedSearch) ||
      (s.roomName || '').toLowerCase().includes(normalizedSearch)
    ).slice(0, 4);
  }, [openStays, normalizedSearch]);

  const filteredProducts = useFuse(uniqueProducts, search, { keys: ['name'] });

  const hasAnyResults = matchingRooms.length > 0 || matchingStays.length > 0 || filteredProducts.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder={canAsk ? "Procurar quarto, hóspede, bar ou fazer pergunta..." : "Procurar quarto, hóspede ou produto do bar..."}
        value={search}
        onValueChange={onSearchChange}
      />
      {answer ? (
        <div className="max-h-[60vh] overflow-y-auto p-4" data-tour="search-answer">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 shrink-0 text-[#006194]" /> {answer.question}
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
          {search && !hasAnyResults && (
            <CommandEmpty>Nenhum quarto, hóspede ou produto encontrado.</CommandEmpty>
          )}

          {!search && (
            <CommandGroup heading="Acesso Rápido">
              <CommandItem onSelect={() => runCommand(() => router.push('/rooms/checkin'))}>
                <LogIn className="mr-2 h-4 w-4 text-[#006194]" />
                <span className="font-semibold">Novo Check-in Rápido</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/rooms'))}>
                <Bed className="mr-2 h-4 w-4 text-[#006194]" />
                <span>Quadro de Quartos & Suítes</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/pos'))}>
                <Wine className="mr-2 h-4 w-4 text-amber-600" />
                <span>Lounge & Bar (Consumos)</span>
              </CommandItem>
            </CommandGroup>
          )}

          {canAsk && !search && (
            <CommandGroup heading="Perguntas de Hotelaria">
              {ASSISTANT_SUGGESTIONS.map((q) => (
                <CommandItem key={q} value={`ask-${q}`} onSelect={() => ask(q)}>
                  <Sparkles className="mr-2 h-4 w-4 text-[#006194]" />
                  <span>{q}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {canAsk && search && (
            <CommandGroup>
              <CommandItem onSelect={() => ask(search)} value={`ask-${search}`}>
                <Sparkles className="mr-2 h-4 w-4 text-[#006194]" />
                <span>Perguntar ao assistente: «{search}»</span>
              </CommandItem>
            </CommandGroup>
          )}

          {matchingRooms.length > 0 && (
            <CommandGroup heading="Quartos & Suítes">
              {matchingRooms.map((room: Room) => {
                const statusLabel = 
                  room.status === 'occupied' || room.status === 'overtime' ? 'Ocupado' :
                  room.status === 'cleaning' ? 'Limpeza' :
                  room.status === 'maintenance' ? 'Manutenção' : 'Livre';
                return (
                  <CommandItem
                    key={room.id}
                    value={`quarto-${room.id}-${room.name}`}
                    onSelect={() => {
                      runCommand(() => router.push(`/rooms?quarto=${encodeURIComponent(room.id)}`))
                    }}
                  >
                    <Bed className="mr-2 h-4 w-4 text-[#006194]" />
                    <span className="font-semibold">{room.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({statusLabel} · {room.ratePerHour} MT/h)</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {matchingStays.length > 0 && (
            <CommandGroup heading="Hóspedes em Estadia Ativa">
              {matchingStays.map((stay: Stay) => (
                <CommandItem
                  key={stay.id}
                  value={`stay-${stay.id}-${stay.clientName || 'hospede'}`}
                  onSelect={() => {
                    runCommand(() => router.push(`/rooms?quarto=${encodeURIComponent(stay.roomId)}`))
                  }}
                >
                  <User className="mr-2 h-4 w-4 text-emerald-600" />
                  <span className="font-semibold">{stay.clientName || 'Hóspede Particular'}</span>
                  <span className="ml-2 text-xs text-muted-foreground">— Quarto {stay.roomName || stay.roomId}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredProducts.length > 0 && (
            <CommandGroup heading="Bar & Minibar">
              {filteredProducts.map((product: Product) => (
                <CommandItem
                  key={product.instanceId}
                  value={product.name}
                  onSelect={() => {
                    runCommand(() => router.push(`/pos?produto=${encodeURIComponent(product.name)}`))
                  }}
                >
                  <Wine className="mr-2 h-4 w-4 text-amber-600" />
                  <span>{product.name}</span>
                  {product.price != null && (
                    <span className="ml-auto text-xs font-semibold text-muted-foreground">{product.price.toFixed(2)} MT</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      )}
    </CommandDialog>
  )
}
