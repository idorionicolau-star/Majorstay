"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { ChevronDown, Download, FilePlus2, FileText, Plus, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InventoryContext } from "@/context/inventory-context";
import { useFirestore } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { DOCUMENT_TYPES } from "@/lib/doc-model";
import { draftToModel, docToDraft, type AppDocument, type DocStatus } from "@/lib/app-document";

const STATUS: Record<DocStatus, { label: string; cls: string }> = {
    draft: { label: "Rascunho", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    issued: { label: "Emitido", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    cancelled: { label: "Anulado", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
};

/** Menu "Novo documento": definido fora da página para não se recriar (e fechar) a cada actualização da lista. */
function NewMenu({ children, side = "bottom", onPick }: { children: React.ReactNode; side?: "top" | "bottom"; onPick: (t: string) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
            <DropdownMenuContent align="end" side={side}>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Novo documento</DropdownMenuLabel>
                {DOCUMENT_TYPES.map((t) => <DropdownMenuItem key={t} onSelect={() => onPick(t)}><FilePlus2 className="mr-2 h-4 w-4" />{t}</DropdownMenuItem>)}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function DocumentsPage() {
    const inv = useContext(InventoryContext);
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const companyId = inv?.companyId ?? null;
    const canWrite = !!inv?.canEdit?.("sales");
    const canRead = !!inv?.canView?.("sales");
    const [docs, setDocs] = useState<AppDocument[] | null>(null);
    const [search, setSearch] = useState("");
    const [type, setType] = useState("all");
    const [status, setStatus] = useState("all");

    useEffect(() => {
        // as regras só deixam ler os documentos a quem vê as Vendas (uma escuta recusada rebentava a app)
        if (!firestore || !companyId || !canRead) { setDocs([]); return; }
        const q = query(collection(firestore, `companies/${companyId}/documents`), orderBy("updatedAt", "desc"));
        return onSnapshot(q, (s) => setDocs(s.docs.map((d) => ({ ...(d.data() as AppDocument), id: d.id }))), () => {
            setDocs([]);
            toast({ variant: "destructive", title: "Não foi possível carregar os documentos", description: "Confirme que as regras do Firestore foram publicadas." });
        });
    }, [firestore, companyId, canRead, toast]);

    const list = useMemo(() => {
        const s = search.trim().toLowerCase();
        return (docs ?? []).filter((d) =>
            (type === "all" || d.type === type) && (status === "all" || d.status === status) &&
            (!s || `${d.number} ${d.client?.name ?? ""}`.toLowerCase().includes(s)));
    }, [docs, search, type, status]);

    const openNew = (t: string) => router.push(`/documents/new?tipo=${encodeURIComponent(t)}`);

    const download = async (d: AppDocument) => {
        try {
            const { renderDocPDF } = await import("@/lib/doc-pdf");
            const pdf = await renderDocPDF(draftToModel(docToDraft(d), inv?.companyData ?? null, { status: d.status }), inv?.companyData ?? null);
            pdf.save(`${d.type.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_")}_${(d.number || "rascunho").replace(/[^\w.-]+/g, "_")}.pdf`);
        } catch (e: any) { toast({ variant: "destructive", title: "Não foi possível gerar o PDF", description: e?.message }); }
    };

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-20">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="font-headline text-2xl font-bold md:text-3xl">Documentos</h1>
                    <p className="text-sm text-muted-foreground">Cotações, facturas, recibos e guias.</p>
                </div>
                {canWrite && (
                    // no computador o botão fica no cabeçalho; no telemóvel passa para o canto inferior direito (ao alcance do polegar)
                    <NewMenu onPick={openNew}>
                        <Button data-tour="docs-new" className="hidden shrink-0 gap-1.5 md:inline-flex"><Plus className="h-4 w-4" /> Novo<ChevronDown className="h-4 w-4 opacity-70" /></Button>
                    </NewMenu>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex" data-tour="docs-filters">
                <div className="relative col-span-2 min-w-[200px] flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Procurar por número ou cliente…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="sm:w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos os estados</SelectItem>{(Object.keys(STATUS) as DocStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>)}</SelectContent>
                </Select>
            </div>

            {docs === null ? (
                <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : list.length === 0 ? (
                <Card data-tour="docs-list"><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                    <FileText className="h-8 w-8" />
                    <p>{docs.length === 0 ? "Ainda não criou documentos. Toque em “Novo” (ou no botão +) para começar." : "Nenhum documento corresponde ao filtro."}</p>
                </CardContent></Card>
            ) : (
                <div className="space-y-2" data-tour="docs-list">
                    {list.map((d) => (
                        <Card key={d.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => router.push(`/documents/${d.id}`)}>
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold">{d.type}</span>
                                        <span className="font-mono text-sm text-muted-foreground">{d.number || "sem número"}</span>
                                        <Badge variant="secondary" className={STATUS[d.status]?.cls}>{STATUS[d.status]?.label}</Badge>
                                    </div>
                                    <p className="truncate text-sm text-muted-foreground">{d.client?.name || "Sem cliente"} · {new Date(d.issueDate).toLocaleDateString("pt-PT")}</p>
                                </div>
                                <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{formatCurrency(d.totals?.total ?? 0)}</span>
                                <Button variant="ghost" size="icon" aria-label="Descarregar PDF" onClick={(e) => { e.stopPropagation(); download(d); }}><Download className="h-4 w-4" /></Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {canWrite && (
                <div className="fixed bottom-20 right-4 z-30 md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
                    <NewMenu side="top" onPick={openNew}>
                        <Button data-tour="docs-new" size="icon" className="h-14 w-14 rounded-full shadow-lg" aria-label="Novo documento"><Plus className="h-6 w-6" /></Button>
                    </NewMenu>
                </div>
            )}
        </div>
    );

}
