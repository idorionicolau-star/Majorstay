"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { openSupport } from "@/components/support/support-dialog";
import { isSnoozed, trialMessage, trialSnoozeMs, trialTone } from "@/lib/trial";
import { couponReminder, type CompanyCoupon } from "@/lib/coupon-core";
import { formatCurrency } from "@/lib/utils";

const key = (companyId?: string | null, kind = "trial") => `majorstockx-${kind}bar-until-${companyId || "x"}`;

/** Lê/grava até quando o aviso foi fechado (por empresa, neste aparelho). Escondido até ler, para não piscar. */
function useSnooze(storageKey: string) {
    const [hidden, setHidden] = useState(true);
    useEffect(() => {
        let until: number | null = null;
        try { const v = localStorage.getItem(storageKey); until = v ? Number(v) : null; } catch { /* ignore */ }
        setHidden(isSnoozed(until, Date.now()));
        // se a app ficar aberta, volta a mostrar quando o tempo passar
        if (until && until > Date.now()) {
            const id = window.setTimeout(() => setHidden(false), Math.min(until - Date.now(), 2 ** 31 - 1));
            return () => window.clearTimeout(id);
        }
    }, [storageKey]);
    const snooze = (ms: number) => {
        try { localStorage.setItem(storageKey, String(Date.now() + ms)); } catch { /* ignore */ }
        setHidden(true);
    };
    return { hidden, snooze };
}

const CloseBtn = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} aria-label="Fechar aviso" title="Fechar (volta a aparecer mais tarde)"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/90 hover:bg-white/20 hover:text-white">
        <X className="h-4 w-4" />
    </button>
);

/** Aviso do teste gratuito, com X: fecha por um dia (ou 5 horas na última semana) e depois volta. */
export function TrialBanner({ companyId, daysLeft, coupon }: { companyId?: string | null; daysLeft: number; coupon?: CompanyCoupon }) {
    const reminder = couponReminder(coupon, formatCurrency);
    const { hidden, snooze } = useSnooze(key(companyId, "trial"));
    if (hidden) return null;
    const tone = trialTone(daysLeft);
    const bg = tone === "urgent" ? "bg-rose-600" : tone === "soon" ? "bg-amber-500" : "bg-blue-600";
    const btn = tone === "urgent" ? "text-rose-700" : tone === "soon" ? "text-amber-700" : "text-blue-700";
    return (
        <div role="status" className={`${bg} sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-2 py-2 pl-4 pr-10 text-center text-sm font-medium text-white shadow-md`}>
            <span>{trialMessage(daysLeft)}</span>
            {reminder && <span data-tour="coupon-reminder" className="rounded bg-white/20 px-2 py-0.5 text-xs font-bold">🎟 {reminder}</span>}
            <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-bold">{daysLeft <= 0 ? "Último dia" : daysLeft === 1 ? "Resta 1 dia" : `Restam ${daysLeft} dias`}</span>
            <a href="/billing" className={`rounded bg-white px-2 py-0.5 text-xs font-bold hover:bg-white/90 ${btn}`}>Subscrever</a>
            <CloseBtn onClick={() => snooze(trialSnoozeMs(daysLeft))} />
        </div>
    );
}

/**
 * Quem veio da EscalePay já pagou lá: não vê a contagem do teste. Só se a compra ainda não estiver confirmada
 * nos últimos 3 dias é que aparece um aviso, para não ficar em modo leitura sem saber porquê.
 */
export function EscalepayPendingBanner({ daysLeft }: { daysLeft: number }) {
    if (daysLeft > 3) return null;
    return (
        <div role="status" data-tour="escalepay-pending" className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-2 bg-amber-500 py-2 px-4 text-center text-sm font-medium text-white shadow-md">
            <span>Ainda não recebemos a confirmação da sua compra na EscalePay. Use o mesmo email da compra, ou fale connosco.</span>
            <button type="button" onClick={openSupport} className="rounded bg-white px-2 py-0.5 text-xs font-bold text-amber-700 hover:bg-white/90">Falar com o suporte</button>
        </div>
    );
}

/** Aviso de renovação da subscrição paga, com o mesmo X (volta 5 horas depois). */
export function RenewBanner({ companyId, renewInDays, coupon }: { companyId?: string | null; renewInDays: number; coupon?: CompanyCoupon }) {
    const reminder = couponReminder(coupon, formatCurrency);
    const { hidden, snooze } = useSnooze(key(companyId, "renew"));
    if (hidden) return null;
    return (
        <div role="status" className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-2 bg-amber-500 py-2 pl-4 pr-10 text-center text-sm font-medium text-white shadow-md">
            <span>{renewInDays > 0 ? `A sua subscrição termina em ${renewInDays} dia(s).` : "A sua subscrição terminou — está no período de tolerância."}</span>
            {reminder && <span data-tour="coupon-reminder" className="rounded bg-white/20 px-2 py-0.5 text-xs font-bold">🎟 {reminder}</span>}
            <a href="/billing" className="rounded bg-white px-2 py-0.5 text-xs font-bold text-amber-700 hover:bg-white/90">Renovar</a>
            <CloseBtn onClick={() => snooze(5 * 3_600_000)} />
        </div>
    );
}
