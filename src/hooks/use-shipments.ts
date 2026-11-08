"use client";

// Envios com confirmação de receção: enviar (sai da origem, fica em trânsito), receber (entra no destino o que
// chegou; o que faltar fica como diferença) e cancelar (volta à origem). Cada passo é uma transacção.
import { useCallback, useMemo } from "react";
import { collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useInventory } from "@/context/inventory-context";
import { pickActive, sameLocation } from "@/lib/product-ref";
import { locationLabel } from "@/lib/sites";
import { receiveResult, shipmentCode, type Shipment, type ShipmentItem } from "@/lib/shipments";
import type { Product } from "@/lib/types";

export function useShipments() {
    const firestore = useFirestore();
    const { companyId, user, companyData, locations, allLocations, notifyManagers } = useInventory();
    const enabled = !!companyData?.isMultiLocation && !!companyData?.confirmTransfers;
    const ref = useMemoFirebase(
        () => (firestore && companyId && enabled ? query(collection(firestore, `companies/${companyId}/shipments`), orderBy("sentAt", "desc"), limit(300)) : null),
        [firestore, companyId, enabled],
    );
    const { data } = useCollection<Shipment>(ref);
    // só os envios que tocam os meus locais (quem tem ponto só vê os do seu ponto)
    const mine = useMemo(() => new Set((locations || []).map((l) => l.id)), [locations]);
    const shipments = useMemo(() => (data || []).filter((s) => mine.has(s.from) || mine.has(s.to)), [data, mine]);
    const locName = useCallback((id: string) => { const l = (allLocations || []).find((x) => x.id === id); return l ? locationLabel(l) : id; }, [allLocations]);

    /** O documento do produto `name` em `loc` (o activo), ou null. */
    const findDoc = useCallback(async (name: string, loc: string) => {
        const snap = await getDocs(query(collection(firestore!, `companies/${companyId}/products`), where("name", "==", name)));
        return pickActive(snap.docs.filter((d) => sameLocation(d.data().location, loc))) || null;
    }, [firestore, companyId]);

    const send = useCallback(async (from: string, to: string, items: ShipmentItem[], note?: string): Promise<string> => {
        if (!firestore || !companyId || !user) throw new Error("Sessão não carregada.");
        const origin = await Promise.all(items.map((i) => findDoc(i.name, from)));
        const code = shipmentCode(new Date());
        await runTransaction(firestore, async (tx) => {
            const snaps = await Promise.all(origin.map((d) => (d ? tx.get(d.ref) : null)));
            snaps.forEach((s, k) => {
                const it = items[k];
                if (!s?.exists()) throw new Error(`${it.name}: não há stock na origem.`);
                const p = s.data() as Product;
                const avail = (p.stock || 0) - (p.reservedStock || 0);
                if (avail < it.qty) throw new Error(`${it.name}: só há ${Math.max(0, avail)} ${it.unit} disponíveis.`);
            });
            const now = new Date().toISOString();
            snaps.forEach((s, k) => tx.update(s!.ref, { stock: ((s!.data() as Product).stock || 0) - items[k].qty, lastUpdated: now }));
            const shipRef = doc(collection(firestore, `companies/${companyId}/shipments`));
            items.forEach((it, k) => tx.set(doc(collection(firestore, `companies/${companyId}/stockMovements`)), {
                productId: origin[k]!.id, productName: it.name, type: "TRANSFER", quantity: it.qty, fromLocationId: from,
                reason: `Envio ${code} para ${locName(to)} (em trânsito)`, userId: user.id, userName: user.username, timestamp: serverTimestamp(),
            }));
            tx.set(shipRef, {
                code, status: "em_transito", from, to, items: items.map(({ name, unit, qty }) => ({ name, unit, qty })),
                sentBy: user.id, sentByName: user.username, sentAt: now, ...(note ? { note } : {}),
            });
        });
        notifyManagers?.({ title: `Envio ${code} em trânsito`, body: `${user.username}: ${locName(from)} → ${locName(to)} · ${items.map((i) => `${i.qty} ${i.unit} ${i.name}`).join(", ")}`, link: "/inventory/transfer?tab=receber", type: "stock" });
        return code;
    }, [firestore, companyId, user, findDoc, locName, notifyManagers]);

    const receive = useCallback(async (s: Shipment, received: Record<string, number>, note?: string) => {
        if (!firestore || !companyId || !user) throw new Error("Sessão não carregada.");
        const r = receiveResult(s.items, received);
        const dest = await Promise.all(s.items.map((i) => findDoc(i.name, s.to)));
        const src = await Promise.all(s.items.map((i, k) => (dest[k] ? null : findDoc(i.name, s.from))));
        await runTransaction(firestore, async (tx) => {
            const shipRef = doc(firestore, `companies/${companyId}/shipments/${s.id}`);
            const cur = await tx.get(shipRef);
            if (!cur.exists() || cur.data().status !== "em_transito") throw new Error("Este envio já foi recebido ou cancelado.");
            const destSnaps = await Promise.all(dest.map((d) => (d ? tx.get(d.ref) : null)));
            const now = new Date().toISOString();
            r.items.forEach((it, k) => {
                const qty = it.received || 0;
                if (qty <= 0) return;
                const ds = destSnaps[k];
                let pid: string;
                if (ds?.exists()) {
                    tx.update(ds.ref, { stock: ((ds.data() as Product).stock || 0) + qty, lastUpdated: now });
                    pid = ds.id;
                } else {
                    // o produto ainda não existe no destino: cria-se com os dados da origem
                    const base = (src[k]?.data() || {}) as Product;
                    const { id: _i, instanceId: _n, stock: _s, reservedStock: _r, location: _l, lastUpdated: _u, ...rest } = base as any;
                    const nref = doc(collection(firestore, `companies/${companyId}/products`));
                    tx.set(nref, { ...rest, name: it.name, unit: it.unit, location: s.to, stock: qty, reservedStock: 0, lastUpdated: now });
                    pid = nref.id;
                }
                tx.set(doc(collection(firestore, `companies/${companyId}/stockMovements`)), {
                    productId: pid, productName: it.name, type: "TRANSFER", quantity: qty, toLocationId: s.to,
                    reason: `Receção ${s.code} de ${locName(s.from)}${qty < it.qty ? ` (faltaram ${+(it.qty - qty).toFixed(4)})` : ""}`,
                    userId: user.id, userName: user.username, timestamp: serverTimestamp(),
                });
            });
            tx.update(shipRef, {
                status: r.status, items: r.items, receivedBy: user.id, receivedByName: user.username, receivedAt: now, ...(note ? { receiveNote: note } : {}),
            });
        });
        if (r.missing.length) {
            notifyManagers?.({ title: `Diferença no envio ${s.code}`, body: `Faltaram ${r.missing.map((m) => `${m.qty} ${m.unit} ${m.name}`).join(", ")} (${locName(s.from)} → ${locName(s.to)}; enviou ${s.sentByName}, recebeu ${user.username}).`, link: "/inventory/transfer?tab=historico", type: "stock", always: true });
        }
        return r;
    }, [firestore, companyId, user, findDoc, locName, notifyManagers]);

    const cancel = useCallback(async (s: Shipment) => {
        if (!firestore || !companyId || !user) throw new Error("Sessão não carregada.");
        const origin = await Promise.all(s.items.map((i) => findDoc(i.name, s.from)));
        await runTransaction(firestore, async (tx) => {
            const shipRef = doc(firestore, `companies/${companyId}/shipments/${s.id}`);
            const cur = await tx.get(shipRef);
            if (!cur.exists() || cur.data().status !== "em_transito") throw new Error("Este envio já foi recebido ou cancelado.");
            const snaps = await Promise.all(origin.map((d) => (d ? tx.get(d.ref) : null)));
            const now = new Date().toISOString();
            s.items.forEach((it, k) => {
                const os = snaps[k];
                if (!os?.exists()) throw new Error(`${it.name}: o produto de origem já não existe.`);
                tx.update(os.ref, { stock: ((os.data() as Product).stock || 0) + it.qty, lastUpdated: now });
                tx.set(doc(collection(firestore, `companies/${companyId}/stockMovements`)), {
                    productId: os.id, productName: it.name, type: "TRANSFER", quantity: it.qty, toLocationId: s.from,
                    reason: `Envio ${s.code} cancelado (voltou à origem)`, userId: user.id, userName: user.username, timestamp: serverTimestamp(),
                });
            });
            tx.update(shipRef, { status: "cancelado", receivedBy: user.id, receivedByName: user.username, receivedAt: now });
        });
    }, [firestore, companyId, user, findDoc]);

    return { enabled, shipments, send, receive, cancel, locName, mine };
}
