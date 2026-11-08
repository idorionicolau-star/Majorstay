"use client";

// Página fora do plano da empresa: em vez dela, mostra o que o plano seguinte dá e como lá chegar.
import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURE_LABEL, tierFor, type Feature } from "@/lib/tiers";
import { formatCurrency } from "@/lib/utils";

export function PlanGate({ feature, isManager }: { feature: Feature; isManager: boolean }) {
    const tier = tierFor(feature);
    return (
        <div className="mx-auto mt-6 max-w-md rounded-3xl border bg-card p-6 text-center shadow-sm" data-testid="plan-gate">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Lock className="h-6 w-6" /></div>
            <h1 className="mt-3 text-xl font-bold">{FEATURE_LABEL[feature]}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Está incluído no plano <b>{tier.label}</b> ({formatCurrency(tier.monthly)}/mês).</p>
            <ul className="mx-auto mt-4 max-w-xs space-y-1 text-left text-sm">
                {tier.highlights.map((h) => <li key={h} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{h}</li>)}
            </ul>
            {isManager ? (
                <Button asChild className="mt-5 h-11 w-full rounded-xl"><Link href="/billing">Passar para o {tier.label}</Link></Button>
            ) : (
                <p className="mt-5 text-sm text-muted-foreground">Fale com o responsável da empresa para mudar de plano.</p>
            )}
        </div>
    );
}
