"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, Smartphone, Ticket, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { couponAmount, couponMonthsLeft, couponReminder } from "@/lib/coupon-core";
import { useInventory } from "@/context/inventory-context";
import { useAuth, useFirestore } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/plans";
import { TIERS, companyTierLabel, isTierId, onLegacyPlan, tierAmount, tierLabel, type PayTier } from "@/lib/tiers";
import { cn, formatCurrency } from "@/lib/utils";
import { useFromEscalepay } from "@/components/billing/escalepay-claim";
import { ManualPayInstructions } from "@/components/billing/manual-pay";
import { MANUAL_CONFIRM_HOURS, MANUAL_CONFIRM_PROMISE, MANUAL_METHODS, type ManualMethod } from "@/lib/manual-pay-core";

type Payment = { reference: string; planId: PlanId; tier?: PayTier; amount: number; status: string; createdAt: string; paidAt?: string; periodEnd?: string; provider?: string; method?: ManualMethod };

/** M-Pesa / e-Mola: pagamento directo (confirmado à mão); cartão: ZumboPay. */
type PayMethod = ManualMethod | "card";

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" }) : "—");

function BillingInner() {
    const { companyData, companyId, user, isTrial, daysLeft, isReadOnly, subscriptionReason } = useInventory();
    const fromEscalepay = useFromEscalepay();
    const auth = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const params = useSearchParams();
    const returnedRef = params.get("ref");

    const [selected, setSelected] = useState<PlanId>("mensal");
    // nível: o que a empresa tem; quem ainda está no plano antigo começa nele (nada muda se não quiser)
    const legacy = onLegacyPlan(companyData);
    const [tier, setTier] = useState<PayTier>("pro");
    // quem fabrica precisa da Produção (Business); os outros começam no Pro
    const makesGoods = companyData?.businessType !== "reseller";
    const tierKnown = companyData ? (isTierId(companyData.tier) ? companyData.tier : legacy ? "atual" : makesGoods ? "business" : "pro") : null;
    useEffect(() => { if (tierKnown) setTier(tierKnown as PayTier); }, [tierKnown]);
    const [method, setMethod] = useState<PayMethod>("mpesa");
    const [busy, setBusy] = useState(false);
    const [returned, setReturned] = useState<{ status: string; periodEnd?: string | null } | null>(null);
    const [history, setHistory] = useState<Payment[]>([]);
    const [codeText, setCodeText] = useState("");
    const [applying, setApplying] = useState(false);
    const coupon = companyData?.coupon;
    const couponLeft = couponMonthsLeft(coupon);
    /** preço deste plano com o código (null = preço normal). O servidor volta a calcular ao pagar. */
    const priceOf = (planId: PlanId, t: PayTier = tier) => {
        const full = tierAmount(t, planId);
        // o código de convite vale no Pro (ou no plano antigo, ao mesmo preço)
        const c = coupon && (t === "pro" || t === "atual") ? couponAmount({ price: coupon.price, months: coupon.months }, coupon.monthsUsed, planId) : { amount: null };
        return { full, amount: c.amount ?? full, discounted: c.amount != null };
    };

    const applyCode = async () => {
        if (!codeText.trim()) return;
        setApplying(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const r = await fetch("/api/billing/coupon", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ code: codeText }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || "Código inválido.");
            setCodeText("");
            setSelected("mensal");
            toast({ title: "Código aplicado", description: j.coupon ? couponReminder(j.coupon, formatCurrency) || undefined : "Registado — quem o convidou fica a saber." });
        } catch (e) {
            toast({ variant: "destructive", title: "Não foi possível usar o código", description: e instanceof Error ? e.message : "" });
        } finally {
            setApplying(false);
        }
    };
    const isAdmin = !!user && (user.role === "Admin" || user.role === "Dono");

    // History (admins can read companies/{id}/payments)
    useEffect(() => {
        // o histórico de pagamentos só o Administrador pode ler (regras: isAdminOf); o Dono via a escuta recusada
        if (!companyId || user?.role !== "Admin") return;
        const q = query(collection(firestore, `companies/${companyId}/payments`), orderBy("createdAt", "desc"), limit(20));
        return onSnapshot(q, (s) => setHistory(s.docs.map((d) => d.data() as Payment)), () => {});
    }, [firestore, companyId, isAdmin]);

    // A ZumboPay não devolve o cliente à app: quem volta (ou reabre a página) com um pagamento pendente recente
    // vê-o acompanhado aqui. Sem isto ficava a olhar para o histórico à espera de uma actualização.
    const watchRef = useMemo(() => {
        if (returnedRef) return returnedRef;
        const recent = history.find((h) => h.status === "pending" && h.provider !== "manual" && Date.now() - new Date(h.createdAt).getTime() < 30 * 60_000);
        return recent?.reference || null;
    }, [returnedRef, history]);

    // Poll until paid / failed (≈ 2 min)
    useEffect(() => {
        if (!watchRef) return;
        const returnedRef = watchRef;
        let tries = 0;
        let stop = false;
        const tick = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) { if (!stop) setTimeout(tick, 1500); return; }
                const r = await fetch(`/api/billing/status?ref=${encodeURIComponent(returnedRef)}`, { headers: { Authorization: `Bearer ${token}` } });
                const j = await r.json();
                setReturned({ status: j.status, periodEnd: j.periodEnd });
                if (!stop && j.status === "pending" && ++tries < 40) setTimeout(tick, 3000);
            } catch {
                if (!stop && ++tries < 40) setTimeout(tick, 3000);
            }
        };
        tick();
        return () => { stop = true; };
    }, [watchRef, auth]);

    // pagamento directo por confirmar (o mais recente, dos últimos 7 dias): as instruções continuam à vista
    const pendingManual = useMemo(() => history.find((h) => h.provider === "manual" && h.status === "pending" && h.method
        && Date.now() - new Date(h.createdAt).getTime() < 7 * 86_400_000) || null, [history]);

    const [showRef, setShowRef] = useState<string | null>(null);
    // depois de pedir, leva às instruções (no telemóvel ficam abaixo do botão)
    useEffect(() => {
        if (showRef && pendingManual?.reference === showRef) {
            document.querySelector('[data-tour="bill-manual"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
            setShowRef(null);
        }
    }, [showRef, pendingManual]);

    const payManual = async (m: ManualMethod) => {
        // o mesmo pedido ainda por confirmar: não cria outro, mostra as instruções
        if (pendingManual && pendingManual.planId === selected && (pendingManual.tier || "atual") === tier && pendingManual.method === m) { setShowRef(pendingManual.reference); return; }
        setBusy(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const r = await fetch("/api/billing/manual", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ planId: selected, tier, method: m }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || "Erro ao registar o pagamento");
            setShowRef(j.reference); // o histórico (onSnapshot) traz o pedido e as instruções aparecem
        } catch (e) {
            toast({ variant: "destructive", title: "Não foi possível registar o pagamento", description: e instanceof Error ? e.message : "" });
        } finally {
            setBusy(false);
        }
    };

    const pay = async () => {
        if (method !== "card") return payManual(method);
        setBusy(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const r = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ planId: selected, tier }),
            });
            const j = await r.json();
            if (!r.ok || !j.checkoutUrl) throw new Error([j.error || "Erro ao iniciar o pagamento", j.details].filter(Boolean).join(" — "));
            window.location.href = j.checkoutUrl; // checkout ZumboPay (cartão)
        } catch (e) {
            toast({ variant: "destructive", title: "Não foi possível iniciar o pagamento", description: e instanceof Error ? e.message : "" });
            setBusy(false);
        }
    };

    const ends = companyData?.subscriptionEndsAt;
    const statusLine = isReadOnly
        ? subscriptionReason === "trial_expired" ? "O período de teste terminou." : "A subscrição não está activa."
        : isTrial && fromEscalepay ? "Compra na EscalePay a confirmar — a conta fica activa sozinha (use o mesmo email da compra)."
        : isTrial ? `Período de teste — faltam ${daysLeft} dia(s).`
        : ends ? `Activa até ${fmtDate(ends)}.` : "Activa.";

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-24">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Subscrição MajorStockX</h1>
                <p className={cn("mt-1 text-sm", isReadOnly ? "font-semibold text-red-600" : "text-muted-foreground")}>{statusLine}</p>
                {companyData && <p className="mt-0.5 text-sm" data-testid="current-tier">Plano: <b>{companyTierLabel(companyData)}</b></p>}
            </div>

            {returnedRef && returned && (
                <div className={cn("flex items-center gap-3 rounded-2xl border p-4",
                    returned.status === "paid" ? "border-emerald-500/40 bg-emerald-500/10" : returned.status === "pending" ? "border-sky-500/40 bg-sky-500/10" : "border-red-500/40 bg-red-500/10")}>
                    {returned.status === "paid" ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : returned.status === "pending" ? <Loader2 className="h-6 w-6 animate-spin text-sky-600" /> : <XCircle className="h-6 w-6 text-red-600" />}
                    <div className="flex-1 text-sm">
                        {returned.status === "paid" && <p><b>Pagamento confirmado. Obrigado!</b> A sua conta está activa até {fmtDate(returned.periodEnd)}.</p>}
                        {returned.status === "pending" && <p><b>À espera da confirmação…</b> Confirme o pagamento no telemóvel (PIN do M-Pesa / e-Mola). Esta página actualiza sozinha.</p>}
                        {!["paid", "pending"].includes(returned.status) && <p><b>O pagamento não foi concluído.</b> Nada foi cobrado — pode tentar de novo.</p>}
                    </div>
                    {returned.status === "paid" && <Button size="sm" onClick={() => router.push("/dashboard")}>Continuar</Button>}
                </div>
            )}

            {!isAdmin ? (
                <p className="rounded-2xl border p-4 text-sm text-muted-foreground">Só o administrador da empresa pode pagar a subscrição.</p>
            ) : (
                <>
                    {coupon && couponLeft > 0 && (
                        <div data-tour="bill-coupon" className="flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
                            <Ticket className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                            <p>
                                <b>{couponReminder(coupon, formatCurrency)}.</b>{" "}
                                O desconto vale no plano <b>Pro Mensal</b>; depois passa ao preço normal ({formatCurrency(tierAmount("pro", "mensal"))}/mês).
                            </p>
                        </div>
                    )}

                    <div data-tour="bill-tiers">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plano</p>
                        <div className={cn("grid gap-3", legacy ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")} role="radiogroup" aria-label="Plano">
                            {legacy && (
                                <button type="button" role="radio" aria-checked={tier === "atual"} onClick={() => setTier("atual")}
                                    className={cn("rounded-2xl border-2 p-4 text-left transition", tier === "atual" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
                                    <p className="font-semibold">O meu plano atual</p>
                                    <p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(tierAmount("atual", "mensal"))}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                                    <p className="mt-1 text-xs text-muted-foreground">Tudo incluído, como até agora. Por ser cliente desde o início.</p>
                                </button>
                            )}
                            {TIERS.map((t) => (
                                <button key={t.id} type="button" role="radio" aria-checked={tier === t.id} onClick={() => setTier(t.id)}
                                    className={cn("relative rounded-2xl border-2 p-4 text-left transition", tier === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
                                    {t.id === "pro" && <span className="absolute right-3 top-3 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">Mais escolhido</span>}
                                    <p className="font-semibold">{t.label}</p>
                                    <p className="text-xs text-muted-foreground">{t.forWho}</p>
                                    <p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(t.monthly)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                                        {t.highlights.map((h) => <li key={h} className="flex gap-1"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />{h}</li>)}
                                    </ul>
                                </button>
                            ))}
                        </div>
                        {legacy && tier !== "atual" && <p className="mt-2 text-xs text-amber-600">Ao mudar de plano deixa o plano atual (tudo incluído). Pode pedir para voltar a ele ao suporte.</p>}
                        {makesGoods && tier !== "atual" && isTierId(tier) && !TIERS.find((t) => t.id === tier)!.features.includes("production") && (
                            <p className="mt-2 text-xs font-semibold text-amber-600" data-testid="tier-warning">Atenção: o plano {tierLabel(tier)} não inclui a Produção e as matérias-primas, que a sua empresa usa.</p>
                        )}
                    </div>

                    <p className="-mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período</p>
                    <div className="grid gap-3 sm:grid-cols-3" data-tour="bill-plans">
                        {PLANS.map((p) => { const pr = priceOf(p.id); return (
                            <button key={p.id} type="button" onClick={() => setSelected(p.id)}
                                className={cn("relative rounded-2xl border-2 p-4 text-left transition", selected === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
                                {p.note && <span className="absolute right-3 top-3 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600">{p.note}</span>}
                                <p className="font-semibold">{p.label}</p>
                                {pr.discounted && <p className="mt-2 text-sm text-muted-foreground line-through tabular-nums">{formatCurrency(pr.full)}</p>}
                                <p className={cn("text-2xl font-bold tabular-nums", pr.discounted ? "text-emerald-600" : "mt-2")}>{formatCurrency(pr.amount)}</p>
                                <p className="text-xs text-muted-foreground">{pr.discounted ? `com o código ${coupon?.code}` : p.months === 1 ? "por mês" : `${p.months} meses · ${formatCurrency(Math.round(pr.full / p.months))}/mês`}</p>
                            </button>
                        ); })}
                    </div>

                    <div data-tour="bill-notice" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                        <p className="font-semibold">Aviso temporário: M-Pesa e e-Mola</p>
                        <p className="mt-1 text-muted-foreground">
                            Por causa de uma actualização dos sistemas de pagamento, o pagamento automático por M-Pesa e e-Mola está temporariamente indisponível.
                            Enquanto isso, pode pagar <b>enviando directamente</b> para o nosso número e mandar o comprovativo por WhatsApp — a conta fica activa <b>{MANUAL_CONFIRM_PROMISE}</b>.
                            O cartão continua a funcionar normalmente. Obrigado pela compreensão.
                        </p>
                    </div>

                    <div data-tour="bill-method" className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Forma de pagamento">
                        {([...Object.entries(MANUAL_METHODS).map(([id, m]) => [id, m.label]), ["card", "Cartão"]] as [PayMethod, string][]).map(([id, label]) => (
                            <button key={id} type="button" role="radio" aria-checked={method === id} onClick={() => setMethod(id)}
                                className={cn("flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 text-sm font-semibold transition",
                                    method === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
                                {id === "card" ? <CreditCard className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />} {label}
                            </button>
                        ))}
                    </div>

                    <Button data-tour="bill-pay" onClick={pay} disabled={busy} className="h-12 rounded-xl text-base">
                        {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : method === "card" ? <CreditCard className="mr-2 h-5 w-5" /> : <Smartphone className="mr-2 h-5 w-5" />}
                        Pagar {formatCurrency(priceOf(selected).amount)} · {tierLabel(tier)}{method === "card" ? " com cartão" : ` por ${MANUAL_METHODS[method].label}`}
                    </Button>

                    {pendingManual && (
                        <ManualPayInstructions method={pendingManual.method!} amount={pendingManual.amount} reference={pendingManual.reference}
                            planLabel={`${tierLabel(pendingManual.tier || "atual")} · ${PLANS.find((p) => p.id === pendingManual.planId)?.label || pendingManual.planId}`}
                            company={companyData?.name} email={auth.currentUser?.email} />
                    )}

                    {!(coupon && couponLeft > 0) && (
                        <div className="flex gap-2" data-tour="bill-code">
                            <Input value={codeText} onChange={(e) => setCodeText(e.target.value)} placeholder="Tem um código de convite?" aria-label="Código de convite"
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCode(); } }} className="h-11 min-w-0" autoComplete="off" autoCapitalize="characters" />
                            <Button type="button" variant="outline" className="h-11 shrink-0" onClick={applyCode} disabled={applying || !codeText.trim()}>
                                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                            </Button>
                        </div>
                    )}

                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                        <p className="flex items-center gap-2"><Smartphone className="h-4 w-4 shrink-0" /> M-Pesa e e-Mola: envio directo · conta activada em até 20 minutos após o comprovativo ({MANUAL_CONFIRM_HOURS})</p>
                        <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0" /> Cartão Visa/Mastercard: pagamento seguro via ZumboPay · conta activada na hora</p>
                    </div>
                    {ends && !isReadOnly && <p className="text-xs text-muted-foreground">Pagar antes do fim não perde dias: o novo período começa a {fmtDate(ends)}.</p>}
                </>
            )}

            {history.length > 0 && (
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagamentos</p>
                    <div className="overflow-hidden rounded-2xl border">
                        {history.map((h) => (
                            <div key={h.reference} className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm last:border-0">
                                <div className="min-w-0">
                                    <p className="font-medium">{h.tier ? `${tierLabel(h.tier)} · ` : ""}{PLANS.find((p) => p.id === h.planId)?.label || h.planId}{h.amount ? ` · ${formatCurrency(h.amount)}` : ""}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })} · ref. {h.reference}{h.periodEnd ? ` · até ${fmtDate(h.periodEnd)}` : ""}</p>
                                </div>
                                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                                    h.status === "paid" ? "bg-emerald-500/15 text-emerald-600" : h.status === "pending" ? "bg-sky-500/15 text-sky-600" : "bg-red-500/15 text-red-600")}>
                                    {h.status === "paid" ? "pago" : h.status === "pending" ? (h.provider === "manual" ? "a confirmar" : "pendente") : h.provider === "manual" ? "recusado" : "falhou"}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function BillingPage() {
    return <Suspense fallback={null}><BillingInner /></Suspense>;
}
