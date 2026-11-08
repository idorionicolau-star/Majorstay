"use client";

import { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { withSaleTime } from '@/lib/sale-time';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Product, Sale } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { InventoryContext } from '@/context/inventory-context';
import { useCRM } from '@/context/crm-context';
import { CatalogProductSelector } from '../catalog/catalog-product-selector';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { DatePicker } from '../ui/date-picker';
import { Check, ChevronsUpDown, UserPlus } from 'lucide-react';
import { paidAfterEdit } from '@/lib/sale-filters';

type CatalogProduct = Omit<Product, 'stock' | 'instanceId' | 'reservedStock' | 'location' | 'lastUpdated'>;

const formSchema = z.object({
  productName: z.string().nonempty({ message: "Por favor, selecione um produto." }),
  quantity: z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }, z.number().min(0.01, { message: "A quantidade deve ser maior que zero." })),
  unit: z.enum(['un', 'm²', 'm', 'cj', 'outro']).optional(),
  unitPrice: z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }, z.number().min(0, { message: "O preço não pode ser negativo." })),
  amountPaid: z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }, z.number().min(0, "O valor pago não pode ser negativo.").optional()),
  documentType: z.enum(['Venda a Dinheiro', 'Guia de Remessa', 'Factura', 'Factura Proforma', 'Recibo', 'Encomenda', 'Cotação']),
  clientName: z.string().optional(),
  customerId: z.string().optional(),
  notes: z.string().optional(),
  date: z.date(),
});

type EditSaleFormValues = z.infer<typeof formSchema>;

const UNITS = ['un', 'm²', 'm', 'cj', 'outro'] as const;
// As vendas antigas guardam a unidade como texto livre; só aceita as do formulário.
const toUnit = (u?: string): EditSaleFormValues['unit'] => (UNITS as readonly string[]).includes(u || '') ? (u as (typeof UNITS)[number]) : 'un';

interface EditSaleDialogProps {
  sale: Sale;
  onUpdateSale: (sale: Sale) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function EditSaleDialogContent({ sale, onUpdateSale, onOpenChange, open }: EditSaleDialogProps) {
  const inventoryContext = useContext(InventoryContext);
  const { products, catalogProducts, catalogCategories, isMultiLocation } = inventoryContext || { products: [], catalogProducts: [], catalogCategories: [], isMultiLocation: false };
  const { customers, addCustomer } = useCRM();

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);

