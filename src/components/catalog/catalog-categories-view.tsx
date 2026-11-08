"use client";

import { Edit, FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type CategoryRow = { id: string; name: string; count: number };

/** Categorias com o número de produtos de cada uma. Tocar numa categoria mostra os produtos dela. */
export function CatalogCategoriesView({ rows, loading, readOnly, onAdd, onRename, onDelete, onOpen }: {
    rows: CategoryRow[];
    loading: boolean;
    readOnly: boolean;
    onAdd: () => void;
    onRename: (c: CategoryRow) => void;
    onDelete: (c: CategoryRow) => void;
    onOpen: (name: string) => void;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{rows.length} categoria{rows.length === 1 ? "" : "s"}</p>
                {!readOnly && <Button size="sm" onClick={onAdd} className={cn(rows.length === 0 && "animate-shake")}><Plus className="mr-1.5 h-4 w-4" /> Nova categoria</Button>}
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
                {loading ? (
                    <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
                ) : rows.length === 0 ? (
                    <p className="px-4 py-10 text-center text-muted-foreground">Ainda não há categorias. Crie a primeira para organizar os produtos.</p>
                ) : rows.map((c) => (
                    <div key={c.id} data-testid="category-row" className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/40">
                        <button type="button" onClick={() => onOpen(c.name)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0"><span className="block truncate font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.count} produto{c.count === 1 ? "" : "s"}</span></span>
                        </button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={readOnly} onClick={() => onRename(c)} aria-label={`Renomear ${c.name}`}><Edit className="h-4 w-4 text-muted-foreground" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={readOnly || c.count > 0} onClick={() => onDelete(c)} aria-label={`Apagar ${c.name}`} title={c.count > 0 ? "Só se apaga uma categoria vazia" : "Apagar categoria"}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
