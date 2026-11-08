"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, limit, onSnapshot, orderBy, query, where, writeBatch } from "firebase/firestore";
import { AlertTriangle, Check, Loader2, Undo2 } from "lucide-react";
import { useFirestore } from "@/firebase/provider";
import { useInventory } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, normalizeString } from "@/lib/utils";
import { sameLocation } from "@/lib/product-ref";

export type PriceReview = {
    id: string;
    productName: string;
    productIds: string[];
    location: string;
    unit: string;
    referencePrice: number;
    soldPrice: number;
    quantity: number;
    saleId: string;
    guideNumber: string;
    clientName: string;
    soldBy: string;
    status: "pending" | "accepted" | "rejected";
    createdAt: string;
    resolvedBy?: string;
    resolvedAt?: string;
};

// As regras (priceReviews: isAdminOf) só deixam o Administrador ler. Antes contava também o Dono e quem edita os
// Ajustes: a escuta era recusada e o Firestore rebentava ("INTERNAL ASSERTION FAILED (ca9)" → "Algo correu mal!").
function useIsManager() {
    const { user } = useInventory();
    return !!user && user.role === "Admin";
}

/** Live list of price reviews for managers. */
export function usePriceReviews(pendingOnly: boolean) {
    const firestore = useFirestore();
    const { companyId, isGuest } = useInventory();
    const isManager = useIsManager();
    const [items, setItems] = useState<PriceReview[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!companyId || !isManager || isGuest) { setItems([]); setLoading(false); return; }
        const ref = collection(firestore, `companies/${companyId}/priceReviews`);
        const q = pendingOnly ? query(ref, where("status", "==", "pending")) : query(ref, orderBy("createdAt", "desc"), limit(60));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PriceReview, "id">) }));
            list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
            setItems(list);
            setLoading(false);
        }, (e) => { console.warn("[priceReviews]", e); setLoading(false); });
    }, [firestore, companyId, isManager, isGuest, pendingOnly]);

    return { items, loading, isManager };
}

/** Banner for managers: "N sales with a different price — review". */
export function PriceReviewBanner() {
    const { items } = usePriceReviews(true);
    if (!items.length) return null;
    return (
        <Link href="/sales/precos" className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 hover:bg-amber-500/15">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <p className="min-w-0 flex-1 text-sm">
                <b>{items.length} venda(s) com preço diferente do habitual</b> — confirme qual é o preço certo.
            </p>
            <span className="shrink-0 text-sm font-semibold text-amber-600">Rever →</span>
        </Link>
    );
}

