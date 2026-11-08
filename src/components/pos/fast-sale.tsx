"use client";

import { haul } from "@/lib/haul";
import { getAfterSale } from "@/lib/after-sale";
import { AfterSaleDialog, printSale, type DoneSale } from "@/components/pos/after-sale-dialog";
import { LocationSelectItems } from '@/components/ui/location-select-items';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useInventory } from "@/context/inventory-context";
import { useCRM } from "@/context/crm-context";
import { useToast } from "@/hooks/use-toast";
import { useKeepFocusedAboveBar, useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatCurrency, normalizeString, plural } from "@/lib/utils";
import type { CartItem, Product, Sale } from "@/lib/types";
import { parseQuickInput, searchProducts, toNumber } from "@/lib/quick-stock";
import { posTotals } from "@/lib/pos-totals";
import { softFocus } from "@/lib/keyboard";
import { habitualLocation, recordLocation } from "@/lib/habitual-location";
import { variantChoice, variantLabel } from "@/lib/variants";
import { VariantChooser, chooserKey } from "@/components/catalog/variant-chooser";
import { Check, ChevronDown, ChevronUp, GraduationCap, LayoutGrid, Loader2, MapPin, Minus, Plus, ScanBarcode, Search, ShoppingCart, Trash2, Truck, X } from "lucide-react";
import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { UNKNOWN_CODE } from "@/lib/scan-gate";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { VoiceButton } from "@/components/scan/voice-button";
import { findByBarcode, looksLikeBarcode, normalizeBarcode } from "@/lib/barcode";
import { findBarcodeClash } from "@/lib/catalog-view";
import { parseVoice } from "@/lib/voice-parse";
import { resolveVoice } from "@/lib/voice-approx";
import { VoiceConfirm, type VoiceAsk } from "@/components/scan/voice-confirm";
import { useBarcodeLink } from "@/hooks/use-barcode-link";
import { useCuring } from "@/hooks/use-curing";
import { isCountableSale } from '@/lib/sale-filters';
import { DEMO_PRODUCTS, markDemoSaleDone } from '@/lib/demo-data';

type Line = {
    key: string;
    productId: string;
    name: string;
    unit: string;
    qty: number;
    price: number;
    cost: number;
    available: number;
    /** pronto para levar hoje (descontado o que ainda seca); só existe se a empresa usa secagem */
    ready?: number;
    readyAt?: string;
    location: string;
    /** Habitual price when added — a different price will need the manager's confirmation */
    ref?: number;
};

const PAYMENTS = ["Numerário", "M-Pesa", "e-Mola", "Transferência", "POS / Cartão"];
const DOCS: Sale["documentType"][] = ["Venda a Dinheiro", "Factura", "Recibo", "Guia de Remessa", "Factura Proforma"];
const fmtQ = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("pt-PT", { maximumFractionDigits: 2 }));
const todayISO = () => new Date().toISOString().slice(0, 10);

function load<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}
function save(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* storage unavailable */
    }
}

