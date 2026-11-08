"use client";

import { requireEmailConfirmed } from "@/components/billing/email-confirm";
import { useState, useContext, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { InventoryContext } from '@/context/inventory-context';
import type { CatalogCategory } from '@/lib/types';


const formSchema = z.object({
    name: z.string().nonempty({ message: "O nome é obrigatório." }),
    category: z.string().nonempty({ message: "A categoria é obrigatória." }),
    unit: z.enum(['un', 'm²', 'm', 'cj', 'outro']).default('un'),
    price: z.coerce.number().min(0, { message: "O preço deve ser positivo." }).default(0),
});

type FormValues = z.infer<typeof formSchema>;

interface QuickCreateProductDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultName: string;
    onSuccess: (productName: string, productDetails?: { unit: string; category: string; price: number }) => void;
}

export function QuickCreateProductDialog({ open, onOpenChange, defaultName, onSuccess }: QuickCreateProductDialogProps) {
    const inventoryContext = useContext(InventoryContext);

    const { addCatalogProduct, addCatalogCategory, catalogCategories, categorizeProductWithAI } = inventoryContext || { addCatalogProduct: async () => { }, addCatalogCategory: async () => { }, catalogCategories: [], categorizeProductWithAI: async () => null };
    const { toast } = useToast();
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [isCategorizing, setIsCategorizing] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: defaultName,
            category: "",
            unit: 'un',
            price: 0,
        },
    });

    useEffect(() => {
        if (open) {
            setIsCreatingCategory(false);
            form.reset({
                name: defaultName,
                category: "",
                unit: 'un',
                price: 0,
            });

            // Try auto-categorizing immediately if a default name was passed
            if (defaultName && categorizeProductWithAI) {
                setIsCategorizing(true);
                categorizeProductWithAI(defaultName).then(suggested => {
                    if (suggested) {
                        const exists = catalogCategories?.some((c: CatalogCategory) => c.name.toLowerCase() === suggested.toLowerCase());
                        if (!exists) setIsCreatingCategory(true);
                        form.setValue('category', suggested, { shouldValidate: true });
                    }
                }).finally(() => setIsCategorizing(false));
            }
        }
    }, [open, defaultName, form, categorizeProductWithAI, catalogCategories]);

    const handleNameBlur = async (e: React.FocusEvent<HTMLInputElement>, hookFormBlur: () => void) => {
        hookFormBlur();
        const currentName = e.target.value;
        const currentCategory = form.getValues('category');

        if (currentName.trim() && !currentCategory && categorizeProductWithAI) {
            setIsCategorizing(true);
            try {
                const suggested = await categorizeProductWithAI(currentName);
                if (suggested) {
                    const exists = catalogCategories?.some((c: CatalogCategory) => c.name.toLowerCase() === suggested.toLowerCase());
                    if (!exists) {
                        setIsCreatingCategory(true);
                    } else {
                        setIsCreatingCategory(false);
                    }
                    form.setValue('category', suggested, { shouldValidate: true });
                    toast({ title: "Categoria Sugerida (IA)", description: `O sistema classificou como: ${suggested}` });
                }
            } finally {
                setIsCategorizing(false);
            }
        }
    };

    const onSubmit = async (values: FormValues) => {
        if (!(await requireEmailConfirmed())) return; // conta nova: confirma o email antes do primeiro produto
        // 0. Ensure Category Exists
        if (isCreatingCategory && values.category.trim() !== "") {
            try {
                // Determine if it already exists (case insensitive) to prevent duplicates at UI level
                // (Context also handles this, but good to be safe)
                const exists = catalogCategories?.some((c: CatalogCategory) => c.name.toLowerCase() === values.category.trim().toLowerCase());
                if (!exists) {
                    await addCatalogCategory(values.category.trim());
                }
            } catch (error) {
                console.error("Failed to create category", error);
                toast({ variant: "destructive", title: "Erro na Categoria", description: "Não foi possível criar a nova categoria." });
                return;
            }
        }

        // 1. Add to Catalog ONLY (Persistent definition)
        try {
            await addCatalogProduct({
                name: values.name,
                category: values.category,
                price: values.price,
                unit: values.unit,
                lowStockThreshold: 10,
                criticalStockThreshold: 5,
            });
        } catch (error) {
            console.error("Failed to add to catalog", error);
            toast({ variant: "destructive", title: "Erro no Catálogo", description: "Não foi possível salvar no catálogo." });
            return;
        }

        // 3. Feedback & Close
        toast({
            title: "Produto Criado",
            description: `"${values.name}" foi adicionado ao catálogo.`
        });

        // Pass back details to auto-fill
        onSuccess(values.name, { unit: values.unit, category: values.category, price: values.price });
        onOpenChange(false);
    };

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Novo Produto de Catálogo"
            description="Defina o produto para o adicionar ao catálogo e usar na produção."
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nome do Produto</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        onBlur={(e) => handleNameBlur(e, field.onBlur)}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Preço Base (MT)</FormLabel>
                                    <FormControl>
                                        <Input type="number" min="0" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="unit"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unidade</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="un">Unidade (un)</SelectItem>
                                            <SelectItem value="m²">Metro Quadrado (m²)</SelectItem>
                                            <SelectItem value="m">Metro Linear (m)</SelectItem>
                                            <SelectItem value="cj">Conjunto (cj)</SelectItem>
                                            <SelectItem value="outro">Outro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    <FormLabel className="flex items-center gap-2">
                                        Categoria
                                        {isCategorizing && <span className="text-xs text-indigo-500 animate-pulse">(IA a processar...)</span>}
                                    </FormLabel>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
                                        onClick={() => {
                                            setIsCreatingCategory(!isCreatingCategory);
                                            form.setValue('category', ''); // Clear on toggle
                                        }}
                                    >
                                        {isCreatingCategory ? "Escolher Existente" : "+ Nova Categoria"}
                                    </Button>
                                </div>
                                {isCreatingCategory ? (
                                    <FormControl>
                                        <Input placeholder="Nome da nova categoria..." {...field} />
                                    </FormControl>
                                ) : (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {(field.value && !catalogCategories?.some((c: CatalogCategory) => c.name === field.value)) && (
                                                <SelectItem value={field.value}>{field.value}</SelectItem>
                                            )}
                                            {catalogCategories?.map((cat: CatalogCategory) => (
                                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit">Criar Produto</Button>
                    </div>
                </form>
            </Form>
        </ResponsiveDialog>
    );
}
