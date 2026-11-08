
"use client";

import { useEffect, useState, useContext } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { LocationsManager } from "@/components/settings/locations-manager";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ChevronDown, Trash2, Code, Building, Users } from "lucide-react";
import { CatalogManager } from "@/components/settings/catalog-manager";
import { Button } from "@/components/ui/button";
import { InventoryContext } from "@/context/inventory-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";


const colorOptions = [
  { name: 'Primary', value: 'hsl(var(--primary))', className: 'bg-primary' },
  { name: 'Accent', value: 'hsl(var(--accent))', className: 'bg-accent' },
  { name: 'Destructive', value: 'hsl(var(--destructive))', className: 'bg-destructive' },
  { name: 'Foreground', value: 'hsl(var(--foreground))', className: 'bg-foreground' },
  { name: 'Border', value: 'hsl(var(--border))', className: 'bg-border' },
];

export default function SettingsPage() {
  const [isClient, setIsClient] = useState(false);
  const [borderRadius, setBorderRadius] = useState(0.8);
  const [borderWidth, setBorderWidth] = useState(1);
  const [borderColor, setBorderColor] = useState('hsl(var(--primary))');
  const [iconSize, setIconSize] = useState(16);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const inventoryContext = useContext(InventoryContext);
  const { toast } = useToast();

  const [companyDetails, setCompanyDetails] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { companyData, updateCompany } = inventoryContext || {};


  useEffect(() => {
    setIsClient(true);
    if (companyData) {
      setCompanyDetails({
        name: companyData.name || '',
        email: companyData.email || '',
        phone: companyData.phone || '',
        address: companyData.address || '',
        taxId: companyData.taxId || ''
      });
    }
  }, [companyData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;

      const storedRadius = localStorage.getItem('majorstockx-border-radius');
      if (storedRadius) {
        setBorderRadius(parseFloat(storedRadius));
      }

      const storedBorderWidth = localStorage.getItem('majorstockx-border-width');
      if (storedBorderWidth) {
        setBorderWidth(parseFloat(storedBorderWidth));
      }

      const storedBorderColor = localStorage.getItem('majorstockx-border-color');
      if (storedBorderColor) {
        setBorderColor(storedBorderColor);
      }
       const storedIconSize = localStorage.getItem('majorstockx-icon-size');
      if (storedIconSize) {
        setIconSize(parseFloat(storedIconSize));
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && isClient) {
      document.documentElement.style.setProperty('--radius', `${borderRadius}rem`);
    }
  }, [borderRadius, isClient]);

   useEffect(() => {
    if (typeof window !== 'undefined' && isClient) {
      const root = document.documentElement;
      root.style.setProperty('--card-border-width', `${borderWidth}px`);
    }
  }, [borderWidth, isClient]);

  useEffect(() => {
    if (typeof window !== 'undefined' && isClient) {
      const root = document.documentElement;
      root.style.setProperty('--card-border-color', borderColor);
    }
  }, [borderColor, isClient]);
  
    useEffect(() => {
    if (typeof window !== 'undefined' && isClient) {
      const root = document.documentElement;
      root.style.setProperty('--stats-icon-size', `${iconSize}px`);
    }
  }, [iconSize, isClient]);

  const handleBorderRadiusChange = (value: number[]) => {
    const newRadius = value[0];
    setBorderRadius(newRadius);
    if (typeof window !== 'undefined') {
      localStorage.setItem('majorstockx-border-radius', newRadius.toString());
    }
  };

  const handleBorderWidthChange = (value: number[]) => {
    const newWidth = value[0];
    setBorderWidth(newWidth);
    if (typeof window !== 'undefined') {
      localStorage.setItem('majorstockx-border-width', newWidth.toString());
    }
  };

  const handleBorderColorChange = (color: string) => {
    setBorderColor(color);
    if (typeof window !== 'undefined') {
      localStorage.setItem('majorstockx-border-color', color);
    }
  };

  const handleIconSizeChange = (value: number[]) => {
    const newSize = value[0];
    setIconSize(newSize);
    if (typeof window !== 'undefined') {
      localStorage.setItem('majorstockx-icon-size', newSize.toString());
    }
  };
  
  const handleClearProducts = async () => {
    if (inventoryContext?.clearProductsCollection) {
      toast({ title: "A limpar...", description: "A apagar todos os produtos do inventário no Firestore." });
      await inventoryContext.clearProductsCollection();
      toast({ title: "Sucesso!", description: "A coleção de produtos foi limpa." });
    }
    setShowClearConfirm(false);
  };

  const handleCompanyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateCompany) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Função de atualização não encontrada.' });
        return;
    }
    setIsSubmitting(true);
    toast({ title: 'A atualizar...', description: 'A guardar os dados da empresa.' });
    await updateCompany(companyDetails);
    toast({ title: 'Sucesso!', description: 'Os dados da empresa foram atualizados.' });
    setIsSubmitting(false);
  };

  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setCompanyDetails(prev => ({...prev, [id]: value }));
  }


  if (!isClient) {
    return null; // Or a loading skeleton
  }

  return (
    <>
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem a certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível e irá apagar permanentemente **todos** os produtos do seu inventário no Firestore. Não será possível recuperar estes dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearProducts} className="bg-destructive hover:bg-destructive/90">
              Sim, apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl md:text-3xl font-headline font-[900] text-slate-900 dark:text-white tracking-tighter">Configurações</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Ajuste as preferências da aplicação e da sua empresa.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-6">
          <AccordionItem value="item-company" className="border-0">
             <Card className="glass-card shadow-sm">
                <AccordionTrigger className="w-full hover:no-underline">
                    <CardHeader className="flex-row items-center justify-center w-full p-6 sm:p-8">
                    <div className="flex-1">
                        <CardTitle className="font-headline font-[900] tracking-tighter text-xl sm:text-2xl text-center flex items-center justify-center gap-2"><Building /> Detalhes da Empresa</CardTitle>
                        <CardDescription className="text-center">
                            Visualize e edite os dados da sua empresa.
                        </CardDescription>
                    </div>
                    <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
                    </CardHeader>
                </AccordionTrigger>
                <AccordionContent>
                    <CardContent className="p-6 sm:p-8 pt-0">
                      <form onSubmit={handleCompanyUpdate} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome da Empresa</Label>
                                <Input id="name" value={companyDetails.name} onChange={handleDetailChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email de Contacto</Label>
                                <Input id="email" type="email" value={companyDetails.email} onChange={handleDetailChange} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="phone">Telefone</Label>
                                <Input id="phone" value={companyDetails.phone} onChange={handleDetailChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="taxId">NUIT <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                                <Input id="taxId" value={companyDetails.taxId} onChange={handleDetailChange} />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="address">Endereço</Label>
                                <Input id="address" value={companyDetails.address} onChange={handleDetailChange} />
                            </div>
                          </div>
                          <div className="flex justify-center">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'A guardar...' : 'Salvar Alterações'}
                            </Button>
                          </div>
                      </form>
                    </CardContent>
                </AccordionContent>
            </Card>
          </AccordionItem>
          
          <AccordionItem value="item-1" className="border-0">
            <Card className="glass-card shadow-sm">
              <AccordionTrigger className="w-full hover:no-underline">
                <CardHeader className="flex-row items-center justify-center w-full p-6 sm:p-8">
                  <div className="flex-1">
                    <CardTitle className="font-headline font-[900] tracking-tighter text-xl sm:text-2xl text-center">Aparência</CardTitle>
                    <CardDescription className="text-center">
                      Personalize a aparência da aplicação.
                    </CardDescription>
                  </div>
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-6 p-6 sm:p-8 pt-0">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="theme">Tema</Label>
                    <ThemeSwitcher />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="border-radius">Arredondamento dos Cantos</Label>
                    <p className="text-sm text-muted-foreground">Ajuste o raio das bordas dos elementos.</p>
                    <div className="flex items-center gap-4">
                      <Slider
                        id="border-radius"
                        min={0}
                        max={2}
                        step={0.1}
                        value={[borderRadius]}
                        onValueChange={handleBorderRadiusChange}
                        className="w-[calc(100%-4rem)]"
                      />
                      <span className="w-12 text-right font-mono text-sm text-muted-foreground">
                        {borderRadius.toFixed(1)}rem
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="border-width">Largura da Borda do Card</Label>
                    <p className="text-sm text-muted-foreground">Ajuste a espessura da borda dos cards.</p>
                    <div className="flex items-center gap-4">
                      <Slider
                        id="border-width"
                        min={0}
                        max={4}
                        step={0.1}
                        value={[borderWidth]}
                        onValueChange={handleBorderWidthChange}
                        className="w-[calc(100%-4rem)]"
                      />
                      <span className="w-12 text-right font-mono text-sm text-muted-foreground">
                        {borderWidth.toFixed(1)}px
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="border-color">Cor da Borda do Card</Label>
                    <p className="text-sm text-muted-foreground">Selecione a cor da borda para os cards.</p>
                    <div className="flex items-center gap-2 pt-2">
                      {colorOptions.map(color => (
                        <button
                          key={color.name}
                          onClick={() => handleBorderColorChange(color.value)}
                          className={cn(
                            "h-8 w-8 rounded-full border-2 transition-all",
                            borderColor === color.value ? 'border-ring' : 'border-transparent',
                            color.className
                          )}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icon-size">Tamanho do Ícone do Dashboard</Label>
                    <p className="text-sm text-muted-foreground">Ajuste o tamanho dos ícones nos cards de estatísticas.</p>
                    <div className="flex items-center gap-4">
                      <Slider
                        id="icon-size"
                        min={12}
                        max={24}
                        step={1}
                        value={[iconSize]}
                        onValueChange={handleIconSizeChange}
                        className="w-[calc(100%-4rem)]"
                      />
                      <span className="w-12 text-right font-mono text-sm text-muted-foreground">
                        {iconSize.toFixed(0)}px
                      </span>
                    </div>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
          
          <AccordionItem value="item-2" className="border-0">
            <Card className="glass-card shadow-sm">
              <AccordionTrigger className="w-full hover:no-underline">
                <CardHeader className="flex-row items-center justify-center w-full p-6 sm:p-8">
                  <div className="flex-1">
                    <CardTitle className="font-headline font-[900] tracking-tighter text-xl sm:text-2xl text-center">Gestão de Localizações</CardTitle>
                    <CardDescription className="text-center">
                      Ative e gerencie múltiplas localizações para o seu negócio.
                    </CardDescription>
                  </div>
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="p-6 sm:p-8 pt-0">
                  <LocationsManager />
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
          
          <AccordionItem value="item-5" className="border-0">
            <Card className="glass-card shadow-sm">
              <AccordionTrigger className="w-full hover:no-underline">
                <CardHeader className="flex-row items-center justify-center w-full p-6 sm:p-8">
                  <div className="flex-1">
                    <CardTitle className="font-headline font-[900] tracking-tighter text-xl sm:text-2xl text-center flex items-center justify-center gap-2"><Code />Ferramentas de Programador</CardTitle>
                    <CardDescription className="text-center">
                      Ações avançadas para gerir o estado da aplicação.
                    </CardDescription>
                  </div>
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="p-6 sm:p-8 pt-0 space-y-4">
                   <div>
                    <h3 className="font-semibold">Limpar Coleção de Produtos</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Esta ação irá apagar todos os documentos da coleção de produtos no Firestore. Utilize esta opção se quiser limpar o inventário e recomeçar.
                    </p>
                   </div>
                   <Button variant="destructive" onClick={() => setShowClearConfirm(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Limpar Produtos do Firestore
                   </Button>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
