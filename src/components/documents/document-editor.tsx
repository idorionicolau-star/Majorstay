"use client";

import { haul } from "@/lib/haul";
import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import {
    ArrowDown, ArrowUp, Ban, Check, CheckCircle2, ChevronDown, Copy, Download, Eye, FilePlus2, Loader2, Lock, MoreHorizontal, MoreVertical, Pencil, Percent, Plus, Printer, Redo2, Save, Share2, Trash2, Undo2,
} from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { useCRM } from "@/context/crm-context";
import { useFirestore } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DocPreview } from "@/components/documents/doc-preview";
import { NumInput } from "@/components/documents/num-input";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/documents/signature-pad";
import { cn, formatCurrency } from "@/lib/utils";
import { DOCUMENT_TYPES, isQuoteLike, type DocItem, type DocumentType } from "@/lib/doc-model";
import { ACCENT_PRESETS, DOC_THEMES, rgbToHex, themeById } from "@/lib/doc-themes";
import { suggestNumber } from "@/lib/doc-number";
import { canRedo, canUndo, initHistory, pushHistory, redoHistory, undoHistory, type History } from "@/lib/undo-history";
import { CONVERT_TARGETS, docToDraft, draftToModel, draftTotals, emptyDraft, newItem, stripUndefined, validItems, type AppDocument, type DocDraft, type DocStatus } from "@/lib/app-document";
import type { Sale } from "@/lib/types";

type Act = { t: "push"; next: DocDraft; key?: string } | { t: "undo" } | { t: "redo" } | { t: "reset"; value: DocDraft };
const reducer = (h: History<DocDraft>, a: Act): History<DocDraft> =>
    a.t === "push" ? pushHistory(h, a.next, { key: a.key }) : a.t === "undo" ? undoHistory(h) : a.t === "redo" ? redoHistory(h) : initHistory(a.value);

type Save = "idle" | "saving" | "saved" | "error";
const STATUS_LABEL: Record<DocStatus, string> = { draft: "Rascunho", issued: "Emitido", cancelled: "Anulado" };
const hasContent = (d: DocDraft) => !!(d.client.name?.trim() || d.items.some((i) => i.description.trim()) || d.notes?.trim());
const ymd = (iso?: string) => (iso ? new Date(iso) : undefined);

type Props = { docId?: string; initialType?: DocumentType };

