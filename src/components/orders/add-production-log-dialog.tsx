"use client";

import { useState, useContext } from 'react';
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Order } from '@/lib/types';
import { InventoryContext } from '@/context/inventory-context';
import { orderToProduce } from '@/lib/order-stock';

const formSchema = z.object({
  quantity: z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }, z.number().min(0.01, { message: "A quantidade deve ser maior que zero." })),
  notes: z.string().optional(),
});

type AddLogFormValues = z.infer<typeof formSchema>;

interface AddProductionLogDialogProps {
  order: Order;
  onAddLog: (orderId: string, logData: { quantity: number; notes?: string }) => void;
}

export function AddProductionLogDialog({ order, onAddLog }: AddProductionLogDialogProps) {
  const [open, setOpen] = useState(false);


  const form = useForm<AddLogFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      notes: "",
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const remainingQuantity = orderToProduce(order);

  async function onSubmit(values: AddLogFormValues) {
    if (values.quantity > remainingQuantity) {
      form.setError("quantity", { type: "manual", message: `A quantidade excede o restante. Faltam ${remainingQuantity}.` });
      return;
    }

    setIsSubmitting(true);

    // Simulate a brief delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));

    onAddLog(order.id, values);

    setOpen(false);

    // Reset form after dialog close animation
    setTimeout(() => {
      form.reset();
      setIsSubmitting(false);
    }, 300);
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="Registar Produção da Encomenda"
      description={`Encomenda #${order.id.slice(-6).toUpperCase()} • ${order.productName}`}
      trigger={
        <Button variant="outline" className="flex-1" size="sm" onClick={(e) => e.stopPropagation()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Registar
        </Button>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <div className='flex items-baseline justify-between'>
                  <FormLabel>Quantidade Produzida Hoje</FormLabel>
                  <p className='text-xs text-muted-foreground'>Faltam: {remainingQuantity}</p>
                </div>
                <FormControl>
                  <Input type="number" step="any" min="0.01" max={remainingQuantity} {...field} placeholder="0.0" disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas (Opcional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Alguma observação sobre a produção de hoje?" {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  A registar...
                </>
              ) : (
                "Adicionar Registo"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
