"use client";

import { Mic } from "lucide-react";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type VoiceAsk = { id: string; said: string; qty: number; options: Product[] };

/**
 * O ditado erra, por isso quando o que se disse só é PARECIDO com um produto a app não adivinha:
 * mostra as hipóteses (a mais parecida primeiro) e a pessoa toca na certa. Vários itens ditados de uma vez
 * ficam numa fila, um de cada vez.
 */
export function VoiceConfirm({ asks, onPick, onSkip, onClose, fmt, note }: {
    asks: VoiceAsk[];
    onPick: (ask: VoiceAsk, product: Product) => void;
    onSkip: (ask: VoiceAsk) => void;
    onClose: () => void;
    fmt: (n: number) => string;
    /** linha extra por produto (ex.: "esgotado") */
    note?: (p: Product) => string | undefined;
}) {
    const ask = asks[0];
    return (
        <Dialog open={!!ask} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-w-md">
                {ask && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><Mic className="h-4 w-4" /> Era este?</DialogTitle>
                            <DialogDescription>
                                Ouvi «{ask.said}» — <b>{fmt(ask.qty)}</b>. Toque no produto certo{asks.length > 1 ? ` (${asks.length} por confirmar)` : ""}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                            {ask.options.map((p, i) => (
                                <button
                                    key={`${p.instanceId || p.name}-${i}`}
                                    type="button"
                                    onClick={() => onPick(ask, p)}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition hover:bg-muted/60 active:scale-[0.99]"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate font-medium">{p.name}</span>
                                        <span className="block text-xs text-muted-foreground">{note?.(p) || `Stock: ${fmt(p.stock || 0)} ${p.unit || "un"}`}</span>
                                    </span>
                                    {i === 0 && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">mais parecido</span>}
                                </button>
                            ))}
                        </div>
                        <DialogFooter className="gap-2 sm:justify-between">
                            <Button variant="ghost" onClick={() => onSkip(ask)}>Nenhum destes</Button>
                            {asks.length > 1 && <Button variant="outline" onClick={onClose}>Ignorar todos</Button>}
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