export function DocumentEditor({ docId: docIdProp, initialType }: Props) {
    const inv = useContext(InventoryContext);
    const firestore = useFirestore();
    const { customers } = useCRM();
    const router = useRouter();
    const { toast } = useToast();
    const company = inv?.companyData ?? null;
    const companyId = inv?.companyId ?? null;
    const user = inv?.user ?? null;
    const canWrite = !!inv?.canEdit?.("sales");
    const isManager = user?.role === "Admin" || user?.role === "Dono";
    const catalog = inv?.catalogProducts ?? [];

    const [docId, setDocId] = useState<string | undefined>(docIdProp);
    const [meta, setMeta] = useState<AppDocument | null>(null);
    const [loading, setLoading] = useState(!!docIdProp);
    const [missing, setMissing] = useState(false);
    const [save, setSave] = useState<Save>("idle");
    const [unlocked, setUnlocked] = useState(false);
    const [busy, setBusy] = useState("");
    const [registerSale, setRegisterSale] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [tab, setTab] = useState("content");
    const [viewStyle, setViewStyle] = useState<Partial<DocDraft["style"]>>({}); // aparência só para exportar (documento emitido)

    const [hist, dispatch] = useReducer(reducer, undefined, () => initHistory(emptyDraft(initialType || "Cotação", "", null)));
    const draft = hist.present;
    const status: DocStatus = meta?.status ?? "draft";
    const editable = canWrite && (status === "draft" || (unlocked && isManager));
    const savedJson = useRef("");
    const numberInit = useRef(false);

    const set = useCallback((patch: Partial<DocDraft>, key?: string) => {
        dispatch({ t: "push", next: { ...draft, ...patch }, key });
    }, [draft]);
    const setClient = (patch: Partial<DocDraft["client"]>, key: string) => set({ client: { ...draft.client, ...patch } }, key);
    const setStyle = (patch: Partial<DocDraft["style"]>, key: string) => {
        if (editable) set({ style: { ...draft.style, ...patch } }, key);
        else setViewStyle((v) => ({ ...v, ...patch }));
    };
    const style = useMemo(() => ({ ...draft.style, ...(editable ? {} : viewStyle) }), [draft.style, editable, viewStyle]);

    // ---------- carregar um documento existente ----------
    useEffect(() => {
        if (!docIdProp || !firestore || !companyId) return;
        let off = false;
        (async () => {
            const snap = await getDoc(doc(firestore, `companies/${companyId}/documents/${docIdProp}`));
            if (off) return;
            if (!snap.exists()) { setMissing(true); setLoading(false); return; }
            const d = { id: snap.id, ...(snap.data() as Omit<AppDocument, "id">) } as AppDocument;
            setMeta(d);
            const initial = docToDraft(d);
            savedJson.current = JSON.stringify(initial);
            dispatch({ t: "reset", value: initial });
            numberInit.current = true;
            setLoading(false);
        })().catch(() => { if (!off) { setMissing(true); setLoading(false); } });
        return () => { off = true; };
    }, [docIdProp, firestore, companyId]);

    // ---------- documento novo: número sugerido e aspecto da empresa ----------
    useEffect(() => {
        if (docIdProp || numberInit.current || !company) return;
        numberInit.current = true;
        const base = emptyDraft(draft.type, suggestNumber(draft.type, company).number, company);
        savedJson.current = JSON.stringify(base);
        dispatch({ t: "reset", value: base });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [company, docIdProp]);

    const suggested = useMemo(() => suggestNumber(draft.type, company), [draft.type, company]);
    const totals = useMemo(() => draftTotals(draft), [draft]);
    const quote = isQuoteLike(draft.type);

    // ---------- guardar (rascunho: automático) ----------
    const persist = useCallback(async (): Promise<string | undefined> => {
        if (!firestore || !companyId || !user) return undefined;
        const now = new Date().toISOString();
        const body = { ...draft, totals: draftTotals(draft), updatedAt: now };
        try {
            setSave("saving");
            let id = docId;
            if (!id) {
                const ref = doc(collection(firestore, `companies/${companyId}/documents`));
                await setDoc(ref, stripUndefined({ ...body, status: "draft", createdBy: user.username, createdAt: now }));
                id = ref.id;
                setDocId(id);
                setMeta({ ...(body as unknown as AppDocument), id, status: "draft", createdBy: user.username, createdAt: now });
            } else {
                await updateDoc(doc(firestore, `companies/${companyId}/documents/${id}`), stripUndefined(body));
            }
            savedJson.current = JSON.stringify(draft);
            setSave("saved");
            return id;
        } catch (e: any) {
            setSave("error");
            const denied = e?.code === "permission-denied";
            toast({ variant: "destructive", title: "Não foi possível guardar", description: denied ? "Sem permissão. Se é a primeira vez que usa documentos, falta publicar as regras do Firestore (ver instruções)." : e?.message });
            return undefined;
        }
    }, [firestore, companyId, user, draft, docId, toast]);

    useEffect(() => {
        if (status !== "draft" || !canWrite || !firestore || !companyId || !user) return;
        if (JSON.stringify(draft) === savedJson.current) return;
        if (!docId && !hasContent(draft)) return;
        const t = setTimeout(() => { persist(); }, 1300);
        return () => clearTimeout(t);
    }, [draft, status, canWrite, firestore, companyId, user, docId, persist]);

    // ---------- modelo do documento (pré-visualização e PDF) ----------
    const modelFor = useCallback(() => draftToModel({ ...draft, style }, company, { status, operator: user?.username }), [draft, style, company, status, user]);
    const previewModel = useMemo(() => modelFor(), [modelFor]);

    // ---------- atalhos: Ctrl+Z / Ctrl+Y ----------
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || !editable) return;
            const k = e.key.toLowerCase();
            const typing = (e.target as HTMLElement)?.tagName;
            if (k === "z" && !e.shiftKey) { if (typing === "INPUT" || typing === "TEXTAREA") return; e.preventDefault(); dispatch({ t: "undo" }); }
            else if (k === "y" || (k === "z" && e.shiftKey)) { if (typing === "INPUT" || typing === "TEXTAREA") return; e.preventDefault(); dispatch({ t: "redo" }); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [editable]);

    // ---------- exportar ----------
    const pdf = async () => {
        const { renderDocPDF } = await import("@/lib/doc-pdf");
        return renderDocPDF(modelFor(), company);
    };
    const fileName = () => `${draft.type.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_")}_${(draft.number || "rascunho").replace(/[^\w.-]+/g, "_")}.pdf`;
    const download = async () => { setBusy("pdf"); try { (await haul("document", "A preparar o PDF…", "PDF pronto", pdf)).save(fileName()); } catch (e: any) { toast({ variant: "destructive", title: "Não foi possível gerar o PDF", description: e?.message }); } finally { setBusy(""); } };
    const print = async () => {
        setBusy("print");
        try {
            const url = URL.createObjectURL((await pdf()).output("blob"));
            const f = document.createElement("iframe");
            f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
            f.src = url;
            f.onload = () => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { window.open(url, "_blank"); } setTimeout(() => { f.remove(); URL.revokeObjectURL(url); }, 60000); };
            document.body.appendChild(f);
        } finally { setBusy(""); }
    };
    const share = async () => {
        setBusy("share");
        try {
            const blob = (await pdf()).output("blob");
            const file = new File([blob], fileName(), { type: "application/pdf" });
            const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
            if (nav.canShare?.({ files: [file] })) await nav.share({ files: [file], title: `${draft.type} ${draft.number}`, text: `${draft.type} ${draft.number} — ${company?.name || ""}` });
            else { (await pdf()).save(fileName()); toast({ title: "PDF descarregado", description: "Este aparelho não partilha ficheiros directamente: envie o PDF descarregado." }); }
        } catch { /* cancelado */ } finally { setBusy(""); }
    };

    // ---------- emitir ----------
    const issue = async () => {
        if (!firestore || !companyId || !user) return;
        if (!validItems(draft.items).length) { toast({ variant: "destructive", title: "Sem artigos", description: "Adicione pelo menos um artigo com descrição e quantidade." }); return; }
        const number = draft.number.trim() || suggested.number;
        setBusy("issue");
        try {
            // um número emitido não se repete
            const dup = await getDocs(query(collection(firestore, `companies/${companyId}/documents`), where("number", "==", number), limit(5)));
            if (dup.docs.some((d) => d.id !== docId && d.get("type") === draft.type && d.get("status") !== "draft")) {
                toast({ variant: "destructive", title: "Número já usado", description: `Já existe um(a) ${draft.type} emitido(a) com o número ${number}. Escolha outro.` });
                return;
            }
            let id = docId;
            if (!id) { set({ number }); id = await persist(); if (!id) return; }
            const companyRef = doc(firestore, `companies/${companyId}`);
            const docRef = doc(firestore, `companies/${companyId}/documents/${id}`);
            const now = new Date().toISOString();
            const final = { ...draft, number };
            // a impressora a puxar a barra enquanto emite
            await haul("document", "A emitir o documento…", "Documento emitido", () => runTransaction(firestore, async (tx) => {
                const c = await tx.get(companyRef);
                if (!c.exists()) throw new Error("Empresa não encontrada.");
                const cd = c.data() as { saleCounter?: number; documentNumbering?: Record<string, { nextNumber?: number; prefix?: string }> };
                const fresh = suggestNumber(draft.type, cd as never);
                // só avança a numeração da empresa quando se usa o número que ela sugeria
                if (number === fresh.number) {
                    const cfg = cd.documentNumbering?.[draft.type];
                    tx.update(companyRef, {
                        saleCounter: (cd.saleCounter || 0) + 1,
                        ...(fresh.fromConfig && cfg?.prefix ? { [`documentNumbering.${draft.type}.nextNumber`]: (cfg.nextNumber || 1) + 1 } : {}),
                    });
                }
                tx.update(docRef, stripUndefined({ ...final, totals: draftTotals(final), status: "issued", issuedAt: now, issuedBy: user.username, updatedAt: now }));
                if (registerSale && !isQuoteLike(draft.type)) {
                    const items = validItems(final.items);
                    const t = draftTotals(final);
                    items.forEach((item, idx) => {
                        const sub = item.quantity * item.unitPrice * (1 - (item.discountPct || 0) / 100);
                        const sale: Omit<Sale, "id"> = {
                            date: final.issueDate, productId: item.description, productName: item.description, quantity: item.quantity, unit: item.unit,
                            unitPrice: item.unitPrice, subtotal: sub, discount: idx === 0 ? t.discount : 0, vat: idx === 0 ? t.vat : 0, totalValue: idx === 0 ? t.total : sub,
                            amountPaid: idx === 0 ? t.total : sub, soldBy: user.username, guideNumber: number, status: "Pago", documentType: draft.type,
                            clientName: final.client.name || undefined, notes: idx === 0 ? final.notes : undefined, transactionId: number,
                        };
                        tx.set(doc(collection(firestore, `companies/${companyId}/sales`)), stripUndefined(sale));
                    });
                }
            }));
            const issued: AppDocument = { ...(meta as AppDocument), ...(final as unknown as AppDocument), id: id!, status: "issued", number, issuedAt: now, issuedBy: user.username, totals: draftTotals(final), updatedAt: now } as AppDocument;
            setMeta(issued);
            savedJson.current = JSON.stringify(final);
            dispatch({ t: "reset", value: final });
            toast({ title: `${draft.type} ${number} emitido`, description: "O PDF foi descarregado." });
            setTimeout(() => { download(); }, 300);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Não foi possível emitir", description: e?.message });
        } finally { setBusy(""); }
    };

    // ---------- corrigir um emitido (só o gestor; fica registado) ----------
    const saveCorrection = async () => {
        if (!firestore || !companyId || !user || !docId || !meta) return;
        setBusy("fix");
        try {
            const before = docToDraft(meta);
            const changed = (Object.keys(draft) as (keyof DocDraft)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(draft[k]));
            if (!changed.length) { toast({ title: "Nada foi alterado" }); setUnlocked(false); return; }
            const now = new Date().toISOString();
            const docRef = doc(firestore, `companies/${companyId}/documents/${docId}`);
            await updateDoc(docRef, stripUndefined({ ...draft, totals: draftTotals(draft), updatedAt: now }));
            await addDoc(collection(docRef, "history"), stripUndefined({
                action: "corrigido", userId: user.id, userName: user.username, at: serverTimestamp(), number: meta.number,
                changes: Object.fromEntries(changed.map((k) => [k, { de: before[k] ?? null, para: draft[k] ?? null }])),
            }));
            setMeta({ ...meta, ...(draft as unknown as AppDocument), updatedAt: now, totals: draftTotals(draft) });
            savedJson.current = JSON.stringify(draft);
            setUnlocked(false);
            toast({ title: "Correcção guardada", description: `Ficou registado quem alterou e o quê (${changed.length} campo(s)).` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Não foi possível guardar a correcção", description: e?.message });
        } finally { setBusy(""); }
    };

    const cancelDoc = async () => {
        if (!firestore || !companyId || !user || !docId) return;
        if (cancelReason.trim().length < 3) { toast({ variant: "destructive", title: "Diga o motivo da anulação" }); return; }
        setBusy("cancel");
        try {
            const now = new Date().toISOString();
            await updateDoc(doc(firestore, `companies/${companyId}/documents/${docId}`), { status: "cancelled", cancelledAt: now, cancelledBy: user.username, cancelReason: cancelReason.trim(), updatedAt: now });
            setMeta((m) => (m ? { ...m, status: "cancelled", cancelledAt: now, cancelledBy: user.username, cancelReason: cancelReason.trim() } : m));
            setCancelOpen(false);
            toast({ title: "Documento anulado" });
        } catch (e: any) { toast({ variant: "destructive", title: "Não foi possível anular", description: e?.message }); } finally { setBusy(""); }
    };

    const discard = async () => {
        if (!firestore || !companyId || !docId || status !== "draft") { router.push("/documents"); return; }
        if (!window.confirm("Apagar este rascunho?")) return;
        await deleteDoc(doc(firestore, `companies/${companyId}/documents/${docId}`)).catch(() => { });
        router.push("/documents");
    };

    // ---------- converter / duplicar: cria um rascunho novo ----------
    const derive = async (type: DocumentType, label: string) => {
        if (!firestore || !companyId || !user) return;
        setBusy("derive");
        try {
            const now = new Date().toISOString();
            const base = { ...draft, type, number: suggestNumber(type, company).number, issueDate: now, style: { ...draft.style, watermark: undefined } };
            const ref = doc(collection(firestore, `companies/${companyId}/documents`));
            await setDoc(ref, stripUndefined({ ...base, totals: draftTotals(base), status: "draft", createdBy: user.username, createdAt: now, updatedAt: now, sourceId: docId || null, sourceNumber: draft.number || null }));
            toast({ title: `${label} criado como rascunho` });
            router.push(`/documents/${ref.id}`);
        } catch (e: any) { toast({ variant: "destructive", title: "Não foi possível criar", description: e?.message }); } finally { setBusy(""); }
    };

    // ---------- linhas ----------
    const setItem = (id: string, patch: Partial<DocItem>, key: string) => set({ items: draft.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }, `${key}:${id}`);
    const pickProduct = (id: string, name: string) => {
        const p = catalog.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
        setItem(id, p ? { description: p.name, unitPrice: p.price || 0, unit: (p.unit as string) || "un" } : { description: name }, "desc");
    };
    const moveItem = (idx: number, dir: -1 | 1) => {
        const j = idx + dir;
        if (j < 0 || j >= draft.items.length) return;
        const items = [...draft.items];
        [items[idx], items[j]] = [items[j], items[idx]];
        set({ items });
    };

    if (!inv) return null;
    if (loading) return <div className="mx-auto max-w-5xl space-y-4 p-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64 w-full" /></div>;
    if (missing) return <div className="mx-auto max-w-md p-8 text-center"><p className="mb-4 text-muted-foreground">Documento não encontrado.</p><Button asChild><Link href="/documents">Voltar aos documentos</Link></Button></div>;
    if (!canWrite && !docId) return <div className="mx-auto max-w-md p-8 text-center text-muted-foreground">Não tem permissão para criar documentos.</div>;

    const title = `${draft.type}${draft.number ? ` ${draft.number}` : ""}`;
    const moreOpen = !!(draft.notes || draft.paymentTerms || draft.paymentMethod);
    const clientMore = !!(draft.client.taxId || draft.client.address || draft.client.phone || draft.client.email);
    const nItems = validItems(draft.items).length;

    const statusPill = (
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status === "draft" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : status === "issued" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-700 dark:text-red-400")}>{STATUS_LABEL[status]}</span>
    );
    const saveInfo = status === "draft" && (save === "saving" ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> A guardar…</span> : save === "error" ? <span className="text-red-600">Não guardado</span> : docId ? <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Guardado</span> : <span>Não guardado</span>);

    return (
        <div className="mx-auto w-full max-w-[1280px] pb-40 lg:pb-8">
            {/* barra superior */}
            <div className="sticky top-0 z-30 -mx-2 mb-3 border-b bg-background/95 px-2 pb-1.5 pt-2 backdrop-blur">
            <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="min-w-0 flex-1 truncate text-base font-bold leading-tight sm:text-lg">{title}</h1>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 px-2.5" aria-label="Exportar"><Download className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Exportar</span></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={download}><Download className="mr-2 h-4 w-4" /> Baixar PDF</DropdownMenuItem>
                        <DropdownMenuItem onSelect={print}><Printer className="mr-2 h-4 w-4" /> Imprimir</DropdownMenuItem>
                        <DropdownMenuItem onSelect={share}><Share2 className="mr-2 h-4 w-4" /> Partilhar (WhatsApp…)</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9" aria-label="Mais opções"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => derive(draft.type, `${draft.type} (cópia)`)} disabled={!docId && !hasContent(draft)}><Copy className="mr-2 h-4 w-4" /> Duplicar</DropdownMenuItem>
                        {CONVERT_TARGETS[draft.type].length > 0 && <DropdownMenuSeparator />}
                        {CONVERT_TARGETS[draft.type].length > 0 && <DropdownMenuLabel className="text-xs text-muted-foreground">Converter em…</DropdownMenuLabel>}
                        {CONVERT_TARGETS[draft.type].map((t) => <DropdownMenuItem key={t} onSelect={() => derive(t, t)}><FilePlus2 className="mr-2 h-4 w-4" /> {t}</DropdownMenuItem>)}
                        {status === "draft" && docId && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={discard} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Apagar rascunho</DropdownMenuItem></>}
                        {status === "issued" && isManager && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setUnlocked(true)}><Pencil className="mr-2 h-4 w-4" /> Corrigir documento</DropdownMenuItem><DropdownMenuItem onSelect={() => setCancelOpen(true)} className="text-red-600"><Ban className="mr-2 h-4 w-4" /> Anular</DropdownMenuItem></>}
                    </DropdownMenuContent>
                </DropdownMenu>
                {status === "draft" && canWrite && <Button size="sm" className="h-9" onClick={issue} disabled={!!busy}>{busy === "issue" ? <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" /> : <CheckCircle2 className="h-4 w-4 sm:mr-1.5" />}<span className="hidden sm:inline">Emitir</span><span className="sm:hidden">Emitir</span></Button>}
                {unlocked && <Button size="sm" className="h-9" onClick={saveCorrection} disabled={!!busy}>{busy === "fix" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Guardar</Button>}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 pl-11">
                <div className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[11px] text-muted-foreground">{statusPill}{saveInfo}{unlocked && <span className="flex items-center gap-1 text-amber-700"><Pencil className="h-3 w-3" /> a corrigir</span>}</div>
                {editable && (
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dispatch({ t: "undo" })} disabled={!canUndo(hist)} title="Desfazer (Ctrl+Z)" aria-label="Desfazer"><Undo2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dispatch({ t: "redo" })} disabled={!canRedo(hist)} title="Refazer (Ctrl+Y)" aria-label="Refazer"><Redo2 className="h-4 w-4" /></Button>
                    </div>
                )}
            </div>
            </div>

            {status !== "draft" && !unlocked && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{status === "cancelled" ? `Documento anulado${meta?.cancelReason ? `: ${meta.cancelReason}` : ""}.` : "Documento emitido: o número e o conteúdo ficam fixos."} {isManager && status === "issued" ? "Para alterar: ⋯ → Corrigir documento (fica registado). " : ""}Pode exportar, duplicar, converter e mudar o aspecto do PDF.</p>
                </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
                <Tabs value={tab} onValueChange={setTab} className="min-w-0">
                    <TabsList className="mb-3 grid w-full grid-cols-3 lg:grid-cols-2">
                        <TabsTrigger value="content">Conteúdo</TabsTrigger>
                        <TabsTrigger value="style">Aspecto</TabsTrigger>
                        <TabsTrigger value="preview" className="lg:hidden">Pré-visualizar</TabsTrigger>
                    </TabsList>

                    <TabsContent value="content" className="mt-0 space-y-3">
                        <Section title="Documento">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <Field label="Tipo" className="col-span-1 sm:col-span-2">
                                    <Select value={draft.type} onValueChange={(v) => { const t = v as DocumentType; const sug = suggestNumber(t, company).number; set({ type: t, number: !draft.number || draft.number === suggested.number ? sug : draft.number }); }} disabled={!editable || (!!docId && status !== "draft")}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                    </Select>
                                </Field>
                                <Field label="Número" className="col-span-1 sm:col-span-2">
                                    <Input value={draft.number} onChange={(e) => set({ number: e.target.value }, "number")} disabled={!editable} placeholder={suggested.number} />
                                </Field>
                                <Field label="Data de emissão" className="col-span-2"><DatePicker date={ymd(draft.issueDate)} setDate={(d) => d && editable && set({ issueDate: d.toISOString() })} /></Field>
                                <Field label={quote ? "Válida até" : "Vencimento"} className="col-span-2"><DatePicker date={ymd(draft.dueDate)} setDate={(d) => editable && set({ dueDate: d ? d.toISOString() : undefined })} /></Field>
                            </div>
                            {editable && draft.number !== suggested.number && (
                                <button type="button" className="mt-2 text-xs text-primary underline-offset-2 hover:underline" onClick={() => set({ number: suggested.number })}>Usar o número sugerido ({suggested.number})</button>
                            )}
                        </Section>

                        <Section title="Cliente">
                            <Field label="Nome">
                                <Input list="doc-customers" value={draft.client.name || ""} disabled={!editable} placeholder="Consumidor Final"
                                    onChange={(e) => { const c = customers.find((x) => x.name.toLowerCase() === e.target.value.toLowerCase()); setClient(c ? { name: c.name, phone: c.phone || draft.client.phone, email: c.email || draft.client.email } : { name: e.target.value }, "cname"); }} />
                                <datalist id="doc-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                            </Field>
                            <Collapsible defaultOpen={clientMore} className="mt-2">
                                <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"><ChevronDown className="h-3.5 w-3.5 transition group-data-[state=open]:rotate-180" /> NUIT, morada e contactos</CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 grid grid-cols-2 gap-3">
                                    <Field label="NUIT"><Input value={draft.client.taxId || ""} disabled={!editable} onChange={(e) => setClient({ taxId: e.target.value }, "ctax")} inputMode="numeric" /></Field>
                                    <Field label="Telefone"><Input value={draft.client.phone || ""} disabled={!editable} onChange={(e) => setClient({ phone: e.target.value }, "cphone")} inputMode="tel" /></Field>
                                    <Field label="Morada" className="col-span-2"><Input value={draft.client.address || ""} disabled={!editable} onChange={(e) => setClient({ address: e.target.value }, "caddr")} /></Field>
                                    <Field label="Email" className="col-span-2"><Input value={draft.client.email || ""} disabled={!editable} onChange={(e) => setClient({ email: e.target.value }, "cmail")} inputMode="email" /></Field>
                                </CollapsibleContent>
                            </Collapsible>
                        </Section>

                        <Section title={`Artigos${nItems ? ` (${nItems})` : ""}`}>
                            <datalist id="doc-products">{catalog.map((p) => <option key={p.id || p.name} value={p.name} />)}</datalist>
                            <div className="space-y-2.5">
                                {draft.items.map((it, idx) => (
                                    <div key={it.id} className="rounded-xl border bg-muted/20 p-2.5">
                                        <div className="flex items-start gap-1.5">
                                            <Input className="flex-1" list="doc-products" aria-label="Descrição" value={it.description} disabled={!editable} onChange={(e) => pickProduct(it.id, e.target.value)} placeholder="Artigo ou serviço" />
                                            {editable && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-10 w-9 shrink-0" aria-label="Opções da linha"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => moveItem(idx, -1)} disabled={idx === 0}><ArrowUp className="mr-2 h-4 w-4" /> Subir</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => moveItem(idx, 1)} disabled={idx === draft.items.length - 1}><ArrowDown className="mr-2 h-4 w-4" /> Descer</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => setItem(it.id, { discountPct: it.discountPct === undefined ? 0 : undefined }, "disc")}><Percent className="mr-2 h-4 w-4" /> {it.discountPct === undefined ? "Desconto na linha" : "Tirar desconto"}</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => draft.items.length > 1 && set({ items: draft.items.filter((x) => x.id !== it.id) })} disabled={draft.items.length <= 1} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Remover</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                        <div className={cn("mt-2 grid gap-2", it.discountPct !== undefined ? "grid-cols-4" : "grid-cols-3")}>
                                            <Field label="Qtd." small><NumInput value={it.quantity} onValue={(n) => setItem(it.id, { quantity: n ?? 0 }, "qty")} disabled={!editable} /></Field>
                                            <Field label="Un." small><Input value={it.unit} disabled={!editable} onChange={(e) => setItem(it.id, { unit: e.target.value }, "unit")} /></Field>
                                            <Field label="Preço" small><NumInput value={it.unitPrice} onValue={(n) => setItem(it.id, { unitPrice: n ?? 0 }, "price")} disabled={!editable} /></Field>
                                            {it.discountPct !== undefined && <Field label="Desc. %" small><NumInput value={it.discountPct || undefined} max={100} onValue={(n) => setItem(it.id, { discountPct: n ?? 0 }, "disc")} disabled={!editable} /></Field>}
                                        </div>
                                        <div className="mt-1.5 text-right text-sm font-semibold tabular-nums">{formatCurrency(it.quantity * it.unitPrice * (1 - (it.discountPct || 0) / 100))}</div>
                                    </div>
                                ))}
                            </div>
                            {editable && <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={() => set({ items: [...draft.items, newItem()] })}><Plus className="mr-1.5 h-4 w-4" /> Adicionar artigo</Button>}
                        </Section>

                        <Section title="Totais">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Desconto geral (MT)"><NumInput value={draft.discount || undefined} onValue={(n) => set({ discount: n ?? 0 }, "discount")} disabled={!editable} placeholder="0" /></Field>
                                <Field label="IVA">
                                    <Select value={String(draft.vatPct || 0)} onValueChange={(v) => set({ vatPct: parseFloat(v) })} disabled={!editable}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="0">Sem IVA</SelectItem><SelectItem value="16">16%</SelectItem><SelectItem value="17">17%</SelectItem></SelectContent>
                                    </Select>
                                </Field>
                            </div>
                            <div className="mt-3 space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatCurrency(totals.subtotal)}</span></div>
                                {totals.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span className="tabular-nums">-{formatCurrency(totals.discount)}</span></div>}
                                {totals.vat > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IVA ({draft.vatPct}%)</span><span className="tabular-nums">{formatCurrency(totals.vat)}</span></div>}
                                <div className="flex justify-between border-t pt-1.5 text-base font-bold"><span>Total</span><span className="tabular-nums">{formatCurrency(totals.total)}</span></div>
                            </div>
                        </Section>

                        <Section>
                            <Collapsible defaultOpen={moreOpen}>
                                <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-semibold">Notas e pagamento <ChevronDown className="h-4 w-4 text-muted-foreground transition group-data-[state=open]:rotate-180" /></CollapsibleTrigger>
                                <CollapsibleContent className="mt-3 space-y-3">
                                    <Field label="Forma de pagamento"><Input value={draft.paymentMethod || ""} disabled={!editable} onChange={(e) => set({ paymentMethod: e.target.value }, "pm")} placeholder="M-Pesa, numerário…" /></Field>
                                    <Field label="Condições de pagamento"><Textarea rows={2} value={draft.paymentTerms || ""} disabled={!editable} onChange={(e) => set({ paymentTerms: e.target.value }, "terms")} placeholder="Ex.: pagamento a 15 dias" /></Field>
                                    <Field label="Notas"><Textarea rows={2} value={draft.notes || ""} disabled={!editable} onChange={(e) => set({ notes: e.target.value }, "notes")} placeholder="Ex.: entrega no estaleiro" /></Field>
                                </CollapsibleContent>
                            </Collapsible>
                        </Section>

                        {status === "draft" && !quote && (
                            <label className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm">
                                <span><b>Registar também nas vendas</b><span className="block text-xs text-muted-foreground">Ao emitir, conta como venda paga (receita). Não mexe no stock.</span></span>
                                <Switch checked={registerSale} onCheckedChange={setRegisterSale} />
                            </label>
                        )}
                    </TabsContent>

                    <TabsContent value="style" className="mt-0 space-y-3">
                        <Section title="Tema">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {DOC_THEMES.map((t) => {
                                    const on = themeById(style.theme).id === t.id;
                                    const hex = style.accent || rgbToHex(t.defaultAccent);
                                    return (
                                        <button key={t.id} type="button" onClick={() => setStyle({ theme: t.id }, "theme")} className={cn("overflow-hidden rounded-xl border text-left transition", on ? "border-primary ring-2 ring-primary/40" : "hover:border-foreground/30")}>
                                            <img src={`/doc-themes/${t.id}.jpg`} alt="" loading="lazy" className="aspect-[210/297] w-full bg-white object-cover object-top" />
                                            <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hex }} />{t.name}</div>
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{themeById(style.theme).description}</p>
                            {!editable && <p className="mt-1 text-xs text-muted-foreground">Num documento emitido, o aspecto só muda o PDF que exportar agora.</p>}
                        </Section>

                        <Section title="Cor de destaque">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <button type="button" onClick={() => setStyle({ accent: undefined }, "accent")} className={cn("rounded-full border px-3 py-1 text-xs", !style.accent && "border-primary bg-primary/10 font-semibold")}>Do tema</button>
                                {ACCENT_PRESETS.map((p) => { const hex = rgbToHex(p.rgb); return <button key={hex} type="button" title={p.name} aria-label={p.name} onClick={() => setStyle({ accent: hex }, "accent")} className={cn("h-7 w-7 rounded-full border-2", style.accent === hex ? "scale-110 border-foreground" : "border-transparent")} style={{ background: hex }} />; })}
                            </div>
                        </Section>

                        <Section title="Cabeçalho e rodapé">
                            <div className="space-y-2">
                                <label className="flex items-center justify-between gap-3 text-sm"><span>Mostrar logótipo</span><Switch checked={style.showLogo !== false} onCheckedChange={(v) => setStyle({ showLogo: v }, "logo")} /></label>
                                <label className="flex items-center justify-between gap-3 text-sm"><span>Espaço para assinaturas</span><Switch checked={style.showSignatures !== false} onCheckedChange={(v) => setStyle({ showSignatures: v }, "showsig")} /></label>
                                {style.showSignatures !== false && <label className="flex items-center justify-between gap-3 text-sm"><span>Assinatura do cliente</span><Switch checked={!!style.showClientSignature} onCheckedChange={(v) => setStyle({ showClientSignature: v }, "showclient")} /></label>}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <Field label="Local da assinatura"><Input value={style.signaturePlace || ""} onChange={(e) => setStyle({ signaturePlace: e.target.value }, "place")} placeholder="Maputo" /></Field>
                                <Field label="Texto do rodapé"><Input value={style.footerNote || ""} onChange={(e) => setStyle({ footerNote: e.target.value }, "footer")} placeholder="Processado por computador" /></Field>
                            </div>
                        </Section>

                        {style.showSignatures !== false && (
                            <Section title="Assinaturas">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SignaturePad label="Empresa" value={style.companySignature} disabled={!editable} onChange={(v) => setStyle({ companySignature: v || undefined }, "sig-c")} />
                                    {style.showClientSignature && <SignaturePad label="Cliente" value={style.clientSignature} disabled={!editable} onChange={(v) => setStyle({ clientSignature: v || undefined }, "sig-k")} />}
                                </div>
                                {!style.companySignature && company?.signatureUrl && <p className="mt-2 text-xs text-muted-foreground">Sem assinatura desenhada, usa-se a assinatura/carimbo da empresa das Definições.</p>}
                            </Section>
                        )}
                    </TabsContent>

                    <TabsContent value="preview" className="mt-0 lg:hidden">
                        <DocPreview model={previewModel} company={company} />
                        <p className="mt-2 text-center text-xs text-muted-foreground">Pré-visualização aproximada. O PDF segue o mesmo tema e cores.</p>
                    </TabsContent>
                </Tabs>

                {/* pré-visualização (ecrãs largos) */}
                <div className="hidden lg:block">
                    <div className="sticky top-20 space-y-2">
                        <p className="text-sm font-medium">Pré-visualização</p>
                        <DocPreview model={previewModel} company={company} />
                    </div>
                </div>
            </div>

            {/* resumo fixo (telemóvel) */}
            {tab !== "preview" && (
                <div className="fixed inset-x-3 bottom-20 z-20 flex items-center justify-between gap-3 rounded-2xl border bg-background/95 p-2.5 pl-4 shadow-lg backdrop-blur lg:hidden">
                    <div className="leading-tight"><div className="text-[11px] text-muted-foreground">Total</div><div className="text-base font-bold tabular-nums">{formatCurrency(totals.total)}</div></div>
                    <Button size="sm" variant="secondary" onClick={() => { setTab("preview"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Eye className="mr-1.5 h-4 w-4" /> Pré-visualizar</Button>
                </div>
            )}

            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Anular {title}</DialogTitle><DialogDescription>O documento fica no histórico com a marca "ANULADO". Não se pode desfazer.</DialogDescription></DialogHeader>
                    <Field label="Motivo"><Textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex.: erro no valor; cliente desistiu" /></Field>
                    <DialogFooter><Button variant="ghost" onClick={() => setCancelOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={cancelDoc} disabled={busy === "cancel"}>{busy === "cancel" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Anular documento</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Definidos fora do componente: se fossem criados a cada render, os campos perdiam o foco a cada tecla.
function Field({ label, children, className, small }: { label: string; children: React.ReactNode; className?: string; small?: boolean }) {
    // <label> a envolver o campo: associa o texto ao campo (acessibilidade) sem precisar de ids
    return <label className={cn("block min-w-0 space-y-1", className)}><span className={cn("block", small ? "text-[11px] text-muted-foreground" : "text-xs font-medium text-muted-foreground")}>{label}</span>{children}</label>;
}
function Section({ title, children }: { title?: string; children: React.ReactNode }) {
    return <section className="rounded-2xl border bg-card p-3.5 sm:p-4">{title && <h2 className="mb-3 text-sm font-semibold">{title}</h2>}{children}</section>;
}
