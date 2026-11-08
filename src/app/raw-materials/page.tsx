"use client";

import React, { useState, useContext, useMemo, useCallback } from 'react';
import { InventoryContext } from '@/context/inventory-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { PlusCircle, Trash2, Edit, AlertTriangle, Printer, Download, Factory } from 'lucide-react';
import * as z from 'zod';
import { Skeleton } from '@/components/ui/skeleton';
import { RawMaterial, Recipe, Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import Link from 'next/link';

const recipeIngredientSchema = z.object({
    rawMaterialId: z.string(),
    rawMaterialName: z.string(),
    quantity: z.preprocess((val) => {
        if (val === undefined || val === "" || val === null) return 1;
        const num = Number(val);
        return isNaN(num) ? 1 : num;
    }, z.number().min(1, "Min 1 unidade.")),
    yieldPerUnit: z.preprocess((val) => {
        if (val === undefined || val === "" || val === null) return 1;
        const num = Number(val);
        return isNaN(num) ? 1 : num;
    }, z.number().min(1, "Deve produzir pelo menos 1.")),
});
const recipeSchema = z.object({
    productName: z.string().nonempty("Selecione um produto final."),
    ingredients: z.array(recipeIngredientSchema).min(1, "Adicione pelo menos um ingrediente."),
});
type RecipeFormValues = z.infer<typeof recipeSchema>;



// Raw Materials Manager Component
const RawMaterialsManager = () => {
    const { rawMaterials, deleteRawMaterial, loading, companyData, confirmAction, isReadOnly } = useContext(InventoryContext)!;
    const { toast } = useToast();

    const handlePrint = () => {
        const printWindow = window.open('', '', 'height=800,width=800');
        if (printWindow) {
            printWindow.document.write('<!DOCTYPE html><html><head><title>Relatório de Matérias-Primas</title>');
            printWindow.document.write(`
                <style>
                    body { font-family: sans-serif; padding: 2rem; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                </style>
            `);
            printWindow.document.write('</head><body>');
            printWindow.document.write(`<h1>Relatório de Matérias-Primas - ${companyData?.name || ''}</h1>`);
            printWindow.document.write('<table><thead><tr><th>Nome</th><th>Stock</th><th>Custo Unit.</th><th>Unidade</th><th>Nível Mínimo</th></tr></thead><tbody>');
            (rawMaterials || []).forEach(material => {
                printWindow.document.write(`<tr><td>${material.name}</td><td>${material.stock}</td><td>${material.cost ? formatCurrency(material.cost) : 'N/A'}</td><td>${material.unit}</td><td>${material.lowStockThreshold}</td></tr>`);
            });
            printWindow.document.write('</tbody></table></body></html>');
            printWindow.document.close();
            setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
        }
    };

    const handleDownload = async () => {
        try {
            const { generateRawMaterialsPDF } = await import('@/lib/pdf-generator');
            generateRawMaterialsPDF('materials', rawMaterials || [], companyData);
            toast({ title: "Relatório gerado", description: "Relatório de insumos gerado com sucesso!" });
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            toast({ variant: "destructive", title: "Erro", description: "Erro ao gerar o relatório PDF." });
        }
    };

    if (loading) return <Skeleton className="h-64 w-full" />;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestão de Insumos</CardTitle>
                <CardDescription>Adicione e gira o stock das suas matérias-primas.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row justify-between mb-6 gap-3 pt-2">
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                        {isReadOnly ? (
                            <Button disabled className="w-full sm:w-auto bg-primary text-white" title="Indisponível em modo leitura">
                                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Matéria-Prima
                            </Button>
                        ) : (
                            <Button asChild data-tour="rm-add" className="w-full sm:w-auto bg-primary text-white">
                                <Link href="/raw-materials/new">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Matéria-Prima
                                </Link>
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={handleDownload} variant="outline" size="sm" className="flex-1 sm:flex-none"><Download className="mr-2 h-4 w-4" /> PDF</Button>
                        <Button onClick={handlePrint} variant="outline" size="sm" className="flex-1 sm:flex-none"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
                    </div>
                </div>
                <div className="rounded-md border overflow-x-auto hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Stock Atual</TableHead>
                                <TableHead>Custo Unit.</TableHead>
                                <TableHead>Unidade</TableHead>
                                <TableHead>Nível Mínimo</TableHead>
                                <TableHead><span className="sr-only">Ações</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rawMaterials && rawMaterials.length > 0 ? rawMaterials.map((material) => (
                                <TableRow key={material.id}>
                                    <TableCell className="font-medium">{material.name}</TableCell>
                                    <TableCell>{material.stock}</TableCell>
                                    <TableCell>{material.cost ? formatCurrency(material.cost) : 'N/A'}</TableCell>
                                    <TableCell>{material.unit}</TableCell>
                                    <TableCell>{material.lowStockThreshold}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button disabled={isReadOnly} title={isReadOnly ? "Indisponível em modo leitura" : ""} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => {
                                                confirmAction(async () => {
                                                    await deleteRawMaterial(material.id);
                                                }, "Apagar Matéria-Prima", `Tem a certeza que deseja apagar "${material.name}"? Esta ação não pode ser desfeita.`);
                                            }}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            {isReadOnly ? (
                                                <Button disabled variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Indisponível em modo leitura"><Edit className="h-4 w-4" /></Button>
                                            ) : (
                                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild><Link href={`/raw-materials/${material.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">Nenhuma matéria-prima cadastrada.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile Card View */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                    {rawMaterials && rawMaterials.length > 0 ? rawMaterials.map((material) => (
                        <Card key={material.id}>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-lg">{material.name}</CardTitle>
                                <CardDescription>Stock: {material.stock} {material.unit}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 pb-2 space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Custo Unit.:</span>
                                    <span>{material.cost ? formatCurrency(material.cost) : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Nível Mínimo:</span>
                                    <span>{material.lowStockThreshold}</span>
                                </div>
                            </CardContent>
                            <CardFooter className="p-2 flex justify-end gap-2 bg-muted/20">
                                <Button disabled={isReadOnly} title={isReadOnly ? "Indisponível em modo leitura" : ""} variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                                    confirmAction(async () => {
                                        await deleteRawMaterial(material.id);
                                    }, "Apagar Matéria-Prima", `Tem a certeza que deseja apagar "${material.name}"? Esta ação não pode ser desfeita.`);
                                }}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Apagar
                                </Button>
                                {isReadOnly ? (
                                    <Button disabled variant="ghost" size="sm" className="text-muted-foreground" title="Indisponível em modo leitura">
                                        <Edit className="h-4 w-4 mr-2" /> Editar
                                    </Button>
                                ) : (
                                    <Button variant="ghost" size="sm" asChild>
                                        <Link href={`/raw-materials/${material.id}/edit`}>
                                            <Edit className="h-4 w-4 mr-2" /> Editar
                                        </Link>
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    )) : (
                        <div className="text-center p-8 text-muted-foreground border rounded-md">
                            Nenhuma matéria-prima cadastrada.
                        </div>
                    )}
                </div>
            </CardContent>




        </Card>
    );
};

// Recipes Manager Component
const RecipesManager = () => {
    const { recipes, catalogProducts, rawMaterials, loading, companyData, confirmAction, isReadOnly } = useContext(InventoryContext)!;
    const { toast } = useToast();

    const handlePrint = () => {
        const printWindow = window.open('', '', 'height=800,width=800');
        if (printWindow) {
            printWindow.document.write('<!DOCTYPE html><html><head><title>Relatório de Receitas</title>');
            printWindow.document.write(`<style>body { font-family: sans-serif; padding: 2rem; } h2 { border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 2rem; } ul { list-style: none; padding-left: 0; } </style>`);
            printWindow.document.write('</head><body>');
            printWindow.document.write(`<h1>Relatório de Receitas - ${companyData?.name || ''}</h1>`);
            recipes.forEach(recipe => {
                printWindow.document.write(`<h2>${recipe.productName}</h2>`);
                printWindow.document.write('<ul>');
                recipe.ingredients.forEach(ing => {
                    printWindow.document.write(`<li>${ing.quantity} ${rawMaterials.find(rm => rm.id === ing.rawMaterialId)?.unit || ''} de ${ing.rawMaterialName}</li>`);
                });
                printWindow.document.write('</ul>');
            });
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
        }
    };

    const handleDownload = async () => {
        try {
            const { generateRawMaterialsPDF } = await import('@/lib/pdf-generator');
            generateRawMaterialsPDF('recipes', recipes || [], companyData);
            toast({ title: "Relatório gerado", description: "Relatório de receitas gerado com sucesso!" });
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            toast({ variant: "destructive", title: "Erro", description: "Erro ao gerar o relatório PDF." });
        }
    };

    if (loading) return <Skeleton className="h-64 w-full" />;

    return (
        <Card>
            <CardHeader><CardTitle>Receitas de Produção</CardTitle><CardDescription>Defina os componentes para cada produto final.</CardDescription></CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row justify-between mb-6 gap-3 pt-2">
                    {isReadOnly ? (
                        <Button disabled className="w-full sm:w-auto order-first sm:order-last bg-primary text-white" title="Indisponível em modo leitura">
                            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Receita
                        </Button>
                    ) : (
                        <Button asChild className="w-full sm:w-auto order-first sm:order-last bg-primary text-white">
                            <Link href="/raw-materials/recipes/new">
                                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Receita
                            </Link>
                        </Button>
                    )}
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={handleDownload} variant="outline" size="sm" className="flex-1 sm:flex-none"><Download className="mr-2 h-4 w-4" /> PDF</Button>
                        <Button onClick={handlePrint} variant="outline" size="sm" className="flex-1 sm:flex-none"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {recipes.map(recipe => (
                        <Card key={recipe.id} className="flex flex-col">
                            <CardHeader><CardTitle>{recipe.productName}</CardTitle></CardHeader>
                            <CardContent className="flex-grow">
                                <ul className="space-y-1.5">
                                    {recipe.ingredients.map((ing, index) => {
                                        const mat = rawMaterials.find(rm => rm.id === ing.rawMaterialId);
                                        const unit = mat?.unit || 'un';
                                        return (
                                            <li key={index} className="text-sm bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                                                {ing.yieldPerUnit && ing.yieldPerUnit > 1 ? (
                                                    <><strong>{ing.quantity} {unit}</strong> de {ing.rawMaterialName} <span className="text-primary font-semibold">→ {ing.yieldPerUnit} un</span></>
                                                ) : (
                                                    <><strong>{ing.quantity} {unit}</strong> de {ing.rawMaterialName} <span className="text-muted-foreground">por unidade</span></>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </CardContent>
                            <CardFooter>
                                {isReadOnly ? (
                                    <Button disabled variant="ghost" size="icon" className="text-muted-foreground" title="Indisponível em modo leitura">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button variant="ghost" size="icon" asChild>
                                        <Link href={`/raw-materials/recipes/${recipe.id}/edit`}>
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
};

// Production From Recipe Component
// Costs Manager Component
const CostsManager = () => {
    const { recipes, rawMaterials, loading, companyData } = useContext(InventoryContext)!;
    const { toast } = useToast();

    const recipeCosts = useMemo(() => {
        if (!recipes || !rawMaterials) return [];

        return recipes.map(recipe => {
            let totalCost = 0;
            let isCalculable = true;
            let missingMaterials: string[] = [];

            recipe.ingredients.forEach(ingredient => {
                const material = rawMaterials.find(rm => rm.id === ingredient.rawMaterialId);
                if (material && material.cost !== undefined) {
                    totalCost += ingredient.quantity * material.cost;
                } else {
                    isCalculable = false;
                    if (material) {
                        missingMaterials.push(material.name);
                    }
                }
            });

            return {
                ...recipe,
                totalCost,
                isCalculable,
                missingMaterialsTooltip: `Custo não definido para: ${missingMaterials.join(', ')}`
            };
        });
    }, [recipes, rawMaterials]);

    const handlePrint = () => {
        const printWindow = window.open('', '', 'height=800,width=800');
        if (printWindow) {
            printWindow.document.write('<!DOCTYPE html><html><head><title>Relatório de Custos</title>');
            printWindow.document.write(`<style>body { font-family: sans-serif; padding: 2rem; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; }</style>`);
            printWindow.document.write('</head><body>');
            printWindow.document.write(`<h1>Relatório de Custos de Produção - ${companyData?.name || ''}</h1>`);
            printWindow.document.write('<table><thead><tr><th>Produto Final</th><th>Custo de Produção / Unidade</th></tr></thead><tbody>');
            recipeCosts.forEach(recipe => {
                printWindow.document.write(`<tr><td>${recipe.productName}</td><td>${recipe.isCalculable ? formatCurrency(recipe.totalCost) : 'Incalculável'}</td></tr>`);
            });
            printWindow.document.write('</tbody></table></body></html>');
            printWindow.document.close();
            setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
        }
    };

    const handleDownload = async () => {
        try {
            const { generateRawMaterialsPDF } = await import('@/lib/pdf-generator');
            generateRawMaterialsPDF('costs', recipeCosts || [], companyData);
            toast({ title: "Relatório gerado", description: "Relatório de custos gerado com sucesso!" });
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            toast({ variant: "destructive", title: "Erro", description: "Erro ao gerar o relatório PDF." });
        }
    };

    if (loading) return <Skeleton className="h-64 w-full" />;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Análise de Custos de Produção</CardTitle>
                <CardDescription>Custo por unidade para cada produto com base nas suas receitas e no custo da matéria-prima.</CardDescription>
                <div className="flex flex-col sm:flex-row justify-end pt-2 gap-2">
                    <Button onClick={handleDownload} variant="outline" size="sm" className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" /> Baixar PDF</Button>
                    <Button onClick={handlePrint} variant="outline" size="sm" className="w-full sm:w-auto"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produto Final</TableHead>
                                <TableHead className="text-right">Custo de Produção / Unidade</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recipes && recipes.length > 0 ? recipeCosts.map((recipe) => (
                                <TableRow key={recipe.id}>
                                    <TableCell className="font-medium">{recipe.productName}</TableCell>
                                    <TableCell className="text-right">
                                        {recipe.isCalculable ? (
                                            <span className="font-bold">{formatCurrency(recipe.totalCost)}</span>
                                        ) : (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <span className="text-muted-foreground flex items-center justify-end gap-1 cursor-help">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            Incalculável
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{recipe.missingMaterialsTooltip}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center h-24">Nenhuma receita cadastrada.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};


export default function RawMaterialsPage() {
    const { canView, loading } = useContext(InventoryContext) || { canView: () => false, loading: true };
    const canViewPage = canView('raw-materials');

    if (loading) {
        return <div className="p-8"><Skeleton className="w-full h-96" /></div>;
    }

    if (!canViewPage) {
        return (
            <div className="flex items-center justify-center h-full">
                <Card className="p-8 text-center">
                    <CardHeader>
                        <CardTitle>Acesso Negado</CardTitle>
                        <CardDescription>Não tem permissão para aceder a este módulo.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-bold">Matéria-Prima</h1>
                    <p className="text-muted-foreground">
                        Os seus insumos, as receitas e quanto custa produzir.
                    </p>
                </div>
                {/* a produção regista-se num só sítio: a página Produção (que desconta a matéria-prima pela receita) */}
                <Button asChild variant="outline" data-tour="rm-register-production">
                    <Link href="/production/new"><Factory className="mr-2 h-4 w-4" /> Registar produção</Link>
                </Button>
            </div>
            <Tabs defaultValue="materials">
                <TabsList data-tour="rm-tabs" className="grid w-full grid-cols-3 h-auto">
                    <TabsTrigger value="materials">Insumos</TabsTrigger>
                    <TabsTrigger value="recipes">Receitas</TabsTrigger>
                    <TabsTrigger value="costs">Custos</TabsTrigger>
                </TabsList>
                <TabsContent value="materials" className="mt-4">
                    <RawMaterialsManager />
                </TabsContent>
                <TabsContent value="recipes" className="mt-4">
                    <RecipesManager />
                </TabsContent>
                <TabsContent value="costs" className="mt-4">
                    <CostsManager />
                </TabsContent>
            </Tabs>
        </div>
    );
}
