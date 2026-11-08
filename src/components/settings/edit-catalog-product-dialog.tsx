

"use client";

import { useState, useEffect } from 'react';
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
import { ProductImageField } from "@/components/catalog/product-image-field";
import { CostBarcodeFields } from "@/components/catalog/cost-barcode-fields";
import { Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Product } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';

const formSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  category: z.string().min(2, { message: "A categoria é obrigatória." }),
  price: z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }, z.number().min(0, { message: "O preço não pode ser negativo." })),
  unit: z.string().optional(),
  imageUrl: z.string().optional(),
  cost: z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }, z.number().min(0, { message: "O custo não pode ser negativo." })),
  barcode: z.string().optional(),
  lowStockThreshold: z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }, z.number().min(0)),
  criticalStockThreshold: z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }, z.number().min(0)),
});

type FormValues = z.infer<typeof formSchema>;

interface EditCatalogProductDialogProps {
  product: Omit<Product, 'stock' | 'instanceId' | 'reservedStock' | 'location' | 'lastUpdated'> & { id?: string };
  categories: string[];
  units: string[];
  onUpdate: (productId: string, data: Partial<Product>) => void;
  /** Produtos já no catálogo (para avisar de códigos de barras repetidos). */
  catalog?: { id?: string; name: string; barcode?: string }[];
}

function EditCatalogProductDialogContent({ product, categories, units, onUpdate, catalog, setOpen }: EditCatalogProductDialogProps & { setOpen: (open: boolean) => void; }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...product, unit: product.unit || 'un', imageUrl: product.imageUrl ?? '', cost: product.cost || 0, barcode: product.barcode ?? '' },
  });

  function onSubmit(values: FormValues) {
    if (product.id) {
      onUpdate(product.id, { ...values, cost: values.cost || 0, barcode: (values.barcode || '').trim() });
    }
    setOpen(false);
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Editar Produto do Catálogo</DialogTitle>
        <DialogDescription>
          Altere os detalhes base deste produto.
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="md:max-h-[70vh] md:-mr-3 md:pr-3">
        <Form {...form}>
          <form data-tour="catalog-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 pr-2">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Foto (opcional)</FormLabel>
                  <ProductImageField value={field.value} onChange={field.onChange} />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço Unitário</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.length > 0 ? units.map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        )) : (
                          <SelectItem value="un">un</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <CostBarcodeFields catalog={catalog || []} exceptId={product.id} />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lowStockThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alerta Baixo</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
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
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" data-tour="catalog-edit-submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </Form>
      </ScrollArea>
    </DialogContent>
  )
}

export function EditCatalogProductDialog({ open: openProp, onOpenChange, hideTrigger, ...props }: EditCatalogProductDialogProps & {
  /** Modo controlado: a página decide quando abre (ex.: tocar num cartão). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const setOpen = (o: boolean) => { setInnerOpen(o); onOpenChange?.(o); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${props.product.name}`}>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DialogTrigger>
      )}
      {open && <EditCatalogProductDialogContent {...props} setOpen={setOpen} />}
    </Dialog>
  );
}
