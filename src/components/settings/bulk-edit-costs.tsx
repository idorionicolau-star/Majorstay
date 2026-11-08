"use client";

import React, { useState, useMemo, useContext } from "react";
import { DataGrid, Column, RenderEditCellProps } from "react-data-grid";
import 'react-data-grid/lib/styles.css';
import { InventoryContext } from "@/context/inventory-context";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Search, Save, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { writeBatch, doc } from "firebase/firestore";
import { useFirestore } from "@/firebase/provider";
import { Product } from "@/lib/types";

// Helper for text inputs
function textEditor({ row, column, onRowChange, onClose }: RenderEditCellProps<any>) {
    return (
        <input
            className="w-full h-full border-2 border-primary outline-none bg-background text-foreground px-2"
            autoFocus
            value={row[column.key as keyof typeof row] as string}
            onChange={(event) => onRowChange({ ...row, [column.key]: event.target.value })}
            // We pass true to close the editor and keep changes
            onBlur={() => onClose(true)}
        />
    );
}

interface CostRow {
    id: string | undefined;
    instanceId: string;
    name: string;
    category: string;
    originalCost: number;
    cost: string; // The editable field, kept as string while editing
    price: number;
    hasChanged: boolean;
}

export function BulkEditCosts() {
    const inventoryContext = useContext(InventoryContext);
    const { products, companyId } = inventoryContext || {};
    const { toast } = useToast();
    const { theme, systemTheme } = useTheme();
    const firestore = useFirestore();

    const [searchTerm, setSearchTerm] = useState("");
    const [editedRows, setEditedRows] = useState<Record<string, CostRow>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Initialize rows from context
    const rows = useMemo(() => {
        const activeProducts = products || [];
        const filtered = activeProducts.filter(p => !p.deletedAt && p.name.toLowerCase().includes(searchTerm.toLowerCase()));

        return filtered.map(p => {
            // If it was edited, use the edited version
            if (editedRows[p.instanceId!]) {
                return editedRows[p.instanceId!];
            }
            return {
                id: p.id,
                instanceId: p.instanceId!,
                name: p.name,
                category: p.category || 'Geral',
                originalCost: p.cost || 0,
                cost: (p.cost || 0).toString(),
                price: p.price,
                hasChanged: false,
            };
        });
    }, [products, searchTerm, editedRows]);

    const currentTheme = theme === 'system' ? systemTheme : theme;
    const gridThemeClass = currentTheme === 'dark' ? 'rdg-dark' : 'rdg-light';

    const columns: Column<CostRow>[] = [
        { key: 'name', name: 'Nome do Produto', minWidth: 250 },
        { key: 'category', name: 'Categoria', width: 160 },
        {
            key: 'cost',
            name: 'Custo Unt. (MT)',
            renderEditCell: textEditor,
            width: 140,
            renderCell: ({ row }) => {
                const numCost = parseFloat(row.cost);
                const isInvalid = isNaN(numCost) || numCost <= 0;
                return (
                    <div className={isInvalid ? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-bold h-full flex items-center px-2" : "h-full flex items-center px-2"}>
                        {row.cost}
                    </div>
                );
            }
        },
        {
            key: 'price',
            name: 'Preço Venda (MT)',
            width: 140,
            renderCell: ({ row }) => {
                return <div className="text-muted-foreground">{row.price.toFixed(2)}</div>;
            }
        },
        {
            key: 'margin',
            name: 'Margem (Bruta)',
            width: 140,
            renderCell: ({ row }) => {
                const cost = parseFloat(row.cost) || 0;
                const margin = row.price > 0 ? ((row.price - cost) / row.price) * 100 : 0;
                const isDanger = cost <= 0 || margin <= 0;
                return (
                    <div className={isDanger ? "text-destructive font-medium" : "text-green-600 dark:text-green-400 font-medium"}>
                        {margin.toFixed(1)}%
                    </div>
                );
            }
        }
    ];

    const handleRowsChange = (newRows: CostRow[], { indexes }: { indexes: number[] }) => {
        const updatedMap = { ...editedRows };
        for (const idx of indexes) {
            const row = newRows[idx];
            const newCostNum = parseFloat(row.cost) || 0;
            row.hasChanged = newCostNum !== row.originalCost;
            updatedMap[row.instanceId] = row;
        }
        setEditedRows(updatedMap);
    };

    const changedCount = Object.values(editedRows).filter(r => r.hasChanged).length;
    const zeroCostCount = Object.values(editedRows).filter(r => (parseFloat(r.cost) || 0) <= 0).length + rows.filter(r => !editedRows[r.instanceId] && r.originalCost <= 0).length;

    const handleSave = async () => {
        if (!firestore || !companyId || changedCount === 0) return;

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const docsToUpdate = Object.values(editedRows).filter(r => r.hasChanged);

            let operationsCount = 0;
            let currentBatch = batch;

            for (const row of docsToUpdate) {
                const docRef = doc(firestore, `companies/${companyId}/products`, row.instanceId);
                const newCost = parseFloat(row.cost) || 0;
                currentBatch.update(docRef, { cost: newCost });
                operationsCount++;

                // Firebase batches have a 500 operation limit. Usually we won't hit it in one UI change, but to be technically sound:
                if (operationsCount >= 490) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(firestore);
                    operationsCount = 0;
                }
            }

            if (operationsCount > 0) {
                await currentBatch.commit();
            }

            toast({ title: "Sucesso", description: `${docsToUpdate.length} custos atualizados.` });
            setEditedRows({}); // Clear edits
        } catch (error) {
            console.error("Error saving bulk costs", error);
            toast({ variant: "destructive", title: "Erro", description: "Ocorreu um erro ao salvar." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Pesquisar produto..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {zeroCostCount > 0 && (
                        <div className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-md border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="h-4 w-4" />
                            <span>{zeroCostCount} c/ Custo a 0</span>
                        </div>
                    )}

                    <Button onClick={handleSave} disabled={isSaving || changedCount === 0} className="w-full sm:w-auto">
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? "A Salvar..." : `Guardar ${changedCount > 0 ? `(${changedCount})` : ''}`}
                    </Button>
                </div>
            </div>

            <div className={`border rounded-lg overflow-hidden flex flex-col ${gridThemeClass}`} style={{ height: '600px' }}>
                <DataGrid
                    columns={columns}
                    rows={rows}
                    onRowsChange={handleRowsChange}
                    className="fill-grid w-full flex-grow text-sm"
                    rowHeight={45}
                />
            </div>
            <p className="text-xs text-muted-foreground">Nota: Clique duas vezes na célula "Custo Unt." para editar. Pressione Enter para conformar o valor.</p>
        </div>
    );
}