  const form = useForm<EditSaleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: sale.productName,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      amountPaid: sale.amountPaid ?? 0,
      unit: toUnit(sale.unit),
      documentType: sale.documentType,
      clientName: sale.clientName || '',
      customerId: sale.customerId || '',
      notes: sale.notes || '',
      date: new Date(sale.date),
    },
  });

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(search));
  }, [customers, customerSearch]);

  const exactMatch = useMemo(() => {
    return customers.some(c => c.name.toLowerCase() === customerSearch.trim().toLowerCase());
  }, [customers, customerSearch]);

  const handleSelectCustomer = (customer: { id: string; name: string }) => {
    form.setValue('clientName', customer.name);
    form.setValue('customerId', customer.id);
    setCustomerSearch('');
    setCustomerPopoverOpen(false);
  };

  const handleCreateCustomer = async () => {
    const name = customerSearch.trim();
    if (!name) return;
    try {
      const newId = await addCustomer({ name });
      if (newId) {
        form.setValue('clientName', name);
        form.setValue('customerId', newId);
      }
      setCustomerSearch('');
      setCustomerPopoverOpen(false);
    } catch { }
  };

  const productsInStock = useMemo(() => {
    if (!products || !catalogProducts) return [];

    const productsForLocation = isMultiLocation && sale.location
      ? products.filter(p => p.location === sale.location)
      : products;

    const inStockOrCurrent = productsForLocation.filter(p =>
      ((p.stock - p.reservedStock) > 0) || (p.name === sale.productName)
    );

    const availableProductNames = [...new Set(inStockOrCurrent.map(p => p.name))];

    return catalogProducts.filter(p => availableProductNames.includes(p.name));
  }, [products, catalogProducts, isMultiLocation, sale.location, sale.productName]);


  const watchedProductName = useWatch({ control: form.control, name: 'productName' });
  const watchedQuantity = useWatch({ control: form.control, name: 'quantity' });
  const watchedUnitPrice = useWatch({ control: form.control, name: 'unitPrice' });
  const watchedAmountPaid = useWatch({ control: form.control, name: 'amountPaid' });

  const handleProductSelect = (productName: string, product?: CatalogProduct) => {
    form.setValue('productName', productName);
    if (product && productName !== sale.productName) {
      form.setValue('unitPrice', product.price);
      form.setValue('unit', toUnit(product.unit));
    }
  };

  const totalValue = (watchedUnitPrice || 0) * (watchedQuantity || 0);
  const missingAmount = totalValue - (watchedAmountPaid || 0);
  const isFromOrder = sale.documentType === 'Encomenda';
  // Uma venda que já moveu stock (Pago/Levantado) não muda de produto nem de quantidade:
  // para isso apaga-se (o stock volta) e faz-se outra. Só o gestor muda preços.
  const isManager = inventoryContext?.user?.role === 'Admin' || inventoryContext?.user?.role === 'Dono';
  const stockLocked = sale.status !== 'Pendente';

  // o pago acompanha o novo total numa venda que estava paga por inteiro (o Financeiro e o relatório do dia contam o pago)
  const paidPreview = paidAfterEdit(sale, totalValue, watchedAmountPaid, isFromOrder);
  useEffect(() => {
    if (!isFromOrder && form.getValues('amountPaid') !== paidPreview) form.setValue('amountPaid', paidPreview);
  }, [isFromOrder, paidPreview, form]);

  function onSubmit(values: EditSaleFormValues) {
    const total = (values.unitPrice || 0) * (values.quantity || 0);
    const paid = paidAfterEdit(sale, total, values.amountPaid, isFromOrder);
    onUpdateSale({
      ...sale,
      ...values,
      date: withSaleTime(values.date, sale.date),
      subtotal: total,
      totalValue: total,
      amountPaid: paid,
      status: sale.status === 'Levantado'
        ? 'Levantado'
        : (paid >= total ? 'Pago' : 'Pendente'),
    });
    onOpenChange(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 pr-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientName"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Cliente</FormLabel>
                <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value || "Selecionar cliente..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Pesquisar ou criar cliente..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                    </div>
                    <ScrollArea className="max-h-48">
                      <div className="p-1">
                        {filteredCustomers.length === 0 && !customerSearch.trim() && (
                          <p className="text-sm text-muted-foreground p-2 text-center">Nenhum cliente registado.</p>
                        )}
                        {filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            className={cn(
                              "flex items-center w-full gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                              field.value === customer.name && "bg-accent"
                            )}
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <Check className={cn("h-4 w-4", field.value === customer.name ? "opacity-100" : "opacity-0")} />
                            <span>{customer.name}</span>
                            {customer.phone && <span className="ml-auto text-xs text-muted-foreground">{customer.phone}</span>}
                          </button>
                        ))}
                        {customerSearch.trim() && !exactMatch && (
                          <button
                            type="button"
                            className="flex items-center w-full gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent text-primary font-medium border-t mt-1 pt-2"
                            onClick={handleCreateCustomer}
                          >
                            <UserPlus className="h-4 w-4" />
                            <span>Criar &quot;{customerSearch.trim()}&quot;</span>
                          </button>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="documentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Documento</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de documento" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Venda a Dinheiro">Venda a Dinheiro</SelectItem>
                    <SelectItem value="Factura Proforma">Factura Proforma</SelectItem>
                    <SelectItem value="Guia de Remessa">Guia de Remessa</SelectItem>
                    <SelectItem value="Factura">Factura</SelectItem>
                    <SelectItem value="Recibo">Recibo</SelectItem>
                    <SelectItem value="Encomenda">Encomenda</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data da Venda</FormLabel>
              <DatePicker
                date={field.value}
                setDate={field.onChange}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="productName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Produto</FormLabel>
              <div className={stockLocked ? 'pointer-events-none opacity-60' : undefined} aria-disabled={stockLocked}>
              <CatalogProductSelector
                products={productsInStock}
                categories={catalogCategories || []}
                selectedValue={field.value}
                onValueChange={handleProductSelect}
              />
              </div>
              {stockLocked && <FormDescription>Venda já registada no stock: para trocar o produto ou a quantidade, apague a venda (o stock volta) e faça outra.</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade</FormLabel>
                <FormControl>
                  <Input type="number" step="any" min="0.01" disabled={stockLocked} {...field} />
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="unitPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço Unitário</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" disabled={!isManager} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amountPaid"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Total Pago</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    disabled={!isFromOrder}
                  />
                </FormControl>
                <FormDescription>
                  {isFromOrder
                    ? "Atualize este campo para registar pagamentos adicionais do cliente."
                    : "Acompanha o total: uma venda paga por inteiro continua paga com o novo valor (também no Financeiro e no relatório do dia)."
                  }
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Adicione notas ou termos..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div className="rounded-lg bg-muted p-4 text-right">
            <p className="text-sm font-medium text-muted-foreground">Valor em Falta</p>
            <p className={cn("text-2xl font-bold", missingAmount > 0.1 ? "text-red-500" : "text-green-500")}>
              {formatCurrency(Math.max(0, missingAmount))}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-4 text-right">
            <p className="text-sm font-medium text-muted-foreground">Novo Valor Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit">Salvar Alterações</Button>
        </div>
      </form>
    </Form>
  );
}

export function EditSaleDialog(props: EditSaleDialogProps) {
  return (
    <ResponsiveDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Editar ${props.sale.documentType} #${props.sale.guideNumber}`}
      description="Ajuste os detalhes do documento. A edição não afeta o stock já movimentado."
    >
      <div className="md:max-h-[85vh] md:overflow-y-auto md:pr-2">
        <EditSaleDialogContent {...props} />
      </div>
    </ResponsiveDialog>
  );
}