export function FastSale() {
    const { products, catalogProducts, sales, locations, isMultiLocation, companyId, user, addBulkSale, isReadOnly, companyData } = useInventory();
    const { customers, addCustomer } = useCRM();
    const { toast } = useToast();
    // Teclado aberto no telemóvel: a barra de confirmar sobe e fica por cima dele.
    const keyboardInset = useKeyboardInset();
    useKeepFocusedAboveBar(keyboardInset, 96);

    const [location, setLocation] = useState("");
    const [text, setText] = useState("");
    const [highlight, setHighlight] = useState(0);
    const [lines, setLines] = useState<Line[]>([]);
    const [client, setClient] = useState("");
    const [pickedUp, setPickedUp] = useState(true);
    const [payment, setPayment] = useState(PAYMENTS[0]);
    const [paidText, setPaidText] = useState("");
    const [date, setDate] = useState(todayISO());
    const [more, setMore] = useState(false);
    const [docType, setDocType] = useState<Sale["documentType"]>("Venda a Dinheiro");
    const [discountText, setDiscountText] = useState("");
    const [vatText, setVatText] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [lastSale, setLastSale] = useState<{ total: number; items: number; client: string } | null>(null);
    const [done, setDone] = useState<DoneSale | null>(null);
    const [scanOpen, setScanOpen] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    /** código lido que ainda não pertence a nenhum produto: o próximo produto tocado fica com ele */
    const [pendingCode, setPendingCode] = useState<string | null>(null);
    const [listening, setListening] = useState("");
    const [voiceAsks, setVoiceAsks] = useState<VoiceAsk[]>([]);
    const { link: linkBarcode, canLink } = useBarcodeLink();
    const curingInfo = useCuring();
    const fmtDay = (d: Date) => d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });

    const searchRef = useRef<HTMLInputElement>(null);
    const qtyRefs = useRef<Map<string, HTMLInputElement>>(new Map());
    // /pos?demo=1: venda de demonstração — produtos fictícios e nada é gravado (nem venda, nem stock, nem cliente)
    const searchParams = useSearchParams();
    const demo = searchParams?.get("demo") === "1";
    const [demoDone, setDemoDone] = useState<{ total: number; items: number; client: string } | null>(null);
    const cartKey = companyId && !demo ? `majorstockx-fastsale-${companyId}` : "";

    useEffect(() => {
        if (location || !locations.length) return;
        setLocation(habitualLocation(locations.map((l) => l.id)) || locations[0].id);
    }, [locations, location]);

    // Keep the cart on the device (page reload, phone locked, bad connection)
    const [restored, setRestored] = useState(false);
    useEffect(() => {
        if (!cartKey) return;
        setLines(load<Line[]>(cartKey, []));
        setRestored(true);
    }, [cartKey]);
    useEffect(() => {
        if (cartKey) save(cartKey, lines);
    }, [cartKey, lines]);
    // ao entrar na demonstração começa com o carrinho vazio (o carrinho verdadeiro fica guardado e volta ao sair)
    useEffect(() => {
        if (!demo) return;
        setLines([]); setClient(""); setPaidText(""); setDiscountText(""); setNotes(""); setText(""); setDemoDone(null); setLastSale(null);
    }, [demo]);

    const scoped = useMemo(() => {
        if (demo) return DEMO_PRODUCTS;
        const list = products.filter((p) => !p.deletedAt);
        return isMultiLocation && location ? list.filter((p) => (p.location || "") === location) : list;
    }, [products, isMultiLocation, location, demo]);

    const catalogPrice = useMemo(() => {
        const m = new Map<string, number>();
        catalogProducts.forEach((c) => c.price && m.set(normalizeString(c.name), c.price));
        return m;
    }, [catalogProducts]);
    const priceOf = useCallback((p: Product) => p.price || catalogPrice.get(normalizeString(p.name)) || 0, [catalogPrice]);
    const avail = (p: Product) => (p.stock || 0) - (p.reservedStock || 0);

    // Most sold in the last 90 days — one tap away when the search is empty
    const favourites = useMemo(() => {
        const since = Date.now() - 90 * 86_400_000;
        const count = new Map<string, number>();
        sales.forEach((s) => {
            const d = new Date(s.date).getTime();
            if (d >= since && isCountableSale(s)) count.set(normalizeString(s.productName), (count.get(normalizeString(s.productName)) || 0) + 1);
        });
        const ranked = [...scoped].filter((p) => avail(p) > 0).sort((a, b) => (count.get(normalizeString(b.name)) || 0) - (count.get(normalizeString(a.name)) || 0) || avail(b) - avail(a));
        return ranked.slice(0, 10);
    }, [sales, scoped]);

    const names = useMemo(() => scoped.map((p) => p.name), [scoped]);
    const parsed = useMemo(() => parseQuickInput(text, names), [text, names]);
    const results = useMemo(() => searchProducts(scoped, parsed.term, 8), [scoped, parsed.term]);
    // Enter escolhe o primeiro que se pode vender — não um esgotado que aparece no topo.
    useEffect(() => setHighlight(Math.max(0, results.findIndex((p) => avail(p) > 0))), [parsed.term]); // eslint-disable-line react-hooks/exhaustive-deps

    // O disponível mostrado no carrinho acompanha o stock actual (outra venda pode ter mexido nele); a linha guarda o do momento em que entrou.
    const liveAvail = (l: { key: string; available: number }) => { const p = scoped.find((x) => `${x.name}|${x.location || ""}` === l.key); return p ? avail(p) : l.available; };
    const inCart = (p: Product) => lines.find((l) => l.key === `${p.name}|${p.location || ""}`);

    const focusQty = (key: string) =>
        requestAnimationFrame(() => {
            const el = qtyRefs.current.get(key);
            if (el) {
                el.focus();
                el.select();
            }
        });
    // No telemóvel o teclado só abre quando a pessoa toca no campo (ver lib/keyboard); no computador volta à pesquisa.
    const focusSearch = () => requestAnimationFrame(() => softFocus(searchRef.current));
    /** o nome continua escrito mas seleccionado: tocar noutra variação, ou escrever por cima outro produto */
    const selectSearch = () => requestAnimationFrame(() => softFocus(searchRef.current, true));
    // Ao entrar: computador → cursor na pesquisa (leitor de código de barras, escrever logo); telemóvel → sem teclado.
    useEffect(() => { softFocus(searchRef.current); }, []);

    const add = (p: Product, qty?: number | null, quiet = false) => {
        const a = avail(p);
        if (a <= 0) {
            toast({ variant: "destructive", title: "Esgotado", description: `${p.name} não tem stock disponível${isMultiLocation ? " nesta localização" : ""}.` });
            return;
        }
        const key = `${p.name}|${p.location || ""}`;
        const exists = lines.find((l) => l.key === key);
        const q = qty != null && qty > 0 ? qty : exists ? exists.qty + 1 : 1;
        setLines((prev) => {
            const cur = prev.find((l) => l.key === key);
            if (cur) return prev.map((l) => (l.key === key ? { ...l, qty: qty != null && qty > 0 ? qty : l.qty + 1 } : l));
            return [
                ...prev,
                { key, productId: p.sourceIds?.[0] || p.id || "", name: p.name, unit: p.unit || "un", qty: q, price: priceOf(p), cost: p.cost || 0, available: a, ready: curingInfo.enabled ? Math.max(0, a - curingInfo.curing(p.name, p.location)) : undefined, readyAt: curingInfo.enabled ? curingInfo.nextReady(p.name, p.location)?.toISOString() : undefined, location: p.location || "", ref: p.price || 0 },
            ];
        });
        // variações da mesma família na lista ("pavê borbulha"): o nome fica escrito para juntar a próxima
        const keep = !!p.variantGroup && !!parsed.term && results.some((x) => x !== p && x.variantGroup === p.variantGroup);
        setText(keep ? parsed.term : "");
        if (quiet) return;
        if (qty != null && qty > 0) { if (keep) selectSearch(); else focusSearch(); }
        else focusQty(key); // added 1 — cursor goes to the quantity so the number can be typed straight away
    };

    const pickProduct = (p: Product, qty?: number | null) => {
        if (pendingCode && !demo) {
            const ok = linkBarcode(p, pendingCode);
            toast({ title: ok ? `Código ligado a ${p.name}` : "Não foi possível guardar o código", description: ok ? "Da próxima vez basta ler." : "Sem permissão para editar produtos — a venda continua." });
            setPendingCode(null);
        }
        add(p, qty);
    };

    // "/pos?add=Cimento" (vem do assistente da primeira venda): o produto já entra no carrinho, só falta confirmar
    const preloaded = useRef(false);
    useEffect(() => {
        if (preloaded.current || typeof window === "undefined" || !restored) return; // espera pelo carrinho guardado, para não ser substituído por ele
        const wanted = new URLSearchParams(window.location.search).get("add");
        if (!wanted) { preloaded.current = true; return; }
        const p = scoped.find((x) => normalizeString(x.name) === normalizeString(wanted));
        if (!p) return; // os produtos ainda estão a chegar
        preloaded.current = true;
        window.history.replaceState(null, "", window.location.pathname);
        add(p, 1, true);
    });

    /** Código lido (câmara ou leitor): junta o produto, ou guarda o código para associar ao próximo produto escolhido. */
    const handleCode = (raw: string, fromCamera = false): string | undefined => {
        const code = normalizeBarcode(raw);
        const p = findByBarcode(scoped, code, location);
        if (p) {
            if (avail(p) <= 0) {
                toast({ variant: "destructive", title: "Esgotado", description: `${p.name} não tem stock disponível.` });
                return `✗ ${p.name} — esgotado`;
            }
            const have = inCart(p)?.qty || 0;
            add(p, have + 1, true);
            setText("");
            return `✓ ${p.name} × ${fmtQ(have + 1)}`;
        }
        // Está no catálogo mas ainda não há stock: diz o produto em vez de "código novo"
        const inCatalog = findBarcodeClash((catalogProducts || []).filter((c) => !c.deletedAt), code);
        if (inCatalog) {
            toast({ variant: "destructive", title: "Sem stock", description: `${inCatalog.name} está no catálogo mas ainda não tem stock para vender.` });
            return `✗ ${inCatalog.name} — sem stock`;
        }
        // com a câmara: pode ter sido mal lido — o leitor fica aberto a pedir para tentar de novo
        if (fromCamera) return UNKNOWN_CODE;
        linkCode(code);
        return undefined;
    };

    const linkCode = (code: string) => {
        setPendingCode(code);
        setText("");
        setScanOpen(false);
        toast({ title: "Código novo", description: canLink ? "Ainda não está ligado a nenhum produto. Toque no produto certo para o associar." : "Ainda não está ligado a nenhum produto. Peça a quem gere o inventário para o associar." });
        focusSearch();
    };

    const handleVoice = (transcript: string) => {
        setListening("");
        const items = parseVoice(transcript, scoped.map((p) => p.name));
        if (!items.length) return;
        const done: string[] = [];
        const missed: string[] = [];
        const asks: VoiceAsk[] = [];
        for (const it of items) {
            const r = resolveVoice(scoped, it);
            if (r.kind === "none") { missed.push(it.term); continue; }
            if (r.kind === "confirm") { asks.push({ id: `${Date.now()}-${asks.length}`, said: it.term, qty: it.qty ?? 1, options: r.options }); continue; }
            const hit = r.product;
            if (avail(hit) <= 0) { missed.push(`${hit.name} (esgotado)`); continue; }
            add(hit, it.qty ?? 1, true);
            done.push(`${fmtQ(it.qty ?? 1)} × ${hit.name}`);
        }
        if (asks.length) setVoiceAsks((q) => [...q, ...asks]);
        if (!done.length && !missed.length) return; // só há perguntas: a janela de confirmação já aparece
        toast({
            variant: missed.length && !done.length ? "destructive" : undefined,
            title: done.length ? `Juntei: ${done.join(", ")}` : "Não encontrei esse produto",
            description: missed.length ? `Não encontrei: ${missed.join(", ")}. Disse: “${transcript}”.${missed.some((m) => /\d/.test(m)) ? " Pode dizer, por exemplo, «15 unidades de afiador» ou «cimento x 20»." : ""}` : undefined,
        });
    };

    // "pavê 20" + Enter numa família com várias variações: pergunta qual (em vez de juntar a primeira)
    const [choice, setChoice] = useState<{ options: Product[]; qty: number | null } | null>(null);
    useEffect(() => setChoice(null), [parsed.term]);
    const choiceRows = (choice?.options || []).map((p) => {
        const a = avail(p);
        return { key: p.instanceId, label: variantLabel(p), sub: a <= 0 ? "Esgotado" : `${fmtQ(a)} ${p.unit || "un"}`, right: priceOf(p) ? formatCurrency(priceOf(p)) : undefined, disabled: a <= 0 };
    });
    const pickChoice = (key: string) => {
        const p = choice?.options.find((o) => o.instanceId === key);
        if (!p) return;
        pickProduct(p, choice?.qty);
        setChoice(null);
    };
    const enterPick = (p: Product) => {
        const opts = variantChoice(parsed.term, p, scoped);
        if (opts.length) { setChoice({ options: opts, qty: parsed.qty ?? null }); return; }
        pickProduct(p, parsed.qty);
    };

    const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (choice && chooserKey(e, choiceRows, pickChoice, () => setChoice(null))) return;
        if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0))); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
        else if (e.key === "Enter") {
            e.preventDefault();
            // leitor USB/Bluetooth: escreve o código e carrega Enter
            if (looksLikeBarcode(text)) { handleCode(text); return; }
            if (results[highlight]) enterPick(results[highlight]);
        }
        else if (e.key === "Escape") setText("");
    };

    const setLine = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    const remove = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

    const subtotal = lines.reduce((t, l) => t + l.qty * l.price, 0);
    const { discount, discountInput, vatPercentage, vat, total } = posTotals(subtotal, discountText, vatText);
    const paid = paidText.trim() === "" ? total : Math.max(0, toNumber(paidText) || 0);
    const debt = Math.max(0, total - paid);
    const change = Math.max(0, paid - total);
    const overStock = lines.filter((l) => l.qty > liveAvail(l));
    const zeroPrice = lines.filter((l) => !(l.price > 0));
    const isProforma = docType === "Factura Proforma";
    // Betão ainda a secar não se carrega hoje: só se vende como "levanta depois".
    const overReady = curingInfo.enabled && !isProforma ? lines.filter((l) => l.ready !== undefined && l.qty > l.ready) : [];
    const blockedByCuring = pickedUp ? overReady : [];
    const canConfirm = lines.length > 0 && !saving && (isProforma || overStock.length === 0) && zeroPrice.length === 0 && blockedByCuring.length === 0 && (debt === 0 || client.trim().length > 0);

    const customerNames = useMemo(() => Array.from(new Set(customers.map((c) => c.name))).sort((a, b) => a.localeCompare(b, "pt")), [customers]);

    const confirm = async () => {
        if (demo) {
            if (!canConfirm) return;
            // demonstração: mostra como ficaria, sem gravar nada
            setDemoDone({ total, items: lines.length, client: client.trim() });
            markDemoSaleDone(companyId);
            setLines([]); setClient(""); setPaidText(""); setDiscountText(""); setVatText(""); setNotes(""); setPickedUp(true); setDocType("Venda a Dinheiro"); setMore(false);
            return;
        }
        if (isReadOnly) {
            toast({ variant: "destructive", title: "Conta em modo leitura", description: "Contacte o suporte para reactivar o acesso completo." });
            return;
        }
        if (!canConfirm || !addBulkSale || !user) return;
        setSaving(true);
        try {
            const name = client.trim();
            const firstEver = sales.length === 0; // a primeira venda da empresa: mostra "como a app funciona"
            // a barra puxada pelo carrinho enquanto grava
            let phone: string | undefined;
            const finished = await haul("sale", "A registar a venda…", "Venda registada", async () => {
                let customerId: string | undefined;
                if (name) {
                    const existing = customers.find((c) => normalizeString(c.name) === normalizeString(name));
                    if (existing) { customerId = existing.id; phone = existing.phone; }
                    else {
                        try { customerId = (await addCustomer({ name })) || undefined; } catch { /* sale still goes through */ }
                    }
                }
                const items: CartItem[] = lines.map((l) => ({
                    productId: l.productId,
                    productName: l.name,
                    quantity: l.qty,
                    unitPrice: l.price,
                    originalCost: l.cost,
                    unit: l.unit,
                    location: l.location || undefined,
                    subtotal: l.qty * l.price,
                }));
                const isToday = date === todayISO();
                const created = await addBulkSale(items, {
                    customerId,
                    clientName: name,
                    documentType: docType,
                    notes: notes.trim() || undefined,
                    discount: discountInput,
                    applyVat: vat > 0,
                    vatPercentage: vat > 0 ? vatPercentage : 0,
                    isPickedUp: pickedUp,
                    date: isToday ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString(),
                    paymentMethod: payment,
                    amountPaid: isProforma ? 0 : Math.min(paid, total),
                });
                return { sales: created || [], items };
            });
            recordLocation(location);
            if (firstEver) toast({ title: "🎉 Primeira venda registada!", description: "Está no Histórico de Vendas, com o documento para imprimir ou enviar." });
            setLastSale({ total, items: lines.length, client: name });
            // "E agora?": WhatsApp, imprimir, PDF… — ou imprime logo, se este aparelho foi marcado assim
            const doneSale: DoneSale = { sales: finished.sales, items: finished.items, total, client: name, phone };
            const ask = finished.sales.length > 0 && getAfterSale() === "ask";
            if (ask) setDone(doneSale);
            else if (finished.sales.length > 0) printSale(doneSale, companyData);
            setLines([]);
            setClient("");
            setPaidText("");
            setDiscountText("");
            setVatText("");
            setNotes("");
            setPickedUp(true);
            setDocType("Venda a Dinheiro");
            if (!ask) focusSearch();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Tente de novo.";
            toast({ variant: "destructive", title: "A venda não foi registada", description: msg });
        } finally {
            setSaving(false);
        }
    };

    const locName = (id: string) => locations.find((l) => l.id === id)?.name || "—";

    // Atalhos (teclado físico): F2 pesquisar · F8 câmara · Ctrl+Enter finalizar · Alt+1…5 forma de pagamento
    const shortcutRef = useRef({ confirm, canConfirm });
    useEffect(() => { shortcutRef.current = { confirm, canConfirm }; });
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
            else if (e.key === "F8") { e.preventDefault(); setScanOpen(true); }
            else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { if (shortcutRef.current.canConfirm) { e.preventDefault(); shortcutRef.current.confirm(); } }
            else if (e.altKey && /^[1-5]$/.test(e.key)) { e.preventDefault(); setPayment(PAYMENTS[Number(e.key) - 1]); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <div className="mx-auto w-full max-w-3xl pb-44">
            <AfterSaleDialog done={done} onClose={(typed) => { setDone(null); if (typed) setText(typed); focusSearch(); }} />
            <BarcodeScanner open={scanOpen} onClose={() => { setScanOpen(false); focusSearch(); }} onScan={(c) => handleCode(c, true)} onUnknown={canLink ? linkCode : undefined} />
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Venda Rápida</h1>
                    <p className="text-xs text-muted-foreground">Escreva, leia o código de barras ou dite — Enter junta ao carrinho.</p>
                    <p className="hidden text-[11px] text-muted-foreground/70 md:block">Atalhos: F2 pesquisar · F8 câmara · Ctrl+Enter finalizar · Alt+1…5 pagamento</p>
                </div>
                <div className="flex shrink-0 gap-2">
                    {curingInfo.enabled && (
                        <Button asChild variant="outline" size="sm">
                            <Link href="/sales/carga"><Truck className="mr-1.5 h-4 w-4" />Carga</Link>
                        </Button>
                    )}
                    <Button asChild variant="outline" size="sm" data-tour="pos-catalog">
                        <Link href="/pos/catalogo"><LayoutGrid className="mr-1.5 h-4 w-4" />Vender por toque</Link>
                    </Button>
                </div>
            </div>

            {isMultiLocation && locations.length > 0 && (
                <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger className="mt-3 h-11"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Localização" /></SelectTrigger>
                    <SelectContent><LocationSelectItems locations={locations} /></SelectContent>
                </Select>
            )}

            {demo && (
                <div data-tour="pos-demo-banner" className="mt-3 rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 p-3">
                    <div className="flex items-start gap-2.5">
                        <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-amber-700 dark:text-amber-400">Modo demonstração</p>
                            <p className="text-sm">Os produtos são de exemplo e <b>nada do que fizer aqui é gravado</b>: nem vendas, nem stock, nem clientes. Experimente à vontade.</p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="shrink-0"><Link href="/pos">Sair</Link></Button>
                    </div>
                </div>
            )}

            {demo && demoDone && lines.length === 0 && (
                <div data-tour="pos-demo-done" className="mt-3 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 p-4">
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">✓ Venda de demonstração concluída</p>
                    <p className="mt-0.5 text-sm">{formatCurrency(demoDone.total)} · {plural(demoDone.items, "produto", "produtos")}{demoDone.client ? ` · ${demoDone.client}` : ""}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        <li>Numa venda a sério, o <b className="text-foreground">stock desce sozinho</b>.</li>
                        <li>A venda aparece no <b className="text-foreground">Histórico de Vendas</b>, com o documento para imprimir ou enviar por WhatsApp.</li>
                        <li>O dinheiro entra no <b className="text-foreground">Financeiro</b> e conta para os relatórios.</li>
                    </ul>
                    <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">Esta foi só uma demonstração: nada foi gravado.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => { setDemoDone(null); focusSearch(); }}>Repetir a demonstração</Button>
                        <Button asChild size="sm"><Link href="/pos">Sair da demonstração</Link></Button>
                    </div>
                </div>
            )}

            {!demo && lastSale && lines.length === 0 && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <p className="text-sm"><b className="text-emerald-600">✓ Venda registada</b> · {formatCurrency(lastSale.total)}{lastSale.client ? ` · ${lastSale.client}` : ""}</p>
                    <button type="button" aria-label="Fechar" onClick={() => setLastSale(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
            )}

            {/* Search */}
            <div className="sticky top-0 z-20 -mx-4 mt-3 bg-background px-4 py-2">
                <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1" data-tour="pos-search">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        ref={searchRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={onSearchKey}
                        placeholder="Ex.: bloco 15 x 200"
                        className="h-14 rounded-2xl pl-12 pr-10 text-lg sm:h-14 sm:pl-12 sm:pr-10 sm:text-lg"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="go"
                    />
                    {text && (
                        <button type="button" aria-label="Limpar" onClick={() => { setText(""); focusSearch(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
                    )}
                </div>
                <button
                    type="button"
                    data-tour="pos-scan"
                    aria-label="Ler código de barras com a câmara"
                    title="Ler código de barras (F8)"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setScanOpen(true)}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-card text-muted-foreground hover:text-foreground"
                >
                    <ScanBarcode className="h-6 w-6" />
                </button>
                <span data-tour="pos-voice" className="shrink-0"><VoiceButton className="h-14 w-14" onInterim={setListening} onResult={handleVoice} onProblem={(m) => { setListening(""); toast({ variant: "destructive", title: "Ditado", description: m }); }} /></span>
                </div>
                {listening && <p className="mt-1.5 px-1 text-sm italic text-muted-foreground">🎙 {listening}</p>}
                <VoiceConfirm
                    asks={voiceAsks}
                    fmt={fmtQ}
                    note={(p) => (avail(p) <= 0 ? "Esgotado" : `Disponível: ${fmtQ(avail(p))} ${p.unit || "un"}`)}
                    onClose={() => setVoiceAsks([])}
                    onSkip={(a) => setVoiceAsks((q) => q.filter((x) => x.id !== a.id))}
                    onPick={(a, prod) => {
                        if (avail(prod) <= 0) { toast({ variant: "destructive", title: `${prod.name} está esgotado` }); return; }
                        add(prod, a.qty, true);
                        setVoiceAsks((q) => q.filter((x) => x.id !== a.id));
                        toast({ title: `Juntei: ${fmtQ(a.qty)} × ${prod.name}` });
                    }}
                />
                {pendingCode && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                        <span>Código <b className="tabular-nums">{pendingCode}</b> ainda sem produto — {canLink ? "escreva o nome e toque no produto certo para o associar." : "peça a quem gere o inventário para o associar."}</span>
                        <button type="button" aria-label="Cancelar" onClick={() => setPendingCode(null)} className="shrink-0 text-muted-foreground"><X className="h-4 w-4" /></button>
                    </div>
                )}
                {parsed.qty != null && results[highlight] && !choice && variantChoice(parsed.term, results[highlight], scoped).length > 0 ? (
                    <p className="mt-1.5 px-1 text-xs text-muted-foreground">Enter pergunta qual variação de <b className="text-foreground">{results[highlight].variantGroup}</b> ({fmtQ(parsed.qty)})</p>
                ) : parsed.qty != null && results[highlight] && !choice && (
                    <p className="mt-1.5 px-1 text-xs text-muted-foreground">Enter junta <b className="text-foreground">{fmtQ(parsed.qty)} × {results[highlight].name}</b> = {formatCurrency(parsed.qty * priceOf(results[highlight]))}</p>
                )}
            </div>

            {choice && (
                <VariantChooser
                    group={choice.options[0]?.variantGroup || ""}
                    kind={(() => { const k = Object.keys(choice.options[0]?.variantValues || {}); return k.length === 1 ? k[0].toLowerCase() : undefined; })()}
                    qty={choice.qty != null ? fmtQ(choice.qty) : undefined}
                    options={choiceRows}
                    onPick={pickChoice}
                    onClose={() => { setChoice(null); focusSearch(); }}
                />
            )}

            {/* Results */}
            {parsed.term && !choice ? (
                <div className="mt-1 overflow-hidden rounded-2xl border bg-card">
                    {results.map((p, i) => {
                        const a = avail(p);
                        const c = inCart(p);
                        return (
                            <button key={p.instanceId} type="button" data-tour="pos-result" onClick={() => pickProduct(p, parsed.qty)} onMouseEnter={() => setHighlight(i)} disabled={a <= 0}
                                className={cn("flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left last:border-0 disabled:opacity-50", i === highlight && "bg-muted")}>
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{p.name}</p>
                                    <p className={cn("text-xs", a <= 0 ? "text-red-500" : "text-muted-foreground")}>{a <= 0 ? "Esgotado" : `${fmtQ(a)} ${p.unit || "un"} disponíveis`}{curingInfo.enabled && curingInfo.curing(p.name, p.location) > 0 ? ` · ${fmtQ(Math.min(a, curingInfo.curing(p.name, p.location)))} a secar` : ""}{c ? ` · no carrinho: ${fmtQ(c.qty)}` : ""}</p>
                                </div>
                                <span className={cn("shrink-0 font-semibold tabular-nums", !priceOf(p) && "text-red-500")}>{priceOf(p) ? formatCurrency(priceOf(p)) : "sem preço"}</span>
                            </button>
                        );
                    })}
                    {!results.length && <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum produto com esse nome{isMultiLocation ? ` em ${locName(location)}` : ""}.</p>}
                </div>
            ) : (
                favourites.length > 0 && (
                    <div className="mt-1" data-tour="pos-favourites">
                        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{demo ? "Produtos de exemplo" : "Mais vendidos"} — um toque junta 1</p>
                        <div className={cn("-mx-4 flex gap-2 px-4 pb-1", lines.length ? "overflow-x-auto overflow-y-hidden" : "flex-wrap")}>
                            {favourites.map((p) => (
                                <button key={p.instanceId} type="button" data-tour="pos-favourite" onClick={() => add(p)} className="shrink-0 whitespace-nowrap rounded-full border bg-card px-3 py-2 text-left text-sm hover:border-primary">
                                    <span className="font-medium">{p.name}</span>
                                    <span className="ml-1.5 text-xs text-muted-foreground">{formatCurrency(priceOf(p))} · {fmtQ(avail(p))} disp.</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )
            )}

            {/* Cart */}
            {lines.length > 0 && (
                <div className="mt-5">
                    <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><ShoppingCart className="h-3.5 w-3.5" /> Carrinho ({lines.length})</p>
                    <div className="overflow-hidden rounded-2xl border bg-card">
                        {lines.map((l) => {
                            const liveA = liveAvail(l);
                            const over = l.qty > liveA && !isProforma;
                            return (
                                <div key={l.key} data-tour="pos-cart-line" className={cn("border-b px-3 py-3 last:border-0", over && "bg-red-500/10")}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">{l.name}</p>
                                            <p className={cn("text-xs", over ? "font-semibold text-red-600" : liveA - l.qty === 0 ? "text-amber-600" : "text-muted-foreground")} data-testid="cart-available">
                                                Disponível: {fmtQ(liveA)} {l.unit}{!isProforma && !over && <> · fica{liveA - l.qty === 0 ? " 0" : ` ${fmtQ(liveA - l.qty)}`}</>}
                                            </p>
                                        </div>
                                        <button type="button" aria-label="Remover" onClick={() => remove(l.key)} className="shrink-0 p-1 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                        <div className="flex items-center rounded-xl border" data-tour="pos-qty">
                                            <button type="button" aria-label="Menos" onMouseDown={(e) => e.preventDefault()} onClick={() => (l.qty > 1 ? setLine(l.key, { qty: l.qty - 1 }) : remove(l.key))} className="h-10 w-10 text-muted-foreground"><Minus className="mx-auto h-4 w-4" /></button>
                                            <input
                                                ref={(el) => { if (el) qtyRefs.current.set(l.key, el); else qtyRefs.current.delete(l.key); }}
                                                inputMode="decimal"
                                                enterKeyHint="done"
                                                defaultValue={fmtQ(l.qty)}
                                                key={`${l.key}-${l.qty}`}
                                                onBlur={(e) => { const q = toNumber(e.target.value); if (q > 0) setLine(l.key, { qty: q }); else remove(l.key); }}
                                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); focusSearch(); } }}
                                                className="h-10 w-16 bg-transparent text-center text-base font-bold outline-none"
                                            />
                                            <button type="button" aria-label="Mais" onMouseDown={(e) => e.preventDefault()} onClick={() => setLine(l.key, { qty: l.qty + 1 })} className="h-10 w-10 text-muted-foreground"><Plus className="mx-auto h-4 w-4" /></button>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{l.unit} ×</span>
                                        <input
                                            data-tour="pos-price"
                                            aria-label={`Preço de ${l.name}`}
                                            inputMode="decimal"
                                            defaultValue={l.price ? String(l.price) : ""}
                                            placeholder="preço"
                                            key={`${l.key}-p-${l.price}`}
                                            onBlur={(e) => setLine(l.key, { price: Math.max(0, toNumber(e.target.value) || 0) })}
                                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                            className={cn("h-10 w-24 rounded-xl border bg-transparent px-2 text-right text-sm outline-none focus:border-primary", !(l.price > 0) && "border-red-500")}
                                        />
                                        <span className="ml-auto text-sm font-bold tabular-nums">{formatCurrency(l.qty * l.price)}</span>
                                    </div>
                                    {over && <p className="mt-1 text-xs font-semibold text-red-600">Só há {fmtQ(liveA)} {l.unit} disponíveis.</p>}
                                    {!(l.price > 0) && <p className="mt-1 text-xs font-semibold text-red-600">Indique o preço.</p>}
                                    {!!l.ref && l.price > 0 && Math.abs(l.price - l.ref) >= 0.01 && user?.role !== "Admin" && user?.role !== "Dono" && (
                                        <p className="mt-1 text-xs font-semibold text-amber-600">Preço habitual {formatCurrency(l.ref)} — o gestor vai ser avisado para confirmar.</p>
                                    )}
                                    {l.ref === 0 && l.price > 0 && <p className="mt-1 text-xs text-muted-foreground">Produto sem preço — este passa a ser o preço dele.</p>}
                                </div>
                            );
                        })}
                    </div>

                    {/* Checkout — all on one screen, sensible defaults */}
                    <div className="mt-4 space-y-4 rounded-2xl border bg-card p-4">
                        <div data-tour="pos-client">
                            <label className="text-xs font-semibold text-muted-foreground">Cliente {debt > 0 ? <span className="text-red-500">(obrigatório — fica a dever)</span> : "(opcional)"}</label>
                            <Input list="fastsale-customers" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nome do cliente" className="mt-1 h-11 rounded-xl" />
                            <datalist id="fastsale-customers">{customerNames.map((n) => <option key={n} value={n} />)}</datalist>
                        </div>

                        <div className="grid grid-cols-2 gap-2" data-tour="pos-pickup">
                            {[{ v: true, t: "Levou agora", d: "sai do stock" }, { v: false, t: "Levanta depois", d: "fica reservado" }].map((o) => (
                                <button key={String(o.v)} type="button" onClick={() => setPickedUp(o.v)}
                                    className={cn("rounded-xl border-2 p-2.5 text-left", pickedUp === o.v ? "border-primary bg-primary/5" : "border-border")}>
                                    <p className="text-sm font-semibold">{o.t}</p>
                                    <p className="text-[11px] text-muted-foreground">{o.d}</p>
                                </button>
                            ))}
                        </div>

                        {overReady.length > 0 && (
                            <div className={cn("rounded-xl border p-3 text-sm", pickedUp ? "border-amber-500/50 bg-amber-500/10" : "border-sky-500/40 bg-sky-500/10")}>
                                <p className="font-semibold">{pickedUp ? "Ainda a secar — não se pode levar hoje" : "Fica reservado até secar"}</p>
                                <ul className="mt-1 space-y-0.5 text-xs">
                                    {overReady.map((l) => (
                                        <li key={l.key}>
                                            {l.name}: {fmtQ(l.ready ?? 0)} prontos de {fmtQ(l.qty)}{l.readyAt ? ` · o resto fica pronto a partir de ${fmtDay(new Date(l.readyAt))}` : ""}
                                        </li>
                                    ))}
                                </ul>
                                {pickedUp && (
                                    <button type="button" onClick={() => setPickedUp(false)} className="mt-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold">
                                        Vender como “Levanta depois”
                                    </button>
                                )}
                            </div>
                        )}

                        {!isProforma && (
                            <div className="space-y-4" data-tour="pos-payment">
                                <div className="flex flex-wrap gap-1.5">
                                    {PAYMENTS.map((p) => (
                                        <button key={p} type="button" onClick={() => setPayment(p)}
                                            className={cn("h-9 rounded-full border px-3 text-sm", payment === p ? "border-primary bg-primary text-primary-foreground" : "bg-muted/40")}>{p}</button>
                                    ))}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Valor recebido</label>
                                    <Input inputMode="decimal" value={paidText} onChange={(e) => setPaidText(e.target.value)} placeholder={`${fmtQ(total)} (tudo)`} className="mt-1 h-11 rounded-xl" />
                                    {debt > 0 && <p className="mt-1 text-xs font-semibold text-amber-600">Fica a dever {formatCurrency(debt)}.</p>}
                                    {change > 0 && <p className="mt-1 text-xs font-semibold text-emerald-600">Troco: {formatCurrency(change)}</p>}
                                </div>
                            </div>
                        )}

                        <div data-tour="pos-date">
                            <label className="text-xs font-semibold text-muted-foreground">Data da venda</label>
                            <div className="mt-1 flex items-center gap-2">
                                <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} className="h-11 rounded-xl" />
                                {date !== todayISO() && <Button type="button" variant="ghost" size="sm" onClick={() => setDate(todayISO())}>Hoje</Button>}
                            </div>
                            {date !== todayISO() && <p className="mt-1 text-xs text-amber-600">A registar uma venda de {new Date(`${date}T12:00:00`).toLocaleDateString("pt-PT")}.</p>}
                        </div>

                        <button type="button" data-tour="pos-more" onClick={() => setMore((m) => !m)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                            <ChevronDown className={cn("h-4 w-4 transition", more && "rotate-180")} /> Mais opções (documento, desconto, IVA, nota)
                        </button>
                        {more && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Documento</label>
                                    <Select value={docType} onValueChange={(v) => setDocType(v as Sale["documentType"])}>
                                        <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                                        <SelectContent>{DOCS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                    </Select>
                                    {isProforma && <p className="mt-1 text-xs text-muted-foreground">Proforma não mexe no stock nem conta como venda.</p>}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Desconto (MT ou %)</label>
                                    <Input data-tour="pos-discount" value={discountText} onChange={(e) => setDiscountText(e.target.value)} placeholder="Ex.: 50 ou 10%" className="mt-1 h-11 rounded-xl" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">IVA (%)</label>
                                    <Input data-tour="pos-vat" inputMode="decimal" value={vatText} onChange={(e) => setVatText(e.target.value)} placeholder="Sem IVA" className="mt-1 h-11 rounded-xl" />
                                    {vat > 0 && <p className="mt-1 text-xs text-muted-foreground">IVA: {formatCurrency(vat)}</p>}
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-semibold text-muted-foreground">Nota</label>
                                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: entregar na obra" className="mt-1 h-11 rounded-xl" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {lines.length === 0 && !parsed.term && !lastSale && !demoDone && (
                <div className="mt-6 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Como vender em segundos</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>Escreva <b>bloco 15 x 200</b> e Enter — já está no carrinho.</li>
                        <li>Ou escreva só o nome, Enter, e digite a quantidade.</li>
                        <li>Por defeito: pago na totalidade, em numerário, levado agora, com a data de hoje. Só mude o que for diferente.</li>
                        <li>Esqueceu-se de registar vendas? Mude a <b>data da venda</b> e registe-as agora.</li>
                    </ul>
                </div>
            )}

            <Drawer open={cartOpen && lines.length > 0} onOpenChange={setCartOpen}>
                <DrawerContent>
                    <DrawerHeader className="text-left">
                        <DrawerTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Carrinho ({lines.length})</DrawerTitle>
                        <DrawerDescription>Confira o que vai vender. Preço e outras opções mudam-se na página.</DrawerDescription>
                    </DrawerHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4" data-testid="cart-sheet">
                        {lines.map((l) => {
                            const over = l.qty > liveAvail(l) && !isProforma;
                            return (
                                <div key={l.key} className={cn("flex items-center gap-2 border-b py-2.5 last:border-0", over && "text-red-600")}>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">{l.name}</p>
                                        <p className="text-xs text-muted-foreground">{l.price > 0 ? `${formatCurrency(l.price)} / ${l.unit}` : <span className="font-semibold text-red-600">sem preço</span>}{over && <span className="font-semibold text-red-600"> · mais do que o stock</span>}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center rounded-xl border">
                                        <button type="button" aria-label="Menos" onClick={() => (l.qty > 1 ? setLine(l.key, { qty: l.qty - 1 }) : remove(l.key))} className="h-9 w-9 text-muted-foreground"><Minus className="mx-auto h-4 w-4" /></button>
                                        <span className="w-10 text-center text-sm font-bold tabular-nums">{fmtQ(l.qty)}</span>
                                        <button type="button" aria-label="Mais" onClick={() => setLine(l.key, { qty: l.qty + 1 })} className="h-9 w-9 text-muted-foreground"><Plus className="mx-auto h-4 w-4" /></button>
                                    </div>
                                    <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums">{formatCurrency(l.qty * l.price)}</span>
                                </div>
                            );
                        })}
                    </div>
                    <DrawerFooter className="border-t">
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm text-muted-foreground">Total{discount > 0 ? ` (desconto ${formatCurrency(discount)})` : ""}</span>
                            <span className="text-xl font-bold tabular-nums">{formatCurrency(total)}</span>
                        </div>
                        <Button type="button" onClick={() => setCartOpen(false)} className="h-12 rounded-xl text-base">OK</Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            {/* Sticky confirm */}
            {lines.length > 0 && (
                <div className={cn("fixed inset-x-0 z-40 border-t bg-background p-3 md:bottom-0 md:left-64", !keyboardInset && "bottom-16")} style={keyboardInset ? { bottom: keyboardInset } : undefined}>
                    <div className="mx-auto flex max-w-3xl items-center gap-3">
                        {/* tocar no total mostra o carrinho todo (útil com listas grandes); "Confirmar venda" continua a confirmar logo */}
                        <button type="button" onClick={() => setCartOpen(true)} className="min-w-0 flex-1 rounded-xl text-left active:bg-muted" data-tour="pos-total" aria-label="Ver carrinho">
                            <p className="text-[11px] text-muted-foreground">{plural(lines.length, "produto", "produtos")}{discount > 0 ? ` · desconto ${formatCurrency(discount)}` : ""}{vat > 0 ? ` · IVA ${formatCurrency(vat)}` : ""}</p>
                            <p className="flex items-center gap-1 text-xl font-bold tabular-nums">{formatCurrency(total)} <ChevronUp className="h-4 w-4 text-muted-foreground" /></p>
                            <p className="text-[11px] font-semibold text-primary">Ver carrinho</p>
                        </button>
                        <Button type="button" data-tour="pos-confirm" onClick={confirm} disabled={!canConfirm} className="h-12 shrink-0 rounded-xl bg-emerald-600 px-5 text-base text-white hover:bg-emerald-700">
                            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                            {isProforma ? "Emitir proforma" : demo ? "Confirmar (demonstração)" : "Confirmar venda"}
                        </Button>
                    </div>
                    {!canConfirm && !saving && (
                        <p className="mx-auto mt-1 max-w-3xl text-xs text-red-600">
                            {overStock.length && !isProforma ? "Há produtos com mais quantidade do que o stock." : zeroPrice.length ? "Há produtos sem preço." : debt > 0 && !client.trim() ? "Escreva o nome do cliente que fica a dever." : ""}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
