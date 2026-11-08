"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MANUAL_CONFIRM_PROMISE, MANUAL_METHODS, manualProofMessage, type ManualMethod } from "@/lib/manual-pay-core";
import { whatsappLink, SUPPORT } from "@/lib/support";
import { formatCurrency } from "@/lib/utils";

/** Instruções do pagamento directo: para onde enviar, a referência e o botão do comprovativo por WhatsApp. */
export function ManualPayInstructions({ method, amount, reference, planLabel, company, email }: {
    method: ManualMethod; amount: number; reference: string; planLabel: string; company?: string | null; email?: string | null;
}) {
    const m = MANUAL_METHODS[method];
    const [copied, setCopied] = useState<string | null>(null);
    const copy = (key: string, text: string) => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    };
    const proof = whatsappLink(manualProofMessage({ company, email, plan: planLabel, amount: formatCurrency(amount), method, reference }));
    const Row = ({ k, label, value, copyText }: { k: string; label: string; value: string; copyText: string }) => (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
            <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="truncate text-lg font-bold tabular-nums">{value}</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => copy(k, copyText)} aria-label={`Copiar ${label}`}>
                {copied === k ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
        </div>
    );
    return (
        <div data-tour="bill-manual" className="space-y-3 rounded-2xl border border-sky-500/40 bg-sky-500/5 p-4">
            <p className="font-semibold">Pagar por {m.label}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Envie <b>{formatCurrency(amount)}</b> por {m.label} para o número abaixo.</li>
                <li>Se der para escrever uma mensagem ou referência, escreva <b>{reference}</b>.</li>
                <li>Mande o comprovativo (captura de ecrã ou SMS) pelo WhatsApp.</li>
            </ol>
            <div className="grid gap-2 sm:grid-cols-3">
                <Row k="num" label={`Número ${m.label}`} value={m.display} copyText={m.number} />
                <Row k="amount" label="Valor" value={formatCurrency(amount)} copyText={String(amount)} />
                <Row k="ref" label="Referência" value={reference} copyText={reference} />
            </div>
            <Button asChild className="h-12 w-full rounded-xl bg-emerald-600 text-base text-white hover:bg-emerald-700">
                <a href={proof} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-5 w-5" /> Enviar comprovativo por WhatsApp</a>
            </Button>
            <p className="text-xs text-muted-foreground">
                A conta fica activa assim que confirmarmos o pagamento — {MANUAL_CONFIRM_PROMISE}. WhatsApp {SUPPORT.whatsappDisplay}, só mensagens.
            </p>
        </div>
    );
}
