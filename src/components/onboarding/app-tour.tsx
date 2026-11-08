"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, Boxes, ChevronLeft, ChevronRight, ClipboardList, PartyPopper, PlayCircle, Smartphone, Users, X, Zap, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InventoryContext } from "@/context/inventory-context";
import { cn } from "@/lib/utils";
import { rememberSeen } from "@/lib/seen-store";

type Slide = { icon: LucideIcon; title: string; lead: string; points: string[]; href?: string; open?: string; manufacturingOnly?: boolean };

/** Como a MajorStockX funciona, em linguagem simples. Uma ideia por ecrã. */
const SLIDES: Slide[] = [
    {
        icon: Zap, title: "Vender é rápido", lead: "A Venda Rápida é o coração da app.",
        points: ["Escreva o nome do produto (ou fale, ou leia o código de barras) e toque.", "Escolha a quantidade e confirme: o stock desce sozinho.", "Pode emitir factura, proforma ou guia, e ver a hora de cada venda no histórico."],
        href: "/pos", open: "Abrir a Venda Rápida",
    },
    {
        icon: Boxes, title: "O stock mantém-se certo", lead: "Chegou mercadoria? Contou o armazém? Registe no Stock Rápido.",
        points: ["Entradas, saídas e contagens num só ecrã, com o telemóvel.", "O inventário mostra o que há, o que está reservado e o que está a acabar.", "Produtos com cores ou texturas diferentes têm variações, cada uma com o seu stock."],
        href: "/inventory/quick", open: "Abrir o Stock Rápido",
    },
    {
        icon: ClipboardList, title: "Encomendas e produção", lead: "Para quem fabrica ou vende por encomenda.",
        points: ["Uma encomenda reserva o stock para o cliente.", "A produção gasta a matéria-prima da receita e põe o produto no stock.", "Ao entregar, a reserva sai e a venda fica registada."],
        href: "/orders", open: "Ver as Encomendas", manufacturingOnly: true,
    },
    {
        icon: Banknote, title: "Veja o dinheiro", lead: "Quanto entrou, quanto saiu e o que sobrou.",
        points: ["O Financeiro conta só o que já foi pago e as despesas que registar.", "Os Relatórios mostram o que mais vende e o que está parado.", "O Diagnóstico avisa de problemas antes de se tornarem prejuízo."],
        href: "/finance", open: "Abrir o Financeiro",
    },
    {
        icon: Users, title: "A sua equipa", lead: "Cada pessoa vê só o que precisa.",
        points: ["Adicione funcionários e escolha o que cada um pode fazer.", "Quem conta stock não vê as quantidades do sistema (contagem cega).", "Fica registado quem fez cada coisa."],
        href: "/users/new", open: "Adicionar funcionário",
    },
    {
        icon: Smartphone, title: "Leve-a consigo", lead: "Funciona no telemóvel como uma app e até sem internet.",
        points: ["Instale no ecrã principal (a app avisa como).", "Sem internet pode vender e dar entradas: segue sozinho quando a ligação voltar.", "Deslize para os lados para mudar de ecrã."],
    },
];

const seenKey = (companyId?: string | null) => `majorstockx-tour-seen-${companyId || "x"}`;
const resumeKey = (companyId?: string | null) => `majorstockx-tour-resume-${companyId || "x"}`;
const readResume = (companyId?: string | null): number | null => {
    try { const v = localStorage.getItem(resumeKey(companyId)); return v === null ? null : Number(v); } catch { return null; }
};
const writeResume = (companyId: string | null | undefined, v: number | null) => {
    try { if (v === null) localStorage.removeItem(resumeKey(companyId)); else localStorage.setItem(resumeKey(companyId), String(v)); } catch { /* ignore */ }
};

export function isTourSeen(companyId?: string | null): boolean {
    try { return localStorage.getItem(seenKey(companyId)) === "1"; } catch { return false; }
}
function markTourSeen(companyId?: string | null) {
    try { localStorage.setItem(seenKey(companyId), "1"); } catch { /* sem armazenamento: volta a aparecer, sem mal */ }
    rememberSeen(seenKey(companyId));
    window.dispatchEvent(new Event("msx:tour-seen"));
}

/** Abre o tour de qualquer sítio: `openTour()` (menu, cartão de primeiros passos) ou `openTour(true)` (depois da 1.ª venda). */
export const openTour = (celebrate = false) => window.dispatchEvent(new CustomEvent("msx:tour", { detail: { celebrate } }));

/** Lê se o tour já foi visto e actualiza quando é visto. */
export function useTourSeen(companyId?: string | null) {
    const [seen, setSeen] = useState(false);
    useEffect(() => {
        const update = () => setSeen(isTourSeen(companyId));
        update();
        window.addEventListener("msx:tour-seen", update);
        return () => window.removeEventListener("msx:tour-seen", update);
    }, [companyId]);
    return seen;
}