/** Manager page body. */
export function PriceReviewsPanel() {
    const firestore = useFirestore();
    const { companyId, user, products, catalogProducts, locations } = useInventory();
    const { toast } = useToast();
    const { items: pending, loading, isManager } = usePriceReviews(true);
    const { items: recent } = usePriceReviews(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [allLocations, setAllLocations] = useState(true);

    const history = useMemo(() => recent.filter((r) => r.status !== "pending").slice(0, 20), [recent]);
    const locName = (id: string) => locations.find((l) => l.id === id)?.name || id || "—";

    if (!isManager) return <p className="text-muted-foreground">Só o gestor da empresa pode confirmar preços.</p>;

    const resolve = async (r: PriceReview, accept: boolean) => {
        if (!companyId || !user) return;
        setBusy(r.id);
        try {
            const batch = writeBatch(firestore);
            const now = new Date().toISOString();
            const stamp = { resolvedBy: user.username, resolvedAt: now };
            // Close this review and any other pending one for the same product at the same sold price.
            pending
                .filter((p) => p.id === r.id || (normalizeString(p.productName) === normalizeString(r.productName) && p.soldPrice === r.soldPrice))
                .forEach((p) => batch.update(doc(firestore, `companies/${companyId}/priceReviews/${p.id}`), { status: accept ? "accepted" : "rejected", ...stamp }));

            if (accept) {
                const same = products.filter((p) => normalizeString(p.name) === normalizeString(r.productName) && (allLocations || sameLocation(p.location, r.location)));
                const ids = new Set<string>(r.productIds || []);
                same.forEach((p) => (p.sourceIds?.length ? p.sourceIds : p.id ? [p.id] : []).forEach((id) => ids.add(id)));
                ids.forEach((id) => batch.update(doc(firestore, `companies/${companyId}/products/${id}`), { price: r.soldPrice, lastUpdated: now }));
                catalogProducts
                    .filter((c) => normalizeString(c.name) === normalizeString(r.productName))
                    .forEach((c) => batch.update(doc(firestore, `companies/${companyId}/catalogProducts/${c.id}`), { price: r.soldPrice }));
            }
            await batch.commit();
            toast({
                title: accept ? "Preço actualizado" : "Mantido o preço habitual",
                description: accept
                    ? `${r.productName} passa a ${formatCurrency(r.soldPrice)}${allLocations ? " em todas as localizações" : ""}.`
                    : `${r.productName} continua a ${formatCurrency(r.referencePrice)}. Fale com ${r.soldBy} sobre a venda ${r.guideNumber}.`,
            });
        } catch (e) {
            toast({ variant: "destructive", title: "Não foi possível guardar", description: e instanceof Error ? e.message : "" });
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-24">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Confirmar preços</h1>
                <p className="text-sm text-muted-foreground">
                    Cada venda ensina o preço de venda. Quando um vendedor usa um preço diferente do habitual, a venda fica registada e o preço espera aqui pela sua decisão.
                </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allLocations} onChange={(e) => setAllLocations(e.target.checked)} className="h-4 w-4" />
                Ao aceitar, aplicar o novo preço em todas as localizações
            </label>

            {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : pending.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">✓ Nenhum preço à espera de confirmação.</div>
            ) : (
                pending.map((r) => {
                    const up = r.soldPrice > r.referencePrice;
                    const diff = r.soldPrice - r.referencePrice;
                    const pct = r.referencePrice ? Math.round((diff / r.referencePrice) * 100) : 0;
                    return (
                        <div key={r.id} className="rounded-2xl border bg-card p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-semibold">{r.productName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {r.soldBy} · venda {r.guideNumber}{r.clientName ? ` · ${r.clientName}` : ""} · {r.quantity} {r.unit}
                                        {locations.length > 1 ? ` · ${locName(r.location)}` : ""} · {new Date(r.createdAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
                                    </p>
                                </div>
                                <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", up ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600")}>
                                    {up ? "+" : ""}{pct}%
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                                <div className="rounded-xl bg-muted/50 p-2">
                                    <p className="text-[11px] text-muted-foreground">Preço habitual</p>
                                    <p className="font-bold tabular-nums">{formatCurrency(r.referencePrice)}</p>
                                </div>
                                <div className={cn("rounded-xl p-2", up ? "bg-emerald-500/10" : "bg-red-500/10")}>
                                    <p className="text-[11px] text-muted-foreground">Vendido a</p>
                                    <p className="font-bold tabular-nums">{formatCurrency(r.soldPrice)}</p>
                                </div>
                            </div>
                            {!up && (
                                <p className="mt-2 text-xs text-red-600">Diferença nesta venda: {formatCurrency(Math.abs(diff) * r.quantity)} a menos.</p>
                            )}
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <Button variant="outline" disabled={busy === r.id} onClick={() => resolve(r, false)}>
                                    <Undo2 className="mr-2 h-4 w-4" /> Manter {formatCurrency(r.referencePrice)}
                                </Button>
                                <Button disabled={busy === r.id} onClick={() => resolve(r, true)}>
                                    {busy === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Novo preço {formatCurrency(r.soldPrice)}
                                </Button>
                            </div>
                        </div>
                    );
                })
            )}

            {history.length > 0 && (
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decisões recentes</p>
                    <div className="overflow-hidden rounded-2xl border">
                        {history.map((r) => (
                            <div key={r.id} className="flex items-center justify-between gap-3 border-b px-4 py-2 text-sm last:border-0">
                                <span className="min-w-0 truncate">{r.productName} · {formatCurrency(r.soldPrice)} <span className="text-muted-foreground">(habitual {formatCurrency(r.referencePrice)}, {r.soldBy})</span></span>
                                <span className={cn("shrink-0 text-xs font-semibold", r.status === "accepted" ? "text-emerald-600" : "text-muted-foreground")}>
                                    {r.status === "accepted" ? "novo preço" : "mantido"}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
