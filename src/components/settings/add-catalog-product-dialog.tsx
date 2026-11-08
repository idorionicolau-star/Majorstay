

"use client";

import { LocationSelectItems } from '@/components/ui/location-select-items';
import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ProductImageField } from "@/components/catalog/product-image-field";
import { CostBarcodeFields } from "@/components/catalog/cost-barcode-fields";
import { Plus } from "lucide-react";
import { VariantsEditor, EMPTY_VARIANTS, type VariantsState } from "@/components/catalog/variants-editor";
import { cleanOptions, planVariants } from "@/lib/variants";
import { useToast } from "@/hooks/use-toast";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Product } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ScrollArea } from '../ui/scroll-area';
import { useDynamicPlaceholder } from '@/hooks/use-dynamic-placeholder';
import { catalogDraftHasContent, clearDraft, readDraft, writeDraft } from '@/lib/form-draft';

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
  // "Quanto tem agora?": não vai para o catálogo, entra no stock
  stock: z.preprocess((val) => {
    if (val === undefined || val === "" || val === null) return 0;
    const num = Number(String(val).replace(",", "."));
    return isNaN(num) ? 0 : num;
  }, z.number().min(0, { message: "A quantidade não pode ser negativa." })),
  stockLocation: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
const NEW_CATEGORY = "__nova_categoria__";
type CatalogProduct = Omit<Product, 'stock' | 'instanceId' | 'reservedStock' | 'location' | 'lastUpdated'>;

/** O que a pessoa já tem deste produto: entra no stock ao criar (num só passo, sem ir ao Stock Rápido). */
export type InitialStock = { quantity: number; location?: string };

interface AddCatalogProductDialogProps {
  categories: string[];
  units: string[];
  onAdd: (product: Omit<CatalogProduct, 'id'>, initialStock?: InitialStock) => void;
  /** Locais onde pode entrar o stock inicial; sem isto (ex.: sem permissão de stock), o campo não aparece. */
  stockLocations?: { id: string; name: string }[];
  /** Onde guardar o rascunho (o que se escreveu volta se a janela fechar sem querer). Quem cria o produto apaga-o. */
  draftKey?: string;
  /** Produto com variações: cria uma entrada por variação (cada uma com o seu stock e preço). */
  onAddVariants?: (base: Omit<CatalogProduct, 'id'>, variants: { name: string; values: Record<string, string>; price: number }[], existing: string[]) => void;
  /** Produtos já no catálogo (para avisar de códigos de barras repetidos). */
  catalog?: { id?: string; name: string; barcode?: string }[];
}

