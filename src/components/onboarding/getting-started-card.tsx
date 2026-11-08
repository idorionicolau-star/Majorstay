"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, Building2, Check, GraduationCap, PackagePlus, ShoppingCart, X, type LucideIcon } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { Button } from "@/components/ui/button";
import { gettingStarted, type StepId } from "@/lib/onboarding";
import { isDemoSaleDone } from "@/lib/demo-data";
import { rememberSeen } from "@/lib/seen-store";

const dismissKey = (companyId?: string | null) => `majorstockx-started-hidden-${companyId || "x"}`;

/** Cada passo: o que é, porquê, e o botão que leva lá (um guia com destaque visual, ou uma página). */
const COPY: Record<StepId, { icon: LucideIcon; title: string; hint: string; action: string; href: string }> = {
    demo: { icon: GraduationCap, title: "Fazer uma venda de treino", hint: "Com produtos de exemplo. Nada é gravado.", action: "Treinar", href: "/pos?demo=1" },
    catalog: { icon: PackagePlus, title: "Pôr os seus produtos no catálogo", hint: "Nome e preço de cada produto.", action: "Adicionar", href: "/catalog" },
    stock: { icon: Boxes, title: "Dar entrada do stock", hint: "Quanto tem de cada produto, no Stock Rápido.", action: "Abrir", href: "/inventory/quick?modo=entrada" },
    sale: { icon: ShoppingCart, title: "Fazer a primeira venda a sério", hint: "Na Venda Rápida, com os seus produtos.", action: "Vender", href: "/pos" },
    company: { icon: Building2, title: "Completar os dados da empresa", hint: "Contactos e logótipo aparecem nos documentos. O NUIT é opcional.", action: "Preencher", href: "/settings#company" },
};

/** "Primeiros passos": fica no início até a empresa fazer o essencial (ou até a pessoa o esconder). */
export function GettingStartedCard() {
    const ctx = useContext(InventoryContext);
    const companyId = ctx?.companyId;
    const [hidden, setHidden] = useState(true); // escondido até ler a escolha guardada (evita um piscar)
    const [demoDone, setDemoDone] = useState(false);
    useEffect(() => {
        const update = () => {
            try { setHidden(localStorage.getItem(dismissKey(companyId)) === "1"); } catch { setHidden(false); }
            setDemoDone(isDemoSaleDone(companyId));
        };
        update();
        window.addEventListener("msx:guide-done", update);
        return () => window.removeEventListener("msx:guide-done", update);
    }, [companyId]);

    if (!ctx || ctx.loading || hidden) return null;
    const c = ctx.companyData;
    const g = gettingStarted({
        demoDone,
        catalog: (ctx.catalogProducts || []).length,
        stock: ctx.products.length,
        sales: ctx.sales.length,
        // o NUIT é opcional: basta um contacto (telefone ou endereço)
        companyDone: !!(c?.phone || c?.address),
    });
    if (g.finished) return null;

    const hide = () => {
        try { localStorage.setItem(dismissKey(companyId), "1"); } catch { /* ignore */ }
        rememberSeen(dismissKey(companyId));
        setHidden(true);
    };

    return (
        <section aria-label="Primeiros passos" data-tour="dash-started" className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-semibold">Primeiros passos <span className="font-normal text-muted-foreground">· {g.done} de {g.total}</span></h2>
                    <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${(g.done / g.total) * 100}%` }} /></div>
                </div>
                <button type="button" onClick={hide} aria-label="Esconder primeiros passos" className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <ul className="mt-3 divide-y">
                {g.steps.map((s) => {
                    const t = COPY[s.id];
                    const primary = g.next === s.id;
                    return (
                        <li key={s.id} className="flex items-center gap-3 py-2.5">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"}`}>
                                {s.done ? <Check className="h-4 w-4" /> : <t.icon className="h-4 w-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium ${s.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
                                {!s.done && <p className="text-xs text-muted-foreground">{t.hint}</p>}
                            </div>
                            {!s.done && <Button asChild size="sm" variant={primary ? "default" : "outline"} data-tour={`started-${s.id}`}><Link href={t.href}>{t.action}</Link></Button>}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
