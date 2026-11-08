"use client";

import { haul } from "@/lib/haul";
import { locationLabel, sortBySite } from '@/lib/sites';
import { requireEmailConfirmed } from "@/components/billing/email-confirm";
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DataGrid, renderTextEditor as textEditor, Column, RenderEditCellProps } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Save, Camera, Upload, Loader2, MapPin } from "lucide-react";
import { useInventory } from "@/context/inventory-context";
import { useAuth } from "@/firebase/provider";
import { useTheme } from "next-themes";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useFuse } from "@/hooks/use-fuse";
import type { Product } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

interface RowData {
    name: string;
    category: string;
    unit: string;
    price: string;
    cost: string;
    stock: string;
    minStock: string;
    location: string;
    isCategorizing?: boolean;
}

const initialRows: RowData[] = Array.from({ length: 5 }, () => ({
    name: '',
    category: '',
    unit: 'un',
    price: '',
    cost: '',
    stock: '',
    minStock: '',
    location: '',
}));


export function FastEntryGrid({ onSuccess }: { onSuccess?: () => void }) {
    const [rows, setRows] = useState<RowData[]>(initialRows);
    const { addProduct, addCatalogProduct, catalogProducts, addCatalogCategory, catalogCategories, companyData, products, companyId, categorizeProductWithAI } = useInventory();
    const { toast } = useToast();
    const auth = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { theme, systemTheme } = useTheme();
    const isMobile = useMediaQuery("(max-width: 640px)");

    // Auto-categorize new entries
    useEffect(() => {
        let mounted = true;

        rows.forEach((row, index) => {
            if (row.name && row.name.trim() !== '' && row.category === '' && !row.isCategorizing) {
                const existingProduct = products.find(p => p.name.toLowerCase() === row.name.toLowerCase());

                if (!existingProduct && categorizeProductWithAI) {
                    setRows(currentRows => {
                        const newRows = [...currentRows];
                        newRows[index] = { ...newRows[index], isCategorizing: true, category: 'A carregar IA...' };
                        return newRows;
                    });

                    categorizeProductWithAI(row.name).then(suggestedCategory => {
                        if (!mounted) return;
                        setRows(currentRows => {
                            // Check if the row still exists and is currently categorizing 
                            if (!currentRows[index] || !currentRows[index].isCategorizing) return currentRows;

                            const newRows = [...currentRows];
                            const currentRow = newRows[index];

                            if (currentRow.name === row.name) {
                                // ONLY apply AI suggestion if the user hasn't typed their own category in the meantime
                                if (currentRow.category === 'A carregar IA...' || currentRow.category === '') {
                                    newRows[index] = { ...currentRow, category: suggestedCategory || 'Geral', isCategorizing: false };
                                } else {
                                    // User already typed something, just remove the loading flag
                                    newRows[index] = { ...currentRow, isCategorizing: false };
                                }
                            } else {
                                // Race condition: The name changed mid-flight. 
                                // We MUST clear the loading state so the next effect cycle can pick up the new name.
                                // We also clear the category back to empty ONLY if it was our placeholder, so the next cycle can run.
                                if (currentRow.category === 'A carregar IA...') {
                                    newRows[index] = { ...currentRow, isCategorizing: false, category: '' };
                                } else {
                                    newRows[index] = { ...currentRow, isCategorizing: false };
                                }
                            }
                            return newRows;
                        });
                    });
                }
            }
        });

        return () => { mounted = false; };
    }, [rows, products, categorizeProductWithAI]);

    // Automatically set location if empty and company has locations
    useEffect(() => {
        if (companyData?.locations && companyData.locations.length > 0) {
            const defaultLocation = companyData.locations[0].id;
            setRows(currentRows => {
                let hasChanges = false;
                const newRows = currentRows.map(row => {
                    if (row.location === '') {
                        hasChanges = true;
                        return { ...row, location: defaultLocation };
                    }
                    return row;
                });
                return hasChanges ? newRows : currentRows;
            });
        }
    }, [companyData?.locations]);

    const currentTheme = theme === 'system' ? systemTheme : theme;
    const gridThemeClass = currentTheme === 'dark' ? 'rdg-dark' : 'rdg-light';

    const categories = React.useMemo(() => {
        const cats = new Set(products.map(p => p.category).filter(Boolean));
        if (companyData?.validCategories) {
            companyData.validCategories.forEach(c => cats.add(c));
        }
        return Array.from(cats).sort();
    }, [products, companyData]);

    const units = companyData?.validUnits || ['un', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'cx'];

    const CategoryEditor = ({ row, onRowChange, onClose }: RenderEditCellProps<RowData>) => (
        <input
            className="w-full h-full border-2 border-primary outline-none bg-background text-foreground px-2"
            autoFocus
            value={row.category}
            list="categories-list"
            onChange={(e) => onRowChange({ ...row, category: e.target.value })}
            onBlur={() => onClose(true)}
        />
    );

    const UnitEditor = ({ row, onRowChange, onClose }: RenderEditCellProps<RowData>) => (
        <input
            className="w-full h-full border-2 border-primary outline-none bg-background text-foreground px-2"
            autoFocus
            value={row.unit}
            list="units-list"
            onChange={(e) => onRowChange({ ...row, unit: e.target.value })}
            onBlur={() => onClose(true)}
        />
    );

    const LocationEditor = ({ row, onRowChange, onClose }: RenderEditCellProps<RowData>) => (
        <select
            autoFocus
            className="w-full h-full border-2 border-primary outline-none bg-background text-foreground px-2 cursor-pointer"
            value={row.location}
            onChange={(e) => {
                onRowChange({ ...row, location: e.target.value }, true);
                onClose(true);
            }}
            onBlur={() => onClose(true)}
        >
            <option value="" disabled>Selecione um local...</option>
            {sortBySite(companyData?.locations || []).map(loc => (
                <option key={loc.id} value={loc.id}>{locationLabel(loc)}</option>
            ))}
        </select>
    );

    const productNames = React.useMemo(() => {
        return Array.from(new Set(products.map(p => p.name).filter(Boolean))).sort();
    }, [products]);

    const NameEditor = ({ row, onRowChange, onClose }: RenderEditCellProps<RowData>) => {
        const [inputValue, setInputValue] = useState(row.name);
        const [highlightedIndex, setHighlightedIndex] = useState(-1);
        const suggestionsRef = useRef<HTMLDivElement>(null);
        const inputRef = useRef<HTMLInputElement>(null);
        const [inputRect, setInputRect] = useState<DOMRect | null>(null);

        useEffect(() => {
            const updateRect = () => {
                if (inputRef.current) {
                    setInputRect(inputRef.current.getBoundingClientRect());
                }
            };
            updateRect();
            // True param captures scroll events from the grid container
            window.addEventListener('scroll', updateRect, true);
            window.addEventListener('resize', updateRect);
            return () => {
                window.removeEventListener('scroll', updateRect, true);
                window.removeEventListener('resize', updateRect);
            };
        }, []);

        const fuzzyResults = useFuse(productNames, inputValue, {
            threshold: 0.3,
        });

        // Limit suggestions for performance and UI constraints
        const suggestions = fuzzyResults.slice(0, 8);

        const commitSelection = (val: string) => {
            const existingProduct = products.find(p => p.name.toLowerCase() === val.toLowerCase());

            if (existingProduct) {
                onRowChange({
                    ...row,
                    name: existingProduct.name,
                    category: existingProduct.category || 'Geral',
                    unit: existingProduct.unit || 'un',
                    price: existingProduct.price.toString(),
                    cost: (existingProduct.cost || 0).toString(),
                    // Quantity to ADD — addProduct sums it to the existing stock.
                    // (Pre-filling the current stock here used to double it on save.)
                    stock: '',
                    minStock: existingProduct.lowStockThreshold ? existingProduct.lowStockThreshold.toString() : '',
                    location: existingProduct.location || row.location,
                }, true);
            } else {
                onRowChange({ ...row, name: val }, true);
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'ArrowDown') {
                e.stopPropagation(); // prevent grid navigation
                setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowUp') {
                e.stopPropagation();
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
            } else if (e.key === 'Enter') {
                e.stopPropagation();
                if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
                    commitSelection(suggestions[highlightedIndex]);
                } else {
                    commitSelection(inputValue);
                }
                onClose(true);
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            } else if (e.key === 'Tab') {
                if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
                    commitSelection(suggestions[highlightedIndex]);
                } else {
                    commitSelection(inputValue);
                }
            }
        };

        // Scroll highlighted item into view
        useEffect(() => {
            if (highlightedIndex >= 0 && suggestionsRef.current) {
                const element = suggestionsRef.current.children[highlightedIndex] as HTMLElement;
                if (element) {
                    element.scrollIntoView({ block: 'nearest' });
                }
            }
        }, [highlightedIndex]);

        return (
            <div className="relative w-full h-full flex items-center bg-background">
                <input
                    ref={inputRef}
                    autoFocus
                    className="w-full h-full border-0 outline-none bg-transparent text-foreground px-2"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setHighlightedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        // Delay closing to allow click events on suggestions to fire
                        setTimeout(() => {
                            commitSelection(inputValue);
                            onClose(true);
                        }, 150);
                    }}
                />
                {suggestions.length > 0 && inputValue.length > 0 && typeof document !== 'undefined' && inputRect && createPortal(
                    <div
                        ref={suggestionsRef}
                        className="fixed bg-popover border shadow-lg z-[9999] rounded-b-md"
                        style={{
                            top: inputRect.bottom,
                            left: inputRect.left,
                            width: Math.max(inputRect.width, isMobile ? 200 : 250),
                            maxHeight: '200px',
                            overflow: 'auto',
                        }}
                    >
                        {suggestions.map((suggestion, index) => (
                            <div
                                key={suggestion}
                                className={`px-2 py-3 text-sm cursor-pointer border-b last:border-0 ${index === highlightedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
                                    }`}
                                onMouseDown={(e) => {
                                    // prevent input blur
                                    e.preventDefault();
                                }}
                                onClick={() => {
                                    commitSelection(suggestion);
                                    onClose(true);
                                }}
                            >
                                {suggestion}
                            </div>
                        ))}
                    </div>,
                    document.body
                )}
            </div>
        );
    };

    const columns: Column<RowData>[] = [
        { key: 'name', name: 'Nome do Produto', renderEditCell: NameEditor, minWidth: isMobile ? 220 : 250, frozen: true },
        {
            key: 'location',
            name: 'Localização',
            renderEditCell: LocationEditor,
            width: isMobile ? 120 : 150,
            renderCell: ({ row }) => {
                const locName = companyData?.locations?.find(l => l.id === row.location)?.name || "—";
                return (
                    <div className="flex items-center gap-1.5 h-full px-2 text-slate-600 dark:text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{locName}</span>
                    </div>
                );
            }
        },
        { key: 'category', name: 'Categoria', renderEditCell: CategoryEditor, width: isMobile ? 130 : 140 },
        { key: 'unit', name: 'Unid.', renderEditCell: UnitEditor, width: isMobile ? 80 : 90 },
        {
            key: 'cost',
            name: 'Custo (MTn)',
            renderEditCell: textEditor,
            width: isMobile ? 110 : 120,
            renderCell: ({ row }) => {
                const cost = parseFloat(row.cost);
                const isZero = isNaN(cost) || cost <= 0;
                return (
                    <div className={isZero ? "bg-destructive/20 text-destructive font-bold h-full flex items-center px-2" : "h-full flex items-center px-2"}>
                        {row.cost}
                    </div>
                );
            }
        },
        { key: 'price', name: 'Venda (MTn)', renderEditCell: textEditor, width: isMobile ? 110 : 120 },
        { key: 'stock', name: 'Qtd. a entrar', renderEditCell: textEditor, width: isMobile ? 90 : 100 },
        { key: 'minStock', name: 'Mínimo', renderEditCell: textEditor, width: isMobile ? 90 : 100 },
    ];

    const handleAddRow = () => {
        setRows([...rows, { name: '', category: '', unit: 'un', price: '', cost: '', stock: '', minStock: '', location: companyData?.locations?.[0]?.id || '' }]);
    };

    const handleSave = async () => {
        if (!(await requireEmailConfirmed())) return; // conta nova: confirma o email antes do primeiro produto
        const validRows = rows.filter(row =>
            row.name.trim() !== '' &&
            row.category.trim() !== '' &&
            row.price.trim() !== '' &&
            row.cost.trim() !== '' &&
            row.location.trim() !== ''
        );

        if (validRows.length === 0) {
            toast({ title: "Aviso", description: "Nenhum produto válido e completo para guardar. Apenas linhas totalmente preenchidas são adicionadas.", variant: "destructive" });
            return;
        }

        // Check for duplicates within the grid itself
        const seenNames = new Set<string>();
        const exactDuplicates: string[] = [];

        for (const row of validRows) {
            const normName = row.name.toLowerCase().trim();
            if (seenNames.has(normName)) {
                if (!exactDuplicates.includes(row.name)) {
                    exactDuplicates.push(row.name);
                }
            }
            seenNames.add(normName);
        }

        if (exactDuplicates.length > 0) {
            toast({
                title: "Existem duplicados na Grelha",
                description: `Por favor corrija e agrupe as quantidades dos produtos: ${exactDuplicates.join(', ')} antes de guardar.`,
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        let successCount = 0;

        // o empilhador a puxar a barra enquanto grava (fica vermelho se nenhum produto entrou)
        await haul("stock", "A dar entrada no stock…", "Stock actualizado", async () => {
            for (const row of validRows) {
                try {
                    // Ensure category exists in catalog
                    const categoryName = row.category.trim() || 'Geral';
                    const catExists = catalogCategories?.some(c => c.name.toLowerCase() === categoryName.toLowerCase());
                    if (!catExists && addCatalogCategory) {
                        await addCatalogCategory(categoryName);
                    }

                    // Ensure product exists in catalog
                    const prodName = row.name.trim();
                    const prodExists = catalogProducts?.some(p => p.name.toLowerCase() === prodName.toLowerCase());
                    if (!prodExists && addCatalogProduct) {
                        await addCatalogProduct({
                            name: prodName,
                            category: categoryName,
                            price: parseFloat(row.price) || 0,
                            unit: row.unit || 'un',
                            lowStockThreshold: parseFloat(row.minStock) || 0,
                            criticalStockThreshold: Math.floor((parseFloat(row.minStock) || 0) / 2),
                        });
                    }

                    const productData: Omit<Product, 'id' | 'companyId' | 'instanceId'> = {
                        name: prodName,
                        category: categoryName,
                        price: parseFloat(row.price) || 0,
                        stock: parseFloat(row.stock) || 0,
                        reservedStock: 0,
                        unit: row.unit || 'un',
                        location: row.location,
                        cost: parseFloat(row.cost) || 0,
                        lastUpdated: new Date().toISOString(),
                        lowStockThreshold: parseFloat(row.minStock) || 0,
                        criticalStockThreshold: Math.floor((parseFloat(row.minStock) || 0) / 2),
                    };
                    await addProduct(productData);
                    successCount++;
                } catch (error) {
                    console.error("Erro ao adicionar produto:", error, row);
                }
            }
            if (!successCount) throw new Error("nenhum produto adicionado");
        }).catch(() => { /* o aviso abaixo diz quantos entraram */ });

        setIsSaving(false);
        toast({
            title: "Sucesso",
            description: `${successCount} produto(s) adicionados!`,
        });

        if (onSuccess) onSuccess();

        // Reset keeping 5 rows
        setRows(Array.from({ length: 5 }, () => ({
            name: '', category: '', unit: 'un', price: '', cost: '', stock: '', minStock: '', location: companyData?.locations?.[0]?.id || ''
        })));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsExtracting(true);
        toast({ title: "A processar...", description: "A IA está a ler a imagem. Isto pode demorar alguns segundos." });

        try {
            // Convert to base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const fbToken = await auth.currentUser?.getIdToken();

            const response = await fetch('/api/extract-inventory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${fbToken}`
                },
                body: JSON.stringify({
                    imageBase64: base64,
                    companyId: companyId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Erro ao processar imagem.");
            }

            const data = await response.json();
            const extractedItems = data.items || [];

            if (extractedItems.length === 0) {
                toast({ variant: "destructive", title: "Nenhum Produto", description: "A IA não conseguiu identificar nenhum produto com quantidade legível na imagem." });
                return;
            }

            // Map to grid rows
            const newRows: RowData[] = [];
            const dLoc = companyData?.locations?.[0]?.id || '';

            extractedItems.forEach((item: { productName: string, quantity: number }) => {
                const searchName = item.productName.toLowerCase().trim();
                // Simple exact match first
                const exactMatch = products.find(p => p.name.toLowerCase() === searchName);

                if (exactMatch) {
                    newRows.push({
                        name: exactMatch.name,
                        category: exactMatch.category || 'Geral',
                        unit: exactMatch.unit || 'un',
                        price: exactMatch.price.toString(),
                        cost: (exactMatch.cost || 0).toString(),
                        stock: item.quantity.toString(),
                        minStock: exactMatch.lowStockThreshold?.toString() || '0',
                        location: exactMatch.location || dLoc
                    });
                } else {
                    // Try to find the closest match manually (simple included word matching)
                    const tokens = searchName.split(" ");
                    let bestMatch: any = null;
                    let bestCount = 0;

                    products.forEach(p => {
                        const pName = p.name.toLowerCase();
                        let matches = 0;
                        tokens.forEach(t => { if (t.length > 2 && pName.includes(t)) matches++; });
                        if (matches > bestCount) {
                            bestCount = matches;
                            bestMatch = p;
                        }
                    });

                    if (bestMatch && bestCount > 0) {
                        newRows.push({
                            name: bestMatch.name,
                            category: bestMatch.category || 'Geral',
                            unit: bestMatch.unit || 'un',
                            price: bestMatch.price.toString(),
                            cost: (bestMatch.cost || 0).toString(),
                            stock: item.quantity.toString(),
                            minStock: bestMatch.lowStockThreshold?.toString() || '0',
                            location: bestMatch.location || dLoc
                        });
                    } else {
                        // Unmatched generic entry
                        newRows.push({
                            name: item.productName,
                            category: '',
                            unit: 'un',
                            price: '',
                            cost: '',
                            stock: item.quantity.toString(),
                            minStock: '',
                            location: dLoc
                        });
                    }
                }
            });

            // Ensure at least 5 rows
            while (newRows.length < 5) {
                newRows.push({ name: '', category: '', unit: 'un', price: '', cost: '', stock: '', minStock: '', location: dLoc });
            }

            setRows(newRows);
            toast({ title: "Leitura Concluída", description: `Encontrados ${extractedItems.length} produtos. Verifique os dados abaixo antes de guardar.` });

        } catch (error: any) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro na Leitura da IA", description: error.message || "Tente tirar a foto com melhor iluminação." });
        } finally {
            setIsExtracting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <Card className="flex flex-col animate-in fade-in zoom-in-95 duration-200 border-none shadow-xl bg-white dark:bg-slate-900/50 overflow-hidden">
            <datalist id="categories-list">
                {categories.map(c => <option key={c} value={c} />)}
            </datalist>
            <datalist id="units-list">
                {units.map(u => <option key={u} value={u} />)}
            </datalist>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 md:p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex flex-col gap-1.5">
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Entrada Rápida e Físico</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Adicione produtos. {isMobile ? "Deslize para ver campos." : "Duplo clique para editar, TAB para navegar."}</p>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                    />
                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isExtracting}
                        className="h-10 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 border-indigo-200 dark:border-indigo-800/30 font-medium"
                    >
                        {isExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                        {isExtracting ? 'A Analisar...' : 'Scan com IA'}
                    </Button>
                </div>
            </div>

            <CardContent className="p-0">
                <div className="grid-container relative">
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        .grid-with-lines .rdg-cell {
                            border-right: 1px solid rgba(0,0,0,0.05);
                            border-bottom: 1px solid rgba(0,0,0,0.05);
                            background-color: transparent;
                            transition: background-color 0.2s;
                        }
                        .rdg-cell:hover {
                            background-color: rgba(0,0,0,0.02) !important;
                        }
                        .dark .grid-with-lines .rdg-cell {
                            border-right: 1px solid rgba(255,255,255,0.05);
                            border-bottom: 1px solid rgba(255,255,255,0.05);
                        }
                        .dark .rdg-cell:hover {
                            background-color: rgba(255,255,255,0.02) !important;
                        }
                        
                        .rdg-header-row .rdg-cell {
                            background-color: rgba(0,0,0,0.03) !important;
                            font-weight: 600;
                            text-transform: uppercase;
                            font-size: 0.7rem;
                            letter-spacing: 0.05em;
                            color: var(--muted-foreground);
                            border-bottom: 2px solid rgba(0,0,0,0.08) !important;
                        }
                        .dark .rdg-header-row .rdg-cell {
                            background-color: rgba(255,255,255,0.03) !important;
                            border-bottom: 2px solid rgba(255,255,255,0.08) !important;
                        }
                        
                        .rdg-cell-frozen {
                            z-index: 1;
                            background-color: rgba(255,255,255,0.95) !important;
                            backdrop-blur: sm;
                        }
                        .dark .rdg-cell-frozen {
                            background-color: rgba(15, 23, 42, 0.95) !important;
                        }
                    `}} />
                    <DataGrid
                        columns={columns}
                        rows={rows}
                        onRowsChange={setRows}
                        className={`${gridThemeClass} grid-with-lines border-none`}
                        style={{ height: 'max(400px, 50vh)', width: '100%' }}
                    />
                </div>

                <div className="flex justify-between items-center p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50">
                    <Button
                        onClick={handleAddRow}
                        variant="ghost"
                        className="h-10 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Mais uma Linha
                    </Button>

                    <Button
                        onClick={handleSave}
                        size="lg"
                        disabled={isSaving || rows.filter(r => r.name.trim() !== '').length === 0}
                        className="h-11 px-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-all shadow-lg"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                A Gravar...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-5 w-5" />
                                Guardar {rows.filter(r => r.name.trim() !== '').length} Produtos
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

