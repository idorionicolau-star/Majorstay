"use client";

import { LocationSelectItems } from '@/components/ui/location-select-items';
import { requireEmailConfirmed } from "@/components/billing/email-confirm";
import { habitualLocation, recordLocation } from "@/lib/habitual-location";
import { useState, useEffect, useContext } from 'react';
import { useInventoryBackHref } from "@/hooks/use-inventory-back";
import { useRouter } from 'next/navigation';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MathInput } from "@/components/ui/math-input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Product, Location } from '@/lib/types';
import { InventoryContext } from '@/context/inventory-context';
import { findNameMatches } from '@/lib/new-product';
import { CatalogProductSelector } from '@/components/catalog/catalog-product-selector';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, AlertTriangle, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadProductImage } from '@/lib/upload-product-image';
import { getFirebaseAuth } from '@/firebase/provider';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useStorage } from '@/firebase/provider';
import { Card } from "@/components/ui/card";
import Link from 'next/link';

type CatalogProduct = Omit<Product, 'stock' | 'instanceId' | 'reservedStock' | 'location' | 'lastUpdated'>;

const robustNumber = z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
}, z.number().min(0, { message: "O valor não pode ser negativo." }));

const formSchema = z.object({
    name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
    category: z.string().min(1, { message: "A categoria é obrigatória." }),
    price: robustNumber,
    stock: robustNumber,
    unit: z.string().default('un'),
    lowStockThreshold: robustNumber,
    criticalStockThreshold: robustNumber,
    location: z.string().optional(),
});

type AddProductFormValues = z.infer<typeof formSchema>;