/** O diálogo "Como a app funciona". Montado uma vez no layout; abre por evento ou por /dashboard?tour=1. */
export function TourHost() {
    const ctx = useContext(InventoryContext);
    const companyId = ctx?.companyId;
    const reseller = ctx?.companyData?.businessType === "reseller";
    const [open, setOpen] = useState(false);
    const [celebrate, setCelebrate] = useState(false);
    const [i, setI] = useState(0);
    /** o tour ficou a meio (a pessoa foi ver um ecrã): em que passo continuar; null = não há tour a meio */
    const [resume, setResumeState] = useState<number | null>(null);

    // grava só quando a pessoa age (um efeito a gravar sempre apagava o valor guardado antes de ele ser lido)
    const setResume = (v: number | null) => { setResumeState(v); writeResume(companyId, v); };
    useEffect(() => { if (companyId && !isTourSeen(companyId)) setResumeState(readResume(companyId)); }, [companyId]);

    // (a primeira entrada é tratada pelas boas-vindas: venda de demonstração → catálogo; este resumo abre a pedido)

    useEffect(() => {
        const on = (e: Event) => {
            // depois da 1.ª venda só aparece uma vez; pedido pelo utilizador aparece sempre
            const wantsCelebrate = !!(e as CustomEvent).detail?.celebrate;
            if (wantsCelebrate && isTourSeen(companyId)) return;
            const at = readResume(companyId);
            setCelebrate(wantsCelebrate); setI(!wantsCelebrate && at !== null ? at : 0); setResume(null); setOpen(true);
        };
        window.addEventListener("msx:tour", on);
        if (new URLSearchParams(window.location.search).get("tour") === "1") {
            window.history.replaceState(null, "", window.location.pathname);
            on(new CustomEvent("msx:tour", { detail: { celebrate: false } }));
        }
        return () => window.removeEventListener("msx:tour", on);
    }, [companyId]);

    const slides = SLIDES.filter((s) => !(reseller && s.manufacturingOnly));
    const slide = slides[Math.min(i, slides.length - 1)];
    const last = i >= slides.length - 1;
    const close = () => { setOpen(false); setResume(null); markTourSeen(companyId); };
    /** foi ver o ecrã: o tour não acaba, fica à espera num botão e retoma no passo seguinte */
    const visit = () => { setOpen(false); setResume(Math.min(i + 1, slides.length - 1)); };
    const goOn = () => { if (resume === null) return; setI(Math.min(resume, slides.length - 1)); setCelebrate(false); setResume(null); setOpen(true); };

    return (
        <>
        {!open && resume !== null && (
            <div className="fixed bottom-20 right-3 z-40 flex items-center gap-1 rounded-full border bg-card py-1 pl-1 pr-1 shadow-lg md:bottom-6 md:right-6">
                <Button size="sm" className="rounded-full" onClick={goOn}><PlayCircle className="mr-1.5 h-4 w-4" /> Continuar o tour ({resume + 1}/{slides.length})</Button>
                <button type="button" onClick={close} aria-label="Terminar o tour" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
        )}
        <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else setOpen(true); }}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
                {celebrate && i === 0 && (
                    <div className="-mt-1 mb-1 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-400">
                        <PartyPopper className="h-5 w-5 shrink-0" />
                        <p className="text-sm font-semibold">Fez a sua primeira venda! Veja em 1 minuto como a app funciona.</p>
                    </div>
                )}
                <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><slide.icon className="h-7 w-7" /></span>
                    <DialogTitle className="text-xl">{slide.title}</DialogTitle>
                    <DialogDescription className="text-base">{slide.lead}</DialogDescription>
                </div>
                <ul className="space-y-2 text-left text-sm">
                    {slide.points.map((p) => (
                        <li key={p} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><span>{p}</span></li>
                    ))}
                </ul>
                {slide.href && (
                    <Button asChild variant="outline" className="w-full"><Link href={slide.href} onClick={visit}>{slide.open}</Link></Button>
                )}
                {slide.href && <p className="-mt-2 text-center text-xs text-muted-foreground">Depois pode continuar o tour no botão que fica no canto.</p>}
                <div className="flex items-center justify-between gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
                    <div className="flex gap-1.5" aria-label={`Passo ${i + 1} de ${slides.length}`}>
                        {slides.map((_, n) => <span key={n} className={cn("h-1.5 rounded-full transition-all", n === i ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")} />)}
                    </div>
                    {last
                        ? <Button size="sm" onClick={close}>Começar</Button>
                        : <Button variant="ghost" size="sm" onClick={() => setI((n) => n + 1)} aria-label="Seguinte"><ChevronRight className="h-4 w-4" /></Button>}
                </div>
                {!last && <button type="button" onClick={close} className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline">Saltar</button>}
            </DialogContent>
        </Dialog>
        </>
    );
}
