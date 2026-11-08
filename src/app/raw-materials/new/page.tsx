"use client";

import { useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Loader2 } from "lucide-react";
import Link from 'next/link';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { InventoryContext } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";

const rawMaterialSchema = z.object({
    name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
    stock: z.preprocess((val) => {
        if (val === undefined || val === "" || val === null) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0, "O stock não pode ser negativo.")),
    unit: z.string().min(1, "Selecione uma unidade"),
    lowStockThreshold: z.preprocess((val) => {
        if (val === undefined || val === "" || val === null) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0, "O limite deve ser um número positivo.")),
    cost: z.preprocess((val) => {
        if (val === undefined || val === "" || val === null) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0, "O custo não pode ser negativo.").optional()),
});

type RawMaterialFormValues = z.infer<typeof rawMaterialSchema>;

export default function NewRawMaterialPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { addRawMaterial, availableUnits, canEdit } = useContext(InventoryContext)!;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<RawMaterialFormValues>({
        resolver: zodResolver(rawMaterialSchema),
        defaultValues: { name: '', stock: 0, unit: 'un', lowStockThreshold: 10, cost: 0 },
    });

    async function onSubmit(values: RawMaterialFormValues) {
        setIsSubmitting(true);
        try {
            await addRawMaterial(values);
            toast({
                title: "Sucesso",
                description: "Matéria-prima criada com sucesso.",
                className: "border-emerald-500/50 text-emerald-500"
            });
            router.push('/raw-materials');
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Ocorreu um erro ao criar a matéria-prima.",
            });
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!canEdit('raw-materials')) {
        return <div className="p-8 text-center text-red-500">Acesso negado. Apenas utilizadores autorizados podem adicionar matérias-primas.</div>;
    }

    return (
        <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-bold">Nova Matéria-Prima</h1>
                    <p className="text-muted-foreground text-sm">Adicione um novo insumo ao stock.</p>
                </div>
            </div>

            <Card className="glass-panel p-6 border-none shadow-lg">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Nome</FormLabel><FormControl><Input placeholder="Ex: Rolo de Papel Pintura" className="h-12 bg-background/50" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="stock" render={({ field }) => (
                                <FormItem><FormLabel>Stock Inicial</FormLabel><FormControl><Input type="number" className="h-12 bg-background/50" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="cost" render={({ field }) => (
                                <FormItem><FormLabel>Custo Unitário</FormLabel><FormControl><Input type="number" step="0.01" className="h-12 bg-background/50" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="unit" render={({ field }) => (
                            <FormItem><FormLabel>Unidade</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-12 bg-background/50"><SelectValue /></SelectTrigger></FormControl><SelectContent>
                                {availableUnits.map((u: string) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                            <FormItem><FormLabel>Nível Mínimo de Stock</FormLabel><FormControl><Input type="number" className="h-12 bg-background/50" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />

                        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border mt-8 justify-end">
                            <Button type="button" variant="outline" className="w-full sm:w-auto h-12" onClick={() => router.push('/raw-materials')}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="w-full sm:w-auto h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Matéria-Prima
                            </Button>
                        </div>
                    </form>
                </Form>
            </Card>
        </div>
    );
}
