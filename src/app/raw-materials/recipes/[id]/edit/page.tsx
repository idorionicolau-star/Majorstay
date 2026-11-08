"use client";

import { useState, useContext, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";
import Link from 'next/link';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { InventoryContext } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";

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

export default function EditRecipePage() {
    const router = useRouter();
    const params = useParams();
    const recipeId = params.id as string;
    const { toast } = useToast();
    const { recipes, catalogProducts, rawMaterials, updateRecipe, canEdit, confirmAction } = useContext(InventoryContext)!;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const recipeToEdit = recipes?.find(r => r.id === recipeId);

    const form = useForm<RecipeFormValues>({
        resolver: zodResolver(recipeSchema),
        defaultValues: { productName: '', ingredients: [] },
    });

    useEffect(() => {
        if (recipeToEdit) {
            form.reset({
                ...recipeToEdit
            });
        }
    }, [recipeToEdit, form]);

    const addIngredient = () => {
        const ingredients = form.getValues('ingredients');
        const firstMaterial = rawMaterials[0];
        if (firstMaterial) {
            form.setValue('ingredients', [...ingredients, { rawMaterialId: firstMaterial.id, rawMaterialName: firstMaterial.name, quantity: 1, yieldPerUnit: 1 }]);
        }
    };

    const removeIngredient = (index: number) => {
        const ingredients = form.getValues('ingredients');
        form.setValue('ingredients', ingredients.filter((_, i) => i !== index));
    }

    async function onSubmit(values: RecipeFormValues) {
        if (!recipeToEdit) return;
        setIsSubmitting(true);
        try {
            await updateRecipe(recipeToEdit.id, values);
            toast({
                title: "Sucesso",
                description: "Receita atualizada com sucesso.",
                className: "border-emerald-500/50 text-emerald-500"
            });
            router.push('/raw-materials');
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Ocorreu um erro ao atualizar a receita.",
            });
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }

    // Deletion logic omitted if deleteRecipe was not part of the InventoryContextType

    if (!canEdit('raw-materials')) {
        return <div className="p-8 text-center text-red-500">Acesso negado. Apenas utilizadores autorizados podem editar receitas.</div>;
    }

    if (!recipeToEdit) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-bold">Editar Receita</h1>
                    <p className="text-muted-foreground text-sm">Atualize os componentes produtivos de {recipeToEdit.productName}.</p>
                </div>
            </div>

            <Card className="glass-panel p-6 border-none shadow-lg">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField control={form.control} name="productName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Produto Final</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger className="h-12 bg-background/50"><SelectValue placeholder="Selecione o produto final" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {catalogProducts.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="pt-4 border-t">
                            <FormLabel className="text-base font-semibold">Ingredientes</FormLabel>
                            <div className="mt-4 space-y-4">
                                {form.watch('ingredients').map((ing, index) => {
                                    const selectedMat = rawMaterials.find(rm => rm.id === ing.rawMaterialId);
                                    const matUnit = selectedMat?.unit || 'un';
                                    return (
                                        <div key={index} className="flex flex-col gap-3 p-4 border rounded-lg bg-slate-50 dark:bg-slate-800/20 relative">
                                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => removeIngredient(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <div className="pr-10">
                                                <FormField control={form.control} name={`ingredients.${index}.rawMaterialId`} render={({ field }) => (
                                                    <FormItem className="mb-3">
                                                        <FormLabel className="text-xs">Matéria-Prima</FormLabel>
                                                        <Select onValueChange={(value) => {
                                                            const material = rawMaterials.find(rm => rm.id === value);
                                                            field.onChange(value);
                                                            form.setValue(`ingredients.${index}.rawMaterialName`, material?.name || '');
                                                        }} defaultValue={field.value}>
                                                            <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {rawMaterials.map(rm => <SelectItem key={rm.id} value={rm.id}>{rm.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                                    <div className="flex-1 w-full">
                                                        <FormField control={form.control} name={`ingredients.${index}.quantity`} render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs">Quantidade Necessária ({matUnit})</FormLabel>
                                                                <FormControl><Input type="number" min={1} {...field} className="h-10 font-bold" /></FormControl>
                                                            </FormItem>
                                                        )} />
                                                    </div>
                                                    <div className="hidden sm:block mt-6 text-muted-foreground font-medium">→</div>
                                                    <div className="w-full sm:text-center shrink-0 mb-4 sm:mb-0 mt-2 sm:mt-6 sm:px-2 block">
                                                        <span className="text-muted-foreground text-xs sm:text-sm font-medium">Produz</span>
                                                    </div>
                                                    <div className="flex-1 w-full">
                                                        <FormField control={form.control} name={`ingredients.${index}.yieldPerUnit`} render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs">Unidades do Produto</FormLabel>
                                                                <FormControl><Input type="number" min={1} {...field} className="h-10 font-bold text-primary" /></FormControl>
                                                            </FormItem>
                                                        )} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {form.watch('ingredients').length === 0 && (
                                    <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                                        Nenhum ingrediente adicionado.
                                    </div>
                                )}

                                <Button type="button" variant="outline" className="w-full border-dashed" onClick={addIngredient}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Ingrediente
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border mt-8 justify-end">
                            <Button type="button" variant="outline" className="w-full sm:w-auto h-12" onClick={() => router.push('/raw-materials')}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="w-full sm:w-auto h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Alterações
                            </Button>
                        </div>
                    </form>
                </Form>
            </Card>
        </div>
    );
}