export default function NewInventoryProductPage() {
    const backHref = useInventoryBackHref();
    const router = useRouter();
    const inventoryContext = useContext(InventoryContext);
    const { products, catalogCategories, catalogProducts, locations, isMultiLocation, addCatalogProduct, addCatalogCategory, availableUnits, addProduct } = inventoryContext || { products: [], catalogCategories: [], catalogProducts: [], locations: [], isMultiLocation: false, addCatalogProduct: async () => { }, addCatalogCategory: async () => { }, availableUnits: [], addProduct: async () => { } };
    const [isCatalogProductSelected, setIsCatalogProductSelected] = useState(false);
    const { toast } = useToast();
    const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [similarProduct, setSimilarProduct] = useState<{ name: string; match: number } | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const storage = useStorage();

    const form = useForm<AddProductFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            category: "",
            name: "",
            unit: "un",
            lowStockThreshold: 10,
            criticalStockThreshold: 5,
            location: "",
        },
    });

    useEffect(() => {
        const savedLocation = habitualLocation(locations.map((l: Location) => l.id));
        const locationExists = locations.some(l => l.id === savedLocation);
        const finalLocation = (savedLocation && locationExists)
            ? savedLocation
            : (locations.length > 0 ? locations[0].id : "");

        form.reset({
            category: "",
            name: "",
            unit: 'un',
            lowStockThreshold: 10,
            criticalStockThreshold: 5,
            location: finalLocation,
        });
        setImageFile(null);
    }, [locations, form]);

    const handleProductSelect = (productName: string, product?: CatalogProduct) => {
        form.setValue('name', productName, { shouldValidate: true });
        if (product) {
            setIsCatalogProductSelected(true);
            form.setValue('price', product.price);
            form.setValue('lowStockThreshold', product.lowStockThreshold);
            form.setValue('criticalStockThreshold', product.criticalStockThreshold);
            form.setValue('category', product.category, { shouldValidate: true });
            if (product.unit) {
                form.setValue('unit', product.unit);
            }
        } else {
            setIsCatalogProductSelected(false);
            form.setValue('price', 0);
            form.setValue('category', '', { shouldValidate: true });
        }
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            toast({
                variant: 'destructive',
                title: 'Nome da categoria inválido',
                description: 'O nome da categoria não pode estar em branco.',
            });
            return;
        }
        if (addCatalogCategory) {
            await addCatalogCategory(newCategoryName);
            form.setValue('category', newCategoryName, { shouldValidate: true });
            setShowAddCategoryDialog(false);
            setNewCategoryName('');
            toast({
                title: 'Categoria adicionada',
                description: `"${newCategoryName}" foi adicionada e selecionada.`,
            });
        }
    };

    async function onSubmit(values: AddProductFormValues) {
        if (!(await requireEmailConfirmed())) return; // conta nova: confirma o email antes do primeiro produto
        if (isMultiLocation && !values.location) {
            form.setError("location", { type: "manual", message: "Por favor, selecione uma localização." });
            return;
        }

        if (!isCatalogProductSelected) {
            if (!values.category.trim()) {
                form.setError("category", { type: "manual", message: "A categoria é obrigatória para novos produtos." });
                return;
            }
            try {
                if (addCatalogCategory) await addCatalogCategory(values.category);

                if (addCatalogProduct) {
                    await addCatalogProduct({
                        name: values.name,
                        category: values.category,
                        price: values.price,
                        unit: values.unit,
                        lowStockThreshold: values.lowStockThreshold,
                        criticalStockThreshold: values.criticalStockThreshold,
                    });
                }

                toast({
                    title: "Produto de Catálogo Criado",
                    description: `${values.name} foi adicionado ao catálogo.`,
                });

            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Erro ao Criar no Catálogo', description: error.message });
                return;
            }
        }

        if (values.location) {
            recordLocation(values.location);
        }

        let imageUrl: string | null = null;
        if (imageFile) {
            try {
                imageUrl = await uploadProductImage(imageFile, getFirebaseAuth(), inventoryContext?.companyId || "");
            } catch (error) {
                console.error("Error uploading image:", error);
                toast({
                    variant: 'destructive',
                    title: 'Erro ao fazer upload da imagem',
                    description: `${(error as any)?.message || error}. O produto será criado sem imagem.`
                });
            }
        }

        const newProduct: Omit<Product, 'id' | 'lastUpdated' | 'instanceId' | 'reservedStock'> = {
            name: values.name,
            category: values.category,
            stock: values.stock,
            price: values.price,
            lowStockThreshold: values.lowStockThreshold,
            criticalStockThreshold: values.criticalStockThreshold,
            location: values.location,
            unit: values.unit,
            imageUrl: imageUrl as any,
        };

        try {
            await addProduct(newProduct);
            toast({
                title: "Produto Adicionado",
                description: `${values.name} foi adicionado ao inventário com sucesso.`,
            });
            router.push(backHref);
        } catch (error: any) {
            console.error("Error adding product:", error);
        }
    }

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-bold">Adicionar Novo Produto</h1>
                    <p className="text-muted-foreground text-sm">Preencha os dados do novo produto no inventário.</p>
                </div>
            </div>

            <Card className="glass-panel p-6 border-none shadow-lg">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => {
                                // eslint-disable-next-line react-hooks/rules-of-hooks
                                useEffect(() => {
                                    if (!field.value || field.value.length < 3) {
                                        setSimilarProduct(null);
                                        return;
                                    }

                                    const handler = setTimeout(() => {
                                        const best = findNameMatches(field.value, { inventory: products, catalog: [] }, { minScore: 0.7, limit: 1 })[0];
                                        const bestMatch = best && best.name !== field.value ? best : null;
                                        const maxSim = bestMatch?.score ?? 0;

                                        if (bestMatch) {
                                            setSimilarProduct({ name: bestMatch.name, match: maxSim });
                                        } else {
                                            setSimilarProduct(null);
                                        }
                                    }, 500);

                                    return () => clearTimeout(handler);
                                }, [field.value, setSimilarProduct]);

                                return (
                                    <FormItem>
                                        <FormLabel>Produto</FormLabel>
                                        <FormControl>
                                            <CatalogProductSelector
                                                products={catalogProducts}
                                                categories={catalogCategories}
                                                selectedValue={field.value}
                                                onValueChange={handleProductSelect}
                                            />
                                        </FormControl>

                                        <FormItem className="mt-4">
                                            <FormLabel>Imagem do Produto</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-4">
                                                    {imageFile ? (
                                                        <div className="relative h-20 w-20 rounded-md overflow-hidden border">
                                                            <img
                                                                src={URL.createObjectURL(imageFile)}
                                                                alt="Preview"
                                                                className="h-full w-full object-cover"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                className="absolute top-0 right-0 h-5 w-5 rounded-bl-sm"
                                                                onClick={() => setImageFile(null)}
                                                            >
                                                                <span className="sr-only">Remover</span>
                                                                <span className="text-xs">×</span>
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="h-20 w-20 rounded-md border border-dashed flex items-center justify-center bg-muted/50 text-muted-foreground">
                                                            <ImageIcon className="h-8 w-8 opacity-50" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => {
                                                                if (e.target.files && e.target.files[0]) {
                                                                    setImageFile(e.target.files[0]);
                                                                }
                                                            }}
                                                            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                                        />
                                                        <FormDescription>
                                                            Selecione uma imagem para o produto (opcional).
                                                        </FormDescription>
                                                    </div>
                                                </div>
                                            </FormControl>
                                        </FormItem>

                                        {similarProduct && (
                                            <div className="mt-2 text-sm p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-300">
                                                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <p className="font-medium text-yellow-800 dark:text-yellow-400">Possível Duplicado Encontrado</p>
                                                    <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                                                        Existe um produto muito similar no seu inventário: <strong>"{similarProduct.name}"</strong>.
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="mt-2 border-yellow-300 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100 dark:border-yellow-700 dark:hover:bg-yellow-700 w-full sm:w-auto"
                                                        onClick={() => {
                                                            handleProductSelect(similarProduct.name, undefined);
                                                            setSimilarProduct(null);
                                                        }}
                                                        type="button"
                                                    >
                                                        Corrigir para "{similarProduct.name}"
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )
                            }}
                        />

                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoria</FormLabel>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            disabled={isCatalogProductSelected}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione uma categoria" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {(field.value && !(catalogCategories || []).some(c => c.name === field.value)) && (
                                                    <SelectItem value={field.value}>
                                                        {field.value}
                                                    </SelectItem>
                                                )}
                                                {(catalogCategories || []).sort((a, b) => a.name.localeCompare(b.name)).map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.name}>
                                                        {cat.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {!isCatalogProductSelected && (
                                            <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
                                                <DialogTrigger asChild>
                                                    <Button type="button" variant="outline" size="icon" className="flex-shrink-0">
                                                        <PlusCircle className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-md">
                                                    <DialogHeader>
                                                        <DialogTitle>Adicionar Nova Categoria</DialogTitle>
                                                        <DialogDescription>
                                                            Digite o nome da nova categoria.
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="py-4">
                                                        <Input
                                                            placeholder="Nome da categoria"
                                                            value={newCategoryName}
                                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddCategory();
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <DialogFooter>
                                                        <Button type="button" variant="secondary" onClick={() => setShowAddCategoryDialog(false)}>
                                                            Cancelar
                                                        </Button>
                                                        <Button type="button" onClick={handleAddCategory}>
                                                            Adicionar
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </div>
                                    {isCatalogProductSelected && <FormDescription>A categoria é definida pelo produto do catálogo.</FormDescription>}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {isMultiLocation && (
                            <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Localização</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione uma localização" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <LocationSelectItems locations={locations} />
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Preço Unitário (MT)</FormLabel>
                                    <FormControl>
                                        <MathInput
                                            {...field}
                                            onValueChange={field.onChange}
                                            placeholder="0.00"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="stock"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Estoque Inicial</FormLabel>
                                        <FormControl>
                                            <MathInput
                                                {...field}
                                                onValueChange={field.onChange}
                                                placeholder="0"
                                            />
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
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {availableUnits.map((u: string) => (
                                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="lowStockThreshold"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Alerta Baixo</FormLabel>
                                        <FormControl>
                                            <MathInput
                                                {...field}
                                                onValueChange={field.onChange}
                                                placeholder="10"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="criticalStockThreshold"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Alerta Crítico</FormLabel>
                                        <FormControl>
                                            <MathInput
                                                {...field}
                                                onValueChange={field.onChange}
                                                placeholder="5"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-6 border-t border-border mt-8">
                            <Button type="button" variant="outline" className="w-full sm:w-auto h-12" onClick={() => router.push(backHref)}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="w-full sm:w-auto h-12 px-8" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Adicionar Produto
                            </Button>
                        </div>
                    </form>
                </Form>
            </Card>
        </div>
    );
}
