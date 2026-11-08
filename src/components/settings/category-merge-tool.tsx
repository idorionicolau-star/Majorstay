"use client";

import { useState, useContext, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventoryContext } from "@/context/inventory-context";
import { ArrowRight, Merge, AlertTriangle } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CategoryMergeTool() {
    const inventoryContext = useContext(InventoryContext);
    const { availableCategories, allProducts, catalogProducts, editCategory } = inventoryContext || {};
    const { toast } = useToast();

    const [sourceCategory, setSourceCategory] = useState<string>("");
    const [targetCategory, setTargetCategory] = useState<string>("");
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isMerging, setIsMerging] = useState(false);

    // Derived state to know how many things are affected
    const affectedProductsCount = useMemo(() => {
        if (!sourceCategory || !allProducts) return 0;
        return allProducts.filter((p: any) => p.category === sourceCategory).length;
    }, [sourceCategory, allProducts]);

    const affectedCatalogCount = useMemo(() => {
        if (!sourceCategory || !catalogProducts) return 0;
        return catalogProducts.filter((p: any) => p.category === sourceCategory).length;
    }, [sourceCategory, catalogProducts]);

    const handleMerge = async () => {
        if (!sourceCategory || !targetCategory) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Selecione as duas categorias.' });
            return;
        }
        if (sourceCategory === targetCategory) {
            toast({ variant: 'destructive', title: 'Erro', description: 'As categorias não podem ser iguais.' });
            return;
        }
        if (!editCategory) return;

        setIsMerging(true);
        try {
            await editCategory(sourceCategory, targetCategory);
            setSourceCategory("");
            setTargetCategory("");
            setIsConfirmOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsMerging(false);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Merge className="h-5 w-5 text-indigo-500" />
                    Ferramenta de Fusão de Categorias
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Unifique duas categorias numa só. Todos os produtos da categoria de origem serão transferidos para a categoria de destino, e a categoria de origem será eliminada. Útil para corrigir duplicações (ex: "Laminas" e "Lâmina").
                </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origem (A Eliminar)</label>
                    <Select value={sourceCategory} onValueChange={setSourceCategory}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione categoria antiga..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableCategories?.map((cat: string) => (
                                <SelectItem key={cat} value={cat} disabled={cat === targetCategory}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="hidden sm:flex self-end pb-2">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="flex-1 w-full space-y-2">
                    <label className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Destino (Nova Categoria)</label>
                    <Select value={targetCategory} onValueChange={setTargetCategory}>
                        <SelectTrigger className="border-indigo-200 dark:border-indigo-800">
                            <SelectValue placeholder="Selecione a categoria alvo..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableCategories?.map((cat: string) => (
                                <SelectItem key={cat} value={cat} disabled={cat === sourceCategory}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <Button
                    onClick={() => {
                        if (!sourceCategory || !targetCategory) {
                            toast({ variant: 'destructive', description: "Selecione a origem e o destino primeiro." });
                            return;
                        }
                        setIsConfirmOpen(true);
                    }}
                    disabled={!sourceCategory || !targetCategory || isMerging}
                >
                    Analisar e Unificar
                </Button>
            </div>

            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Fusão de Categorias</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                            <p>
                                Tem a certeza que deseja fundir a categoria <strong>"{sourceCategory}"</strong> em <strong>"{targetCategory}"</strong>?
                            </p>

                            <Alert variant="default" className="bg-amber-50 dark:bg-amber-950/50 border-amber-200 text-amber-800 dark:text-amber-200">
                                <AlertTriangle className="h-4 w-4 stroke-amber-600 dark:stroke-amber-400" />
                                <AlertTitle>Impacto da Ação</AlertTitle>
                                <AlertDescription className="mt-2 text-xs">
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong>{affectedProductsCount}</strong> produto(s) no inventário serão atualizados.</li>
                                        <li><strong>{affectedCatalogCount}</strong> entrada(s) no catálogo serão atualizadas.</li>
                                        <li>A categoria "{sourceCategory}" será eliminada das listas (incluindo catálogo inteligente).</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                            <p className="text-xs text-muted-foreground font-semibold">
                                Esta ação fará um 'Batch Update' pesado e não pode ser desfeita automaticamente.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isMerging}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); handleMerge(); }} disabled={isMerging} className="bg-indigo-600 hover:bg-indigo-700">
                            {isMerging ? "A fundir..." : "Confirmar e Unificar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