function AddCatalogProductForm({
  categories,
  units,
  onAdd,
  onAddVariants,
  setOpen,
  form,
  namePlaceholder,
  pricePlaceholder,
  catalog,
  variants,
  setVariants,
  stockLocations,
  restored,
  onDiscardDraft,
}: AddCatalogProductDialogProps & { setOpen: (open: boolean) => void; form: any; namePlaceholder: string; pricePlaceholder: string; variants: VariantsState; setVariants: (v: VariantsState) => void; restored?: boolean; onDiscardDraft?: () => void }) {
  const { toast } = useToast();
  const [typingCategory, setTypingCategory] = useState(false);
  const categoryOptions = Array.from(new Set(["Geral", ...categories]));
  const baseName = String(form.watch('name') || '');
  const basePrice = Number(form.watch('price')) || 0;
  const withVariants = variants.enabled && !!onAddVariants;

  function onSubmit(values: FormValues) {
    if (withVariants) {
      const options = cleanOptions(variants.options);
      const plan = planVariants(values.name, options, (catalog || []).map((c) => c.name));
      if (plan.tooMany) { toast({ variant: 'destructive', title: 'Variações a mais', description: 'Tire alguns valores: o máximo de uma vez é 60.' }); return; }
      if (!plan.create.length) {
        toast({ variant: 'destructive', title: 'Nenhuma variação para criar', description: plan.existing.length ? 'Todas estas variações já existem no catálogo.' : 'Acrescente pelo menos um valor (ex.: uma cor).' });
        return;
      }
      const base = { ...values, cost: values.cost || 0, barcode: '' } as Omit<CatalogProduct, 'id'>;
      onAddVariants!(base, plan.create.map((v) => {
        const typed = Number(variants.prices[v.name]);
        return { ...v, price: variants.prices[v.name] !== undefined && variants.prices[v.name] !== '' && Number.isFinite(typed) && typed >= 0 ? typed : values.price };
      }), plan.existing);
      setOpen(false);
      return;
    }
    const { stock, stockLocation, ...product } = values;
    // sem "undefined" (o Firestore recusa): custo 0 e código '' querem dizer "não tem"
    onAdd(
      { ...product, cost: product.cost || 0, barcode: (product.barcode || '').trim() } as Omit<CatalogProduct, 'id'>,
      stockLocations && stock > 0 ? { quantity: stock, location: stockLocation || stockLocations[0]?.id } : undefined,
    );
    setOpen(false);
  }

  return (
    <Form {...form}>
      <form data-tour="catalog-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 pr-2">
        {restored && (
          <div data-tour="catalog-draft" className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span>Recuperámos o que estava a escrever.</span>
            <button type="button" onClick={onDiscardDraft} className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline">Começar de novo</button>
          </div>
        )}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem data-tour="catalog-f-category">
              <FormLabel>Categoria</FormLabel>
              {/* Empresa nova não tem categorias: "Geral" está sempre lá e pode criar-se uma nova aqui mesmo. */}
              <Select onValueChange={(v) => { if (v === NEW_CATEGORY) { setTypingCategory(true); field.onChange(""); } else { setTypingCategory(false); field.onChange(v); } }} value={typingCategory ? NEW_CATEGORY : field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categoryOptions.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                  <SelectItem value={NEW_CATEGORY}>＋ Nova categoria…</SelectItem>
                </SelectContent>
              </Select>
              {typingCategory && (
                <Input autoFocus placeholder="Nome da nova categoria (ex.: Cimentos)" value={field.value} onChange={(e) => field.onChange(e.target.value)} />
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem data-tour="catalog-f-name">
              <FormLabel>Nome do Produto</FormLabel>
              <FormControl>
                <Input placeholder={namePlaceholder} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem data-tour="catalog-f-photo">
              <FormLabel>Foto (opcional)</FormLabel>
              <ProductImageField value={field.value} onChange={field.onChange} />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4" data-tour="catalog-f-price">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço Padrão</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder={pricePlaceholder} {...field} />
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
        {stockLocations && !withVariants && (
          <div className="grid grid-cols-2 gap-4" data-tour="catalog-f-stock">
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem className={stockLocations.length > 1 ? undefined : "col-span-2"}>
                  <FormLabel>Quanto tem agora? (opcional)</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" min="0" inputMode="decimal" placeholder="0" {...field} value={field.value || ''} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Entra logo no stock. Pode deixar vazio e dar entrada depois.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            {stockLocations.length > 1 && (
              <FormField
                control={form.control}
                name="stockLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Onde está</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || stockLocations[0]?.id}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <LocationSelectItems locations={stockLocations} />
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}
          </div>
        )}
        <div className="grid gap-4" data-tour="catalog-f-cost"><CostBarcodeFields catalog={catalog || []} noBarcode={withVariants} /></div>
        <div className="grid grid-cols-2 gap-4" data-tour="catalog-f-alerts">
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
        {onAddVariants && (
          <div data-tour="catalog-f-variants"><VariantsEditor state={variants} onChange={setVariants} baseName={baseName} basePrice={basePrice} existingNames={(catalog || []).map((c) => c.name)} /></div>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" data-tour="catalog-f-submit">{withVariants ? 'Criar variações' : 'Guardar produto'}</Button>
        </div>
      </form>
    </Form>
  );
}

export function AddCatalogProductDialog({ categories, units, onAdd, onAddVariants, catalog, stockLocations, draftKey, open: openProp, onOpenChange, hideTrigger, defaultCategory, defaultName, initial, startWithVariants }: AddCatalogProductDialogProps & {
  /** Modo controlado: a página decide quando abre (ex.: botão + no telemóvel). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  /** Categoria pré-escolhida (ex.: a que está filtrada na lista). */
  defaultCategory?: string;
  /** Nome pré-preenchido (ex.: o que se procurou e não existe). */
  defaultName?: string;
  /** Valores de partida (ex.: duplicar um produto). */
  initial?: Partial<FormValues>;
  /** Abre já com "tem variações" ligado (ex.: criar variações de um produto que já existe). */
  startWithVariants?: boolean;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const [variants, setVariants] = useState<VariantsState>(EMPTY_VARIANTS);
  const [restored, setRestored] = useState(false);
  const variantsRef = useRef(variants);
  variantsRef.current = variants;
  const open = openProp ?? innerOpen;
  const setOpen = (o: boolean) => { setInnerOpen(o); onOpenChange?.(o); };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      category: categories[0] || 'Geral',
      price: 0,
      unit: 'un',
      imageUrl: '',
      cost: 0,
      barcode: '',
      lowStockThreshold: 10,
      criticalStockThreshold: 5,
      stock: 0,
      stockLocation: '',
    },
  });

  const namePlaceholder = useDynamicPlaceholder('product');
  const pricePlaceholder = useDynamicPlaceholder('money');

  // sempre que abre, o formulário começa limpo (antes ficava com o produto anterior)
  useEffect(() => {
    if (!open) return;
    const base = { name: defaultName || '', category: defaultCategory || categories[0] || 'Geral', price: 0, unit: 'un', imageUrl: '', cost: 0, barcode: '', lowStockThreshold: 10, criticalStockThreshold: 5, stock: 0, stockLocation: '', ...(initial || {}) };
    // Abriu em branco (não a partir de um nome procurado, de um duplicado ou de variações): volta o rascunho, se houver
    const prefilled = !!(defaultName || initial || startWithVariants);
    const draft = draftKey && !prefilled ? readDraft<{ form?: Partial<FormValues>; variants?: VariantsState }>(draftKey) : null;
    if (draft?.form && catalogDraftHasContent(draft.form as any)) {
      setVariants(draft.variants ? { ...EMPTY_VARIANTS, ...draft.variants } : EMPTY_VARIANTS);
      form.reset({ ...base, ...draft.form } as FormValues);
      setRestored(true);
    } else {
      setVariants({ ...EMPTY_VARIANTS, enabled: !!startWithVariants });
      form.reset(base);
      setRestored(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Guarda o que se vai escrevendo. Quem cria o produto (catalog-manager) apaga o rascunho; fechar sem criar mantém-no.
  const saveDraft = () => {
    if (!draftKey) return;
    const values = form.getValues();
    if (catalogDraftHasContent(values as any)) writeDraft(draftKey, { form: values, variants: variantsRef.current });
  };
  useEffect(() => {
    if (!open || !draftKey) return;
    const sub = form.watch((values: any, info: { type?: string }) => {
      if (catalogDraftHasContent(values)) writeDraft(draftKey, { form: values, variants: variantsRef.current });
      else if (info?.type === 'change') clearDraft(draftKey); // a pessoa apagou tudo de propósito
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) saveDraft(); }, [variants]);

  const trigger = (
    <Button size="icon" className="rounded-full h-9 w-9" title="Adicionar Produto ao Catálogo">
      <Plus className="h-5 w-5" />
      <span className="sr-only">Adicionar Produto ao Catálogo</span>
    </Button>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="Novo produto"
      description="Fica no catálogo com o preço. Se já o tem, diga quanto: entra logo no stock."
      trigger={hideTrigger ? undefined : trigger}
    >
      <div className="md:max-h-[85vh] md:overflow-y-auto md:pr-2">
        <AddCatalogProductForm
          categories={categories}
          units={units}
          onAdd={onAdd}
          onAddVariants={onAddVariants}
          variants={variants}
          setVariants={setVariants}
          catalog={catalog}
          stockLocations={stockLocations}
          setOpen={setOpen}
          form={form}
          namePlaceholder={namePlaceholder}
          pricePlaceholder={pricePlaceholder}
          restored={restored}
          onDiscardDraft={() => {
            if (draftKey) clearDraft(draftKey);
            setRestored(false);
            setVariants({ ...EMPTY_VARIANTS, enabled: !!startWithVariants });
            form.reset({ name: '', category: defaultCategory || categories[0] || 'Geral', price: 0, unit: 'un', imageUrl: '', cost: 0, barcode: '', lowStockThreshold: 10, criticalStockThreshold: 5, stock: 0, stockLocation: '' });
          }}
        />
      </div>
    </ResponsiveDialog>
  );
}

