"use client";

// Depois de cada venda: "E agora?" — enviar por WhatsApp, imprimir, PDF, ver a venda ou vender outra vez.
// O documento já não abre sozinho (quem não tem impressora tinha de o fechar a cada venda). Quem imprime sempre
// marca "Imprimir sempre neste aparelho" e a partir daí imprime logo, sem perguntar.
import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, FileDown, MessageCircle, Plus, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { InventoryContext } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { links } from "@/lib/deep-links";
import { receiptText, waShareLink } from "@/lib/sale-share";
import { setAfterSale } from "@/lib/after-sale";
import { downloadSaleDocument, formatCurrency } from "@/lib/utils";
import type { CartItem, Company, Sale } from "@/lib/types";

export type DoneSale = { sales: Sale[]; items: CartItem[]; total: number; client: string; phone?: string };

/** Imprime o documento da venda (todos os artigos com o mesmo número). */
export const printSale = (done: DoneSale, company: Company | null | undefined) => downloadSaleDocument(done.sales, company || null);

export function AfterSaleDialog({ done, onClose }: { done: DoneSale | null; onClose: (typed?: string) => void }) {
    const companyData = useContext(InventoryContext)?.companyData;
    const { toast } = useToast();
    const [phone, setPhone] = useState("");
    const [always, setAlways] = useState(false);
    useEffect(() => { setPhone(done?.phone || ""); setAlways(false); }, [done]);

    // começar a escrever o próximo produto fecha o painel e a letra vai para a pesquisa (não atrasa o atendimento)
    useEffect(() => {
        if (!done) return;
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
            if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || e.key === " ") return;
            e.preventDefault();
            onClose(e.key);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [done, onClose]);

    if (!done) return null;
    const guide = done.sales[0]?.guideNumber;
    const offline = done.sales.some((s) => s.offlinePending);
    const print = () => {
        printSale(done, companyData);
        if (always) {
            setAfterSale("print");
            toast({ title: "A partir de agora imprime logo", description: "Neste aparelho. Para voltar a perguntar: Definições → Documentos." });
        }
    };
    const pdf = async () => {
        try {
            const { downloadSaleDocumentPDF } = await import("@/lib/sale-document-pdf");
            await downloadSaleDocumentPDF(done.sales, companyData || null);
        } catch (e) {
            toast({ variant: "destructive", title: "Não foi possível gerar o PDF", description: e instanceof Error ? e.message : "Tente de novo." });
        }
    };
    const wa = waShareLink(receiptText({ company: companyData?.name, client: done.client, items: done.items, total: done.total, date: new Date(), money: (n) => formatCurrency(n) }), phone);

    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-sm" data-testid="sale-done">
                <DialogHeader className="items-center text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                    <DialogTitle>Venda registada{guide ? ` · ${guide}` : ""}</DialogTitle>
                    <DialogDescription className="text-2xl font-bold text-foreground">{formatCurrency(done.total)}</DialogDescription>
                    {(done.client || offline) && (
                        <p className="text-sm text-muted-foreground">{done.client}{done.client && offline ? " · " : ""}{offline ? "Sem internet: recibo provisório" : ""}</p>
                    )}
                </DialogHeader>
                <p className="-mt-1 text-center text-sm font-semibold">E agora?</p>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Telefone do cliente (opcional)" className="h-12" aria-label="Telefone do cliente" />
                        <Button asChild className="h-12 shrink-0 bg-emerald-600 px-4 hover:bg-emerald-700">
                            <a href={wa} target="_blank" rel="noopener noreferrer" data-testid="after-sale-whatsapp"><MessageCircle className="mr-2 h-5 w-5" />WhatsApp</a>
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-12" onClick={print} data-testid="after-sale-print"><Printer className="mr-2 h-5 w-5" />Imprimir</Button>
                        <Button variant="outline" className="h-12" onClick={pdf} data-testid="after-sale-pdf"><FileDown className="mr-2 h-5 w-5" />PDF</Button>
                    </div>
                    {guide && (
                        <Button asChild variant="ghost" className="h-11">
                            <Link href={links.sale(guide)}><Eye className="mr-2 h-5 w-5" />Ver a venda</Link>
                        </Button>
                    )}
                    <Button autoFocus className="h-12 text-base" onClick={() => onClose()} data-testid="after-sale-new"><Plus className="mr-2 h-5 w-5" />Nova venda</Button>
                    <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Checkbox checked={always} onCheckedChange={(v) => setAlways(v === true)} />
                        Imprimir sempre neste aparelho, sem perguntar
                    </label>
                </div>
            </DialogContent>
        </Dialog>
    );
}
