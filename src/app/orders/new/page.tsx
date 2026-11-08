"use client";

import { LocationSelectItems } from '@/components/ui/location-select-items';
import { habitualLocation, recordLocation } from "@/lib/habitual-location";
import { useState, useContext, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCRM } from '@/context/crm-context';
import { InventoryContext } from '@/context/inventory-context';
import { useFirestore } from '@/firebase/provider';
import { collection, doc, runTransaction } from "firebase/firestore";
import { resolveInventoryProductRef } from "@/lib/product-ref";
import { planOrderReservation } from "@/lib/order-stock";
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
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Product, Order, Location, Sale } from '@/lib/types';
import { CatalogProductSelector } from '@/components/catalog/catalog-product-selector';
import { UniversalCalendar } from '@/components/ui/universal-calendar';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import { Card } from "@/components/ui/card";
import Link from 'next/link';

type CatalogProduct = Omit<Product, 'stock' | 'instanceId' | 'reservedStock' | 'location' | 'lastUpdated'>;

const formSchema = z.object({
    productId: z.string().optional(),
    productName: z.string().nonempty({ message: "Por favor, selecione um produto." }),
    quantity: z.preprocess((val) => {
        if (val === undefined || val === "" || val === null) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0.01, { message: "A quantidade deve ser maior que zero." })),
    unit: z.enum(['un', 'm²', 'm', 'cj', 'outro']),
    unitPrice: z.preprocess((val) => {
        if (val === undefined || val === "" || val === null) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0, "O preço não pode ser negativo.")),
    clientName: z.string().optional(),
    deliveryDate: z.date().optional(),
    location: z.string().optional(),
    paymentOption: z.enum(['full', 'partial']).default('full'),
    partialPaymentType: z.enum(['fixed', 'percentage']).default('fixed'),
    partialPaymentValue: z.preprocess((val) => {
        if (val === undefined || val === "" || val === null) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0).optional()),
});

type AddOrderFormValues = z.infer<typeof formSchema>;

