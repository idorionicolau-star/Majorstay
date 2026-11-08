"use client";

import { useState, useContext, useMemo } from 'react';
import { InventoryContext } from '@/context/inventory-context';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { GitMerge, Search, AlertTriangle, ArrowRight, Wand2 } from 'lucide-react';
import { normalizeString, levenshteinDistance } from '@/lib/utils';
import { Product } from '@/lib/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

type DuplicateGroup = {
    groupName: string;
    products: Product[];
    reason: 'Exact Match' | 'Similar Name';
};

export function AdminMergeTool() {
    const { products, mergeProducts, loading } = useContext(InventoryContext) || { products: [], loading: true };
    const [scannedGroups, setScannedGroups] = useState<DuplicateGroup[]>([]);
    const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const handleScan = () => {
        setIsScanning(true);
        setTimeout(() => {
            const groups: DuplicateGroup[] = [];
            const processedIds = new Set<string>();

            // 1. Group by Normalized Name (Exact Match ignoring case/accents)
            const nameMap = new Map<string, Product[]>();
            products.forEach(p => {
                const norm = normalizeString(p.name);
                if (!nameMap.has(norm)) nameMap.set(norm, []);
                nameMap.get(norm)?.push(p);
            });

            nameMap.forEach((prods, key) => {
                if (prods.length > 1) {
                    groups.push({
                        groupName: `Duplicatas: "${prods[0].name}"`,
                        products: prods,
                        reason: 'Exact Match'
                    });
                    prods.forEach(p => processedIds.add(p.id!));
                }
            });

            // 2. Find similar names (Levenshtein) - O(N^2) simplified
            // Only compare products not already grouped
            const ungrouped = products.filter(p => !processedIds.has(p.id!));

            for (let i = 0; i < ungrouped.length; i++) {
                const p1 = ungrouped[i];
                if (processedIds.has(p1.id!)) continue;

                const similar = [p1];
                for (let j = i + 1; j < ungrouped.length; j++) {
                    const p2 = ungrouped[j];
                    if (processedIds.has(p2.id!)) continue;

                    const dist = levenshteinDistance(normalizeString(p1.name), normalizeString(p2.name));
                    // Threshold: simple logic, <= 2 edits for now, or proportional to length
                    const threshold = Math.max(2, Math.floor(p1.name.length * 0.2));
                    if (dist <= threshold) {
                        similar.push(p2);
                    }
                }

                if (similar.length > 1) {
                    similar.forEach(p => processedIds.add(p.id!));
                    groups.push({
                        groupName: `Similares: "${p1.name}"`,
                        products: similar,
                        reason: 'Similar Name'
                    });
                }
            }

            setScannedGroups(groups);
            setIsScanning(false);
        }, 500);
    };

    const handleMerge = async () => {
        if (!selectedTargetId || selectedSourceIds.length === 0 || !mergeProducts) return;

        await mergeProducts(selectedTargetId, selectedSourceIds);

        setConfirmOpen(false);
        setSelectedTargetId(null);
        setSelectedSourceIds([]);
        // Re-scan to refresh
        handleScan();
    };

    const toggleSource = (id: string) => {
        if (selectedSourceIds.includes(id)) {
            setSelectedSourceIds(prev => prev.filter(x => x !== id));
        } else {
            setSelectedSourceIds(prev => [...prev, id]);
        }
    };

    // Auto-select helper for a group card
    const selectForGroup = (target: Product, sources: Product[]) => {
        setSelectedTargetId(target.id!);
        setSelectedSourceIds(sources.map(p => p.id!));
        setConfirmOpen(true);
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <GitMerge className="h-5 w-5 text-purple-500" />
                            Unificação de Produtos
                        </CardTitle>
                        <CardDescription>
                            Ferramenta de Administrador para corrigir duplicatas e unificar registos.
                        </CardDescription>
                    </div>
                    <Button onClick={handleScan} disabled={isScanning} className="w-full md:w-auto">
                        {isScanning ? <Wand2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        {isScanning ? 'A Analisar...' : 'Procurar Duplicatas'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {scannedGroups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                        <Wand2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p>Clique em "Procurar Duplicatas" para iniciar a análise automática.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                            {scannedGroups.map((group, idx) => (
                                <Card key={idx} className="border-l-4 border-l-purple-500 bg-muted/20">
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-semibold">{group.groupName}</h4>
                                                <Badge variant="outline" className="mt-1 text-xs">{group.reason}</Badge>
                                            </div>
                                        </div>

                                        <div className="bg-background rounded-md border text-sm">
                                            <div className="grid grid-cols-12 gap-2 p-2 font-medium bg-muted/50 border-b">
                                                <div className="col-span-6">Nome Atual</div>
                                                <div className="col-span-2 text-center">Stock</div>
                                                <div className="col-span-4 text-right">Ação</div>
                                            </div>
                                            {group.products.map(product => (
                                                <div key={product.id} className="grid grid-cols-12 gap-2 p-2 items-center border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900">
                                                    <div className="col-span-6 truncate">{product.name} <span className="text-xs text-muted-foreground">({product.location || 'Principal'})</span></div>
                                                    <div className="col-span-2 text-center">{product.stock}</div>
                                                    <div className="col-span-4 flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                                            onClick={() => selectForGroup(product, group.products.filter(p => p.id !== product.id))}
                                                        >
                                                            Manter Este
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Unificação</DialogTitle>
                        <DialogDescription>
                            <span className="flex items-center gap-2 text-yellow-600 font-bold mt-2 mb-4 bg-yellow-50 p-2 rounded border border-yellow-200">
                                <AlertTriangle className="h-4 w-4" /> Ação Irreversível
                            </span>
                            Você está prestes a unificar {selectedSourceIds.length} produtos em um único produto principal.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between text-sm border p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                            <div>
                                <span className="block font-bold text-red-600">Serão Apagados:</span>
                                <ul className="list-disc list-inside text-muted-foreground mt-1">
                                    {products.filter(p => selectedSourceIds.includes(p.id!)).map(p => (
                                        <li key={p.id}>{p.name} ({p.stock})</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <ArrowRight className="text-muted-foreground" />
                        </div>

                        <div className="flex items-center justify-between text-sm border p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                            <div>
                                <span className="block font-bold text-green-600">Produto Principal (Target):</span>
                                <div className="mt-1 font-medium">
                                    {products.find(p => p.id === selectedTargetId)?.name}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Novo Stock Estimado: {
                                        (products.find(p => p.id === selectedTargetId)?.stock || 0) +
                                        products.filter(p => selectedSourceIds.includes(p.id!)).reduce((sum, p) => sum + p.stock, 0)
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
                        <Button variant="default" onClick={handleMerge} className="bg-purple-600 hover:bg-purple-700">Confirmar e Unificar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
