"use client";

import { useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Camera, LifeBuoy, Mail, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InventoryContext } from "@/context/inventory-context";
import { emailLink, SUPPORT, supportMessage, whatsappLink } from "@/lib/support";

/** Abre a janela de suporte de qualquer sítio: `openSupport()` (menu, avisos, página de erro…). */
export const openSupport = () => window.dispatchEvent(new Event("msx:support"));

/**
 * "Ajuda e suporte": pede o que mais ajuda (capturas de ecrã + descrição breve) e abre o WhatsApp
 * ou o email com a mensagem já preenchida (empresa, utilizador, página). Montado uma vez no layout.
 */
export function SupportDialog() {
    const ctx = useContext(InventoryContext);
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [problem, setProblem] = useState("");

    useEffect(() => {
        const on = () => setOpen(true);
        window.addEventListener("msx:support", on);
        return () => window.removeEventListener("msx:support", on);
    }, []);

    const message = () => supportMessage({
        company: ctx?.companyData?.name,
        user: ctx?.user?.username,
        page: pathname,
        problem,
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md" data-tour="support-dialog">
                <DialogHeader className="text-left">
                    <DialogTitle className="flex items-center gap-2"><LifeBuoy className="h-5 w-5 text-primary" /> Ajuda e suporte</DialogTitle>
                    <DialogDescription>
                        Para resolvermos depressa, envie <b className="text-foreground">uma ou mais capturas de ecrã</b> e <b className="text-foreground">uma descrição breve</b> do problema.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5">
                    <label htmlFor="support-problem" className="text-sm font-medium">O que aconteceu? <span className="font-normal text-muted-foreground">(opcional)</span></label>
                    <Textarea id="support-problem" value={problem} onChange={(e) => setProblem(e.target.value)} rows={3}
                        placeholder="Ex.: ao confirmar a entrada do cimento aparece um erro e não grava." />
                    <p className="text-xs text-muted-foreground">A mensagem já leva o nome da empresa, o seu utilizador e a página onde está.</p>
                </div>

                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                    <p className="flex items-center gap-1.5 font-medium"><Camera className="h-4 w-4 text-primary" /> Como tirar uma captura de ecrã</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        <li><b className="text-foreground">Android:</b> botão de ligar + baixar volume, ao mesmo tempo.</li>
                        <li><b className="text-foreground">iPhone:</b> botão lateral + aumentar volume.</li>
                        <li><b className="text-foreground">Computador:</b> Windows + Shift + S (ou a tecla Print Screen).</li>
                    </ul>
                </div>

                <div className="grid gap-2">
                    <Button asChild className="h-12 bg-green-600 text-white hover:bg-green-700">
                        <a href={whatsappLink(message())} target="_blank" rel="noopener noreferrer" data-tour="support-whatsapp">
                            <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp {SUPPORT.whatsappDisplay}
                        </a>
                    </Button>
                    <p className="-mt-1 text-center text-xs text-muted-foreground">Só mensagens de WhatsApp — este número não atende chamadas.</p>
                    <Button asChild variant="outline" className="h-11">
                        <a href={emailLink("Ajuda com a MajorStockX", message())} data-tour="support-email">
                            <Mail className="mr-2 h-4 w-4" /> Email: {SUPPORT.email}
                        </a>
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">No email, anexe as capturas de ecrã antes de enviar.</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** Botão "Ajuda e suporte" para os menus (computador e telemóvel). */
export function SupportNavButton({ onClick }: { onClick?: () => void }) {
    return (
        <button type="button" data-tour="nav-support" onClick={() => { onClick?.(); openSupport(); }}
            className="flex items-center gap-4 rounded-xl px-4 py-3 text-left text-base font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-primary dark:text-slate-400 dark:hover:bg-slate-800/50">
            <LifeBuoy className="h-6 w-6 text-slate-400" />
            <span className="flex-1">Ajuda e suporte</span>
        </button>
    );
}