export default function NewOrderPage() {
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const inventoryContext = useContext(InventoryContext);
    const { customers, addCustomer } = useCRM();

    const { catalogProducts, catalogCategories, locations, isMultiLocation, companyId, user, addNotification, isReadOnly, companyData: companyContext } = inventoryContext || {
        companyData: null, catalogProducts: [], catalogCategories: [], locations: [], isMultiLocation: false, companyId: null, user: null, addNotification: () => { }, isReadOnly: false
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<AddOrderFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            productName: "",
            unit: 'un',
            clientName: "",
            deliveryDate: new Date(),
            location: "",
            paymentOption: 'full',
            partialPaymentType: 'fixed',
            partialPaymentValue: 0,
        },
    });

    const watchedQuantity = useWatch({ control: form.control, name: 'quantity' });
    const watchedUnitPrice = useWatch({ control: form.control, name: 'unitPrice' });
    const watchedPaymentOption = useWatch({ control: form.control, name: 'paymentOption' });
    const watchedPartialPaymentType = useWatch({ control: form.control, name: 'partialPaymentType' });
    const watchedPartialPaymentValue = useWatch({ control: form.control, name: 'partialPaymentValue' });

    useEffect(() => {
        const savedLocation = habitualLocation(locations.map(l => l.id));
        const finalLocation = savedLocation && locations.some((l: Location) => l.id === savedLocation)
            ? savedLocation
            : (locations.length > 0 ? locations[0].id : "");

        form.reset({
            productId: "",
            productName: "",
            quantity: undefined,
            unit: 'un',
            clientName: "",
            deliveryDate: new Date(),
            location: finalLocation,
            unitPrice: undefined,
            paymentOption: 'full',
            partialPaymentType: 'fixed',
            partialPaymentValue: 0,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locations]);

    const handleProductSelect = (productName: string, product?: CatalogProduct) => {
        form.setValue('productName', productName, { shouldValidate: true });
        if (product) {
            form.setValue('productId', product.id);
            form.setValue('unit', (product.unit as any) || 'un');
            form.setValue('unitPrice', product.price);
        } else {
            form.setValue('productId', "");
            // @ts-ignore
            form.setValue('unitPrice', undefined);
        }
    };

    const subtotal = (watchedUnitPrice || 0) * (watchedQuantity || 0);
    const totalValue = subtotal;

    const amountPaid = useMemo(() => {
        if (watchedPaymentOption === 'partial') {
            const value = watchedPartialPaymentValue || 0;
            if (watchedPartialPaymentType === 'percentage') {
                const percentageValue = totalValue * (value / 100);
                return Math.min(percentageValue, totalValue);
            }
            return Math.min(value, totalValue);
        }
        return totalValue;
    }, [watchedPaymentOption, watchedPartialPaymentType, watchedPartialPaymentValue, totalValue]);

    const balanceDue = totalValue - amountPaid;

    async function onSubmit(formData: AddOrderFormValues) {
        if (isReadOnly) {
            toast({ variant: "destructive", title: "Conta em modo leitura", description: "Modo leitura activo — contacte o suporte para reactivar o acesso completo." });
            return;
        }
        if (!firestore || !companyId || !user) return;

        if (isMultiLocation && !formData.location) {
            form.setError("location", { type: "manual", message: "Selecione uma localização." });
            return;
        }

        setIsSubmitting(true);

        if (formData.location) {
            recordLocation(formData.location);
        }

        // o cliente da encomenda (criado se for novo): a venda fica ligada a ele, para contar em Clientes
        let customerId: string | undefined;
        if (formData.clientName) {
            const normalizedName = formData.clientName.trim();
            const existingCustomer = customers.find(c => c.name.toLowerCase() === normalizedName.toLowerCase());
            customerId = existingCustomer?.id;

            if (!existingCustomer) {
                try {
                    customerId = (await addCustomer({ name: normalizedName })) || undefined;
                } catch (error) {
                    console.error("Failed to auto-create customer from order:", error);
                }
            }
        }

        try {
            const orderRef = doc(collection(firestore, `companies/${companyId}/orders`));
            const saleRef = doc(collection(firestore, `companies/${companyId}/sales`));
            const companyRef = doc(firestore, `companies/${companyId}`);
            const existingProductRef = await resolveInventoryProductRef(firestore, companyId, {
                productId: formData.productId,
                productName: formData.productName,
                location: formData.location || (isMultiLocation && locations?.[0]?.id) || 'Principal',
            });

            await runTransaction(firestore, async (transaction) => {
                const companyDoc = await transaction.get(companyRef);
                if (!companyDoc.exists()) {
                    throw new Error("Empresa não encontrada.");
                }

                // O artigo vem do catálogo; o stock vive no produto do inventário (outro documento). Reserva-se nele.
                let productRef: any = existingProductRef;
                let productData: any = null;
                if (productRef) {
                    const pDoc = await transaction.get(productRef);
                    if (pDoc.exists()) productData = pDoc.data();
                    else productRef = null;
                }
                const plan = planOrderReservation(productData, formData.quantity, companyContext?.businessType !== 'reseller');
                if (plan.kind === 'refuse') {
                    throw new Error(`Stock insuficiente. Disponível: ${plan.available} ${formData.unit}`);
                }
                let newProductRef: any = null;
                if (plan.kind === 'create') {
                    newProductRef = doc(collection(firestore, `companies/${companyId}/products`));
                }

                const newOrder: Omit<Order, 'id'> = {
                    productId: productRef?.id || newProductRef?.id || formData.productId || formData.productName,
                    reservedQuantity: formData.quantity,
                    productName: formData.productName,
                    quantity: formData.quantity,
                    unit: formData.unit!,
                    clientName: formData.clientName,
                    deliveryDate: formData.deliveryDate?.toISOString(),
                    location: formData.location,
                    unitPrice: formData.unitPrice,
                    totalValue: totalValue,
                    status: 'Pendente',
                    quantityProduced: 0,
                    productionLogs: [],
                    productionStartDate: null,
                };
                transaction.set(orderRef, newOrder);

                const companyData = companyDoc.data();
                const allNumbering = companyData.documentNumbering || {};
                const orderTypeConfig = allNumbering['Encomenda'];
                const newSaleCounter = (companyData.saleCounter || 0) + 1;

                let guideNumber: string;
                if (orderTypeConfig && orderTypeConfig.prefix) {
                    const num = orderTypeConfig.nextNumber || 1;
                    const padded = orderTypeConfig.padding > 0 ? String(num).padStart(orderTypeConfig.padding, '0') : String(num);
                    guideNumber = `${orderTypeConfig.prefix}${orderTypeConfig.separator || ''}${padded}`;
                } else {
                    guideNumber = `ENC-${String(newSaleCounter).padStart(6, '0')}`;
                }

                const newSale: Omit<Sale, 'id'> = {
                    orderId: orderRef.id,
                    date: new Date().toISOString(),
                    productId: productRef?.id || newProductRef?.id || formData.productId || formData.productName,
                    productName: formData.productName,
                    quantity: formData.quantity,
                    unit: formData.unit,
                    unitPrice: formData.unitPrice,
                    subtotal: subtotal,
                    totalValue: totalValue,
                    amountPaid: amountPaid,
                    soldBy: user.username,
                    guideNumber: guideNumber,
                    location: formData.location,
                    status: 'Pago',
                    documentType: 'Encomenda',
                    clientName: formData.clientName,
                    ...(customerId ? { customerId } : {}),
                };
                transaction.set(saleRef, newSale);

                transaction.update(companyRef, {
                    saleCounter: newSaleCounter,
                    ...(orderTypeConfig && orderTypeConfig.prefix ? { [`documentNumbering.Encomenda.nextNumber`]: (orderTypeConfig.nextNumber || 1) + 1 } : {})
                });

                if (productRef && productData) {
                    transaction.update(productRef, {
                        reservedStock: (productData.reservedStock || 0) + formData.quantity,
                        lastUpdated: new Date().toISOString()
                    });
                } else if (newProductRef) {
                    // Fabricante: o produto ainda não existia no inventário — nasce com stock 0 e a reserva da encomenda.
                    const cp = (catalogProducts || []).find((c: any) => c.id === formData.productId || c.name === formData.productName);
                    transaction.set(newProductRef, {
                        name: formData.productName,
                        category: cp?.category || 'Geral',
                        stock: 0,
                        reservedStock: formData.quantity,
                        price: cp?.price ?? formData.unitPrice ?? 0,
                        unit: formData.unit || cp?.unit || 'un',
                        location: formData.location || (isMultiLocation && locations?.[0]?.id) || 'Principal',
                        lowStockThreshold: cp?.lowStockThreshold || 10,
                        criticalStockThreshold: cp?.criticalStockThreshold || 5,
                        ...(cp?.imageUrl ? { imageUrl: cp.imageUrl } : {}),
                        lastUpdated: new Date().toISOString(),
                    });
                }
            });

            toast({
                title: "Encomenda Registada",
                description: `A encomenda de ${formData.quantity} ${formData.unit} de ${formData.productName} foi registada e uma venda foi criada.`,
            });

            if (addNotification) {
                addNotification({
                    type: 'order',
                    message: `Nova encomenda para ${formData.productName} registada.`,
                    href: `/orders?id=${orderRef.id}`,
                });
            }

            router.push('/orders');

        } catch (error: any) {
            console.error("Error creating order and sale:", error);
            toast({
                variant: "destructive",
                title: "Erro ao Registar Encomenda",
                description: error.message || "Não foi possível criar a encomenda e a venda associada.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!inventoryContext) return null;

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-bold">Nova Encomenda</h1>
                    <p className="text-muted-foreground text-sm">Registe uma nova encomenda para produção e pagamento.</p>
                </div>
            </div>

            <Card className="glass-panel p-6 border-none shadow-lg">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="productName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Produto</FormLabel>
                                    <FormControl>
                                        <CatalogProductSelector
                                            products={catalogProducts || []}
                                            categories={catalogCategories || []}
                                            selectedValue={field.value}
                                            onValueChange={handleProductSelect}
                                            placeholder="Pesquisar produto no catálogo..."
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quantidade</FormLabel>
                                        <FormControl><Input type="number" step="any" min="0.01" {...field} placeholder="0" /></FormControl>
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
                            name="unitPrice"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Preço Unitário</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} placeholder="0.00" />
                                    </FormControl>
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
                                        <FormLabel>Localização da Produção</FormLabel>
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
                            name="clientName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cliente (Opcional)</FormLabel>
                                    <FormControl><Input placeholder="Nome do cliente" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="deliveryDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Data de Entrega (Opcional)</FormLabel>
                                    <UniversalCalendar
                                        selectedDate={field.value}
                                        onDateSelect={field.onChange}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="payment-details" className="border rounded-lg">
                                <AccordionTrigger className="px-4 py-3 hover:no-underline select-none">
                                    <h3 className="font-semibold leading-none tracking-tight">Detalhes de Pagamento (Opcional)</h3>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-0">
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="paymentOption"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <FormLabel>Opção de Pagamento</FormLabel>
                                                    <FormControl>
                                                        <RadioGroup
                                                            onValueChange={field.onChange}
                                                            defaultValue={field.value}
                                                            className="flex items-center space-x-4 pt-1"
                                                        >
                                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                                <FormControl>
                                                                    <RadioGroupItem value="full" id="p-full" />
                                                                </FormControl>
                                                                <FormLabel htmlFor="p-full" className="font-normal cursor-pointer select-none">Pagamento Integral</FormLabel>
                                                            </FormItem>
                                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                                <FormControl>
                                                                    <RadioGroupItem value="partial" id="p-partial" />
                                                                </FormControl>
                                                                <FormLabel htmlFor="p-partial" className="font-normal cursor-pointer select-none">Pagamento Parcial</FormLabel>
                                                            </FormItem>
                                                        </RadioGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        {watchedPaymentOption === 'partial' && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="partialPaymentType"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-3">
                                                            <FormLabel>Tipo de Valor</FormLabel>
                                                            <FormControl>
                                                                <RadioGroup
                                                                    onValueChange={field.onChange}
                                                                    defaultValue={field.value}
                                                                    className="flex items-center space-x-4 pt-1"
                                                                >
                                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                                        <FormControl>
                                                                            <RadioGroupItem value="fixed" id="pp-fixed" />
                                                                        </FormControl>
                                                                        <FormLabel htmlFor="pp-fixed" className="font-normal cursor-pointer select-none">Valor Fixo</FormLabel>
                                                                    </FormItem>
                                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                                        <FormControl>
                                                                            <RadioGroupItem value="percentage" id="pp-percentage" />
                                                                        </FormControl>
                                                                        <FormLabel htmlFor="pp-percentage" className="font-normal cursor-pointer select-none">%</FormLabel>
                                                                    </FormItem>
                                                                </RadioGroup>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="partialPaymentValue"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Valor Parcial</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" min="0" {...field} placeholder="0.00" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="rounded-lg bg-muted p-4 space-y-2 mt-4">
                            <div className='flex justify-between items-center text-lg'>
                                <span className='font-bold'>Total</span>
                                <span className='font-bold'>{formatCurrency(totalValue)}</span>
                            </div>
                            <Separator className='my-2 bg-border/50' />
                            <div className='flex justify-between items-center text-sm'>
                                <span className='text-muted-foreground'>Valor Pago</span>
                                <span className='font-medium'>{formatCurrency(amountPaid)}</span>
                            </div>
                            {balanceDue > 0.01 && (
                                <div className='flex justify-between items-center text-sm text-destructive'>
                                    <span className='font-semibold'>Valor Pendente</span>
                                    <span className='font-bold'>{formatCurrency(balanceDue)}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-6 border-t border-border mt-8">
                            <Button type="button" variant="outline" className="w-full sm:w-auto h-12" onClick={() => router.push('/orders')}>
                                Cancelar
                            </Button>
                             <Button type="submit" className="w-full sm:w-auto h-12 px-8" disabled={isSubmitting || isReadOnly} title={isReadOnly ? "Indisponível em modo leitura" : ""}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Registrar Encomenda
                            </Button>
                        </div>
                    </form>
                </Form>
            </Card>
        </div>
    );
}
