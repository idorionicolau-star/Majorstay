"use client";

import { useContext, useMemo } from "react";
import Link from "next/link";
import { CalendarClock, Factory, GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InventoryContext } from "@/context/inventory-context";
import { analyzeBusiness, isLearning, MIN_SALE_DAYS, PLAN_COVER_DAYS, rateLabel, runoutLabel, suggestedQuantity, type ProductRisk } from "@/lib/business-analysis";
import { links } from "@/lib/deep-links";

const fmt = (n: number) => (Number.isInteger(n) ? n : Number(n.toFixed(1))).toLocaleString("pt-PT");

/**
 * "Planear produção" (aviso do painel): o que vai esgotar nas próximas 2 semanas, ao ritmo de venda do último mês,
 * e quanto produzir para cobrir um mês — cada linha abre o registo de produção já preenchido.
 */
export function ProductionPlan({ onClose, canRegister }: { onClose: () => void; canRegister: boolean }) {
    const inv = useContext(InventoryContext);
    const products = inv?.products;
    const sales = inv?.sales;
    const locations = inv?.locations || [];
    const multi = !!inv?.isMultiLocation;

    // com padrão de vendas → quanto produzir; poucas vendas → "a aprender", sem quantidade (uma venda não é procura)
    const { plan, learning } = useMemo(() => {
        const runout = analyzeBusiness({ products: products || [], sales: sales || [], businessType: "manufacturer", multiLocation: multi }).stock.runout;
        return {
            plan: runout.filter((r) => !isLearning(r)).map((r) => ({ ...r, suggested: suggestedQuantity(r) })),
            learning: runout.filter(isLearning),
        };
    }, [products, sales, multi]);
    const when = (r: ProductRisk) => (r.available <= 0 ? <span className="font-medium text-red-600">Já esgotado</span> : r.daysLeft <= 1 ? <span className="font-medium text-amber-600">{runoutLabel(r.daysLeft)}</span> : <>Esgota em {runoutLabel(r.daysLeft)}</>);

    const locName = (id?: string) => (multi ? locations.find((l) => l.id === id)?.name || (!id ? locations[0]?.name : id) : "");

    return (
        <section data-tour="production-plan" className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
            <div className="mb-3 flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold leading-snug">O que produzir</h2>
                    <p className="text-sm text-muted-foreground">
                        Produtos que vendem com regularidade e esgotam em 14 dias ou menos. A sugestão cobre {PLAN_COVER_DAYS} dias de vendas.
                    </p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fechar plano"><X className="h-4 w-4" /></Button>
            </div>
            {plan.length === 0 ? (
                <p className="text-sm text-emerald-600">{learning.length ? "Nenhum produto com vendas regulares vai esgotar nas próximas 2 semanas." : "Nada vai esgotar nas próximas 2 semanas. 🎉"}</p>
            ) : (
                <ul className="divide-y rounded-xl border bg-background">
                    {plan.map((r) => (
                        <li key={`${r.name}|${r.location || ""}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                            <div className="min-w-[12rem] flex-1">
                                <p className="font-medium leading-snug">
                                    {r.name}
                                    {locName(r.location) && <span className="text-sm font-normal text-muted-foreground"> · {locName(r.location)}</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {when(r)}
                                    {" · "}{fmt(Math.max(0, r.available))} {r.unit} disponíveis · vende {rateLabel(r.soldPerDay, r.unit)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Produzir</p>
                                <p className="font-bold">{fmt(r.suggested)} {r.unit}</p>
                            </div>
                            {canRegister && (
                                <Button asChild size="sm">
                                    <Link href={links.newProduction(r.name, r.suggested, r.location, links.productionPlan())}>
                                        <Factory className="mr-1.5 h-4 w-4" /> Registar
                                    </Link>
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {learning.length > 0 && (
                <div className="mt-4" data-tour="production-plan-learning">
                    <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><GraduationCap className="h-4 w-4 text-sky-600" /> A aprender ({learning.length})</p>
                    <p className="mb-2 text-xs text-muted-foreground">
                        Venderam em menos de {MIN_SALE_DAYS} dias no último mês: ainda não há vendas suficientes para dizer quanto produzir. Produza à medida das encomendas — com mais vendas registadas passam para a lista de cima.
                    </p>
                    <ul className="divide-y rounded-xl border bg-background/60">
                        {learning.map((r) => (
                            <li key={`${r.name}|${r.location || ""}`} className="px-3 py-2">
                                <p className="text-sm font-medium leading-snug">
                                    {r.name}
                                    {locName(r.location) && <span className="font-normal text-muted-foreground"> · {locName(r.location)}</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {when(r)} · {fmt(Math.max(0, r.available))} {r.unit} disponíveis · vendeu em {r.saleDays} {r.saleDays === 1 ? "dia" : "dias"} no último mês
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
