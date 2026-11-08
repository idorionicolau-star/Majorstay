"use client";

import * as React from 'react';
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
import { MathInput } from "@/components/ui/math-input";
import { FileCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Product } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { InventoryContext } from '@/context/inventory-context';
import { Textarea } from '../ui/textarea';
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  physicalCount: z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }, z.number().min(0, { message: "A contagem não pode ser negativa." })),
  reason: z.string().min(3, { message: "O motivo deve ter pelo menos 3 caracteres." }),
});

type AuditStockFormValues = z.infer<typeof formSchema>;

interface AuditStockDialogProps {
  product: Product;
  trigger: 'icon' | 'button' | 'card-button';
  disabled?: boolean;
}

function AuditStockDialogContent({ product, setOpen }: Omit<AuditStockDialogProps, 'trigger' | 'disabled'> & { setOpen: (open: boolean) => void }) {
  const { auditStock, isReadOnly } = useContext(InventoryContext) || {};
  const { toast } = useToast();
  const form = useForm<AuditStockFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      physicalCount: product.stock,
      reason: 'Auditoria de rotina',
    },
  });

  async function onSubmit(values: AuditStockFormValues) {
    if (!auditStock) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro interno: Função de auditoria não encontrada.' });
      return;
    }
    if (isReadOnly) {
      toast({ variant: 'destructive', title: 'Acesso Restrito', description: 'Conta em modo leitura — contacte o suporte.' });
      return;
    }
    try {
      await auditStock(product, values.physicalCount, values.reason);
      setOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível guardar a auditoria', description: e?.message || 'Tente de novo.' });
    }
  }

  const systemStock = product.stock;
  const physicalCount = form.watch('physicalCount');
  const adjustment = physicalCount - systemStock;
  const reserved = product.reservedStock || 0;
  const belowReserved = reserved > 0 && physicalCount < reserved;

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => console.error("Form errors:", errors))} className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Stock no Sistema</p>
              <p className="text-2xl font-bold">{systemStock}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Ajuste</p>
              <p className={`text-2xl font-bold ${adjustment > 0 ? 'text-green-500' : adjustment < 0 ? 'text-destructive' : ''}`}>
                {adjustment > 0 ? `+${adjustment}` : adjustment}
              </p>
            </div>
          </div>

          <FormField
            control={form.control}
            name="physicalCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contagem Física Atual</FormLabel>
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
          {belowReserved && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              Atenção: há {reserved} reservado{reserved > 1 ? 's' : ''} (vendas pagas por levantar ou encomendas) e a contagem é {physicalCount}. O disponível ficará negativo.
            </p>
          )}
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Motivo do Ajuste</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Confirmar Ajuste</Button>
          </div>
        </form>
      </Form>
    </>
  );
}



/**
 * O botão que abre a auditoria. Tem de reencaminhar as propriedades e a ref que o DialogTrigger lhe entrega
 * (onClick, aria-*…): sem isso o toque no botão não fazia nada e a janela nunca abria.
 */
const AuditStockTrigger = React.forwardRef<HTMLButtonElement, { trigger: 'icon' | 'button' | 'card-button'; disabled?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function AuditStockTrigger({ trigger, disabled, ...rest }, ref) {
    const buttonClasses = "text-amber-500 hover:bg-amber-500/10 hover:text-amber-600 dark:text-yellow-500 dark:hover:bg-yellow-500/10 dark:hover:text-yellow-400";
    if (trigger === 'icon') {
      return (
        <TooltipTrigger asChild>
          <Button ref={ref} {...rest} disabled={disabled} variant="ghost" size="icon" className={`p-3 h-auto w-auto rounded-xl transition-all ${buttonClasses}`}>
            <FileCheck className="h-4 w-4" />
            <span className="sr-only">Contar este produto</span>
          </Button>
        </TooltipTrigger>
      );
    }
    return (
      <TooltipTrigger asChild>
        <Button ref={ref} {...rest} disabled={disabled} variant="outline" size="icon" className={`flex-1 h-8 sm:h-9 ${buttonClasses}`}>
          <FileCheck className="h-4 w-4" />
          <span className="sr-only">Contar este produto</span>
        </Button>
      </TooltipTrigger>
    );
  },
);

export function AuditStockDialog({ product, trigger, disabled }: AuditStockDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
      <Tooltip>
        {disabled ? (
          <AuditStockTrigger trigger={trigger} disabled={disabled} />
        ) : (
          <ResponsiveDialog
            open={open}
            onOpenChange={setOpen}
            title={`Contar: ${product.name}`}
            description="Conte o que tem na prateleira e escreva aqui: o stock fica certo e a diferença vai para as Perdas."
            trigger={<AuditStockTrigger trigger={trigger} />}
          >
            <AuditStockDialogContent product={product} setOpen={setOpen} />
          </ResponsiveDialog>
        )}
        <TooltipContent><p>{disabled ? "Indisponível em modo leitura" : "Contar este produto"}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
