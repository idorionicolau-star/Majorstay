
"use client";

import { haul } from '@/lib/haul';
import { useEffect, useState, useContext, useRef } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, Building, Book, Palette, User as UserIcon, MapPin, Mail, Code, RefreshCw, Trash2, ShieldCheck, ImagePlus, X, Tag, Hash, FileText } from "lucide-react";

import { LocationsManager } from "@/components/settings/locations-manager";
import { AdminMergeTool } from "@/components/admin/admin-merge-tool";
import { BackupManager } from "@/components/settings/backup-manager";
import { StartFresh } from "@/components/settings/start-fresh";
import { FullReset } from "@/components/settings/full-reset";
import { DocumentsStyle } from "@/components/settings/documents-style";
import { AfterSaleSetting } from "@/components/settings/after-sale-setting";
import { RecycleBin } from "@/components/settings/recycle-bin";
import { UnitsCategoriesManager } from "@/components/settings/units-categories-manager";
import { CategoryMergeTool } from "@/components/settings/category-merge-tool";
import { BulkEditCosts } from "@/components/settings/bulk-edit-costs";
import { SignInMethodsCard } from "@/components/settings/sign-in-methods";
import { Button } from "@/components/ui/button";
import { InventoryContext } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAuth } from "firebase/auth";
import { uploadProductImage } from "@/lib/upload-product-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { ModulePermission } from "@/lib/types";
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
import { Switch } from "@/components/ui/switch";
import { countEvery, DEFAULT_COUNT_EVERY_DAYS } from "@/lib/followups-core";
import { REPORT_TIMES, reportTime, reportTimeLabel, type ReportTime } from "@/lib/daily-report";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PushSettingsCard } from "@/components/push-notifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTheme } from "@/components/theme-provider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";


const colorOptions = [
  { name: 'Primary', value: 'hsl(var(--primary))', className: 'bg-primary' },
  { name: 'Accent', value: 'hsl(var(--accent))', className: 'bg-accent' },
  { name: 'Destructive', value: 'hsl(var(--destructive))', className: 'bg-destructive' },
  { name: 'Foreground', value: 'hsl(var(--foreground))', className: 'bg-border' },
];

function ProfileTab() {
  const { user, profilePicture, setProfilePicture, changePassword } = useContext(InventoryContext) || {};
  const { toast } = useToast();
  // Holds the newly selected image before it's saved
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Password change state
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  // conta só com Google: não há senha para alterar ("Formas de entrar" → Criar senha)
  const hasPassword = !!getAuth().currentUser?.providerData.some((p) => p.providerId === 'password');

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePicture = () => {
    if (selectedImage && setProfilePicture) {
      setProfilePicture(selectedImage);
    }
  };

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A nova senha e a confirmação não coincidem.' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A nova senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    setIsChangingPassword(true);
    if (changePassword) {
      const success = await changePassword(currentPassword, newPassword);
      if (success) {
        setIsPasswordDialogOpen(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    }
    setIsChangingPassword(false);
  };

  const displayImage = selectedImage || profilePicture;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Perfil de Utilizador</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24">
            {displayImage ? <AvatarImage src={displayImage} alt="Foto de Perfil" /> : null}
            <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
              {user ? getInitials(user.username) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Label htmlFor="profile-pic-upload">Foto de Perfil</Label>
            <Input id="profile-pic-upload" type="file" accept="image/*" onChange={handleProfilePicChange} className="max-w-xs" />
            <p className="text-xs text-muted-foreground">Recomendado: 400x400px</p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSavePicture} disabled={!selectedImage}>
            Salvar foto
          </Button>
        </div>

        <div className="space-y-4 pt-6 border-t">
          <div className="space-y-1">
            <Label>Nome de Utilizador</Label>
            <p className="font-semibold">{user?.username}</p>
          </div>
          <div className="space-y-1">
            <Label>Função</Label>
            <p className="font-semibold">{user?.role}</p>
          </div>

          {(user?.role === 'Admin' || user?.role === 'Dono') && hasPassword && (
            <div className="pt-4">
              <Button variant="outline" onClick={() => setIsPasswordDialogOpen(true)}>
                Alterar Senha
              </Button>

              <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Alterar Senha de Administrador</DialogTitle>
                    <DialogDescription>Introduza a sua senha atual e a nova senha pretendida.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleChangePassword} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Senha Atual</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Nova Senha</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)} disabled={isChangingPassword}>Cancelar</Button>
                      <Button type="submit" disabled={isChangingPassword}>
                        {isChangingPassword ? 'Guardando...' : 'Salvar Nova Senha'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const [isClient, setIsClient] = useState(false);
  const inventoryContext = useContext(InventoryContext);
  const { toast } = useToast();
  const { user, companyId, clearProductsCollection, confirmAction } = inventoryContext || {};
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { borderRadius, setBorderRadius } = useTheme();

  const [companyDetails, setCompanyDetails] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    logoUrl: '' as string,
    signatureUrl: '' as string,
    paymentInfo: '',
    businessType: 'manufacturer' as 'manufacturer' | 'reseller',
    curingDays: 0,
    countEveryDays: DEFAULT_COUNT_EVERY_DAYS,
    emailTips: true,
    notificationSettings: {
      endOfDayTime: reportTime(undefined) as ReportTime,
      emails: [] as {
        email: string;
        onSale: boolean;
        onCriticalStock: boolean;
        onEndOfDayReport: boolean;
      }[]
    }
  });
  const DOCUMENT_TYPES = ['Venda a Dinheiro', 'Factura', 'Factura Proforma', 'Recibo', 'Guia de Remessa', 'Encomenda', 'Cotação'] as const;
  const defaultTypeConfig = { prefix: '', separator: '-', nextNumber: 1, padding: 0 };
  const [docNumberingMap, setDocNumberingMap] = useState<Record<string, { prefix: string; separator: string; nextNumber: number; padding: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { companyData, updateCompany } = inventoryContext || {};

  const hasPermission = (permissionId: ModulePermission) => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    if (!user.permissions) return false;

    const perms = user.permissions;

    if (typeof perms === 'object' && !Array.isArray(perms)) {
      const level = perms[permissionId];
      return level === 'read' || level === 'write';
    }

    if (Array.isArray(perms)) {
      // @ts-ignore
      return perms.includes(permissionId);
    }

    return false;
  };

  const settingsTabs = [
    { value: 'profile', label: 'Perfil', icon: UserIcon, permission: true },
    { value: 'appearance', label: 'Aparência', icon: Palette, permission: true },
    { value: 'company', label: 'Empresa', icon: Building, permission: hasPermission('settings') },
    { value: 'documents', label: 'Documentos', icon: FileText, permission: hasPermission('settings') },
    { value: 'locations', label: 'Localizações', icon: MapPin, permission: hasPermission('settings') },
    { value: 'classification', label: 'Categorias & Unidades', icon: Tag, permission: hasPermission('settings') },
    // Catalog moved to sidebar
    { value: 'security', label: 'Segurança & Dados', icon: ShieldCheck, permission: hasPermission('settings') },
    { value: 'advanced', label: 'Avançado', icon: Code, permission: hasPermission('settings') }
  ].filter(tab => tab.permission);

  useEffect(() => {
    setIsClient(true);
    if (companyData) {
      setCompanyDetails({
        name: companyData.name || '',
        email: companyData.email || '',
        phone: companyData.phone || '',
        address: companyData.address || '',
        taxId: companyData.taxId || '',
        logoUrl: companyData.logoUrl || '',
        signatureUrl: companyData.signatureUrl || '',
        paymentInfo: companyData.paymentInfo || '',
        businessType: companyData.businessType || 'manufacturer',
        curingDays: companyData.curingDays ?? 0,
        countEveryDays: countEvery(companyData.countEveryDays),
        emailTips: companyData.emailTips !== false,
        notificationSettings: {
          endOfDayTime: reportTime(companyData.notificationSettings?.endOfDayTime),
          emails: companyData.notificationSettings?.emails || (
            companyData.notificationSettings?.email ? [{
              email: companyData.notificationSettings.email,
              onSale: companyData.notificationSettings.onSale || false,
              onCriticalStock: companyData.notificationSettings.onCriticalStock || false,
              onEndOfDayReport: false
            }] : []
          )
        }
      });
      if (companyData.documentNumbering) {
        setDocNumberingMap(companyData.documentNumbering as any);
      }
    }
  }, [companyData]);

  // /settings#company abre directamente o separador pedido (e, na Empresa, leva ao primeiro campo por preencher)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const go = () => {
      const hash = window.location.hash.substring(1);
      if (!hash) return;
      setActiveTab(hash);
      if (hash === 'company') {
        window.setTimeout(() => {
          const el = ['phone', 'address'].map((id) => document.getElementById(id) as HTMLInputElement | null).find((i) => i && !i.value) || document.getElementById('phone');
          el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el?.focus({ preventScroll: true });
        }, 500);
      }
    };
    go();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, []);

  useEffect(() => {
    const activeLink = document.getElementById(`tab-trigger-${activeTab}`);
    if (activeLink && scrollRef.current) {
      const scrollArea = scrollRef.current;
      const linkRect = activeLink.getBoundingClientRect();
      const scrollAreaRect = scrollArea.getBoundingClientRect();

      const scrollOffset = (linkRect.left - scrollAreaRect.left) - (scrollAreaRect.width / 2) + (linkRect.width / 2);

      scrollArea.querySelector('[data-radix-scroll-area-viewport]')?.scrollBy({
        left: scrollOffset,
        behavior: 'smooth',
      });
    }
  }, [activeTab]);

  const handleBorderRadiusChange = (value: number[]) => {
    const newRadius = value[0];
    setBorderRadius(newRadius);
  };

  const handleCompanyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateCompany) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Função de atualização não encontrada.' });
      return;
    }
    setIsSubmitting(true);
    const dataToSave = {
      ...companyDetails,
      countEveryDays: countEvery(companyDetails.countEveryDays),
      documentNumbering: Object.fromEntries(
        Object.entries(docNumberingMap).filter(([_, v]) => v.prefix)
      ),
    };
    // a engrenagem a puxar a barra enquanto guarda
    await haul('settings', 'A guardar os dados da empresa…', 'Dados guardados', () => updateCompany(dataToSave));
    toast({ title: 'Sucesso!', description: 'Os dados da empresa foram atualizados.' });
    setIsSubmitting(false);
  };

  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setCompanyDetails(prev => ({ ...prev, [id]: value }));
  }

  const handleEmailSettingsChange = (index: number, field: string, value: any) => {
    setCompanyDetails(prev => {
      const newEmails = [...(prev.notificationSettings?.emails || [])];
      if (newEmails[index]) {
        newEmails[index] = { ...newEmails[index], [field]: value };
      }
      return {
        ...prev,
        notificationSettings: {
          ...(prev.notificationSettings || {}),
          emails: newEmails
        }
      };
    });
  };

  const addEmailSetting = () => {
    setCompanyDetails(prev => ({
      ...prev,
      notificationSettings: {
        ...(prev.notificationSettings || {}),
        emails: [
          ...(prev.notificationSettings?.emails || []),
          { email: '', onSale: false, onCriticalStock: false, onEndOfDayReport: false }
        ]
      }
    }));
  };

  const removeEmailSetting = (index: number) => {
    setCompanyDetails(prev => {
      const newEmails = [...(prev.notificationSettings?.emails || [])];
      newEmails.splice(index, 1);
      return {
        ...prev,
        notificationSettings: {
          ...(prev.notificationSettings || {}),
          emails: newEmails
        }
      };
    });
  };

  const handleClearProducts = async () => {
    if (clearProductsCollection && confirmAction) {
      confirmAction(async () => {
        toast({ title: "A limpar...", description: "A apagar todos os produtos do inventário no Firestore." });
        await clearProductsCollection();
        toast({ title: "Sucesso!", description: "A coleção de produtos foi limpa." });
        setShowClearConfirm(false);
      }, "Limpar Inventário", "Esta ação é irreversível e apagará todos os produtos. Confirme com a sua palavra-passe.");
    }
  };


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
              Esta ação é irreversível e irá apagar permanentemente <strong>todos</strong> os produtos do seu inventário no Firestore. Não será possível recuperar estes dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearProducts} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl md:text-3xl font-headline font-[900] text-slate-900 dark:text-white tracking-tighter">Configurações</h1>
        </div>

        <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="hidden md:block">
            <ScrollArea className="w-full whitespace-nowrap" ref={scrollRef}>
              <TabsList data-tour="set-tabs" className="inline-flex h-auto items-center justify-start rounded-2xl bg-muted p-1.5 text-muted-foreground w-max">
                {settingsTabs.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} id={`tab-trigger-${tab.value}`}>
                    <tab.icon className="mr-2 h-4 w-4" />{tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-tour="set-tabs" variant="outline" className="w-full justify-between">
                  <span>{settingsTabs.find(t => t.value === activeTab)?.label || 'Menu'}</span>
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                {settingsTabs.map(tab => (
                  <DropdownMenuItem key={tab.value} onSelect={() => setActiveTab(tab.value)}>
                    <tab.icon className="mr-2 h-4 w-4" />
                    <span>{tab.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <TabsContent value="profile" className="space-y-4">
            <PushSettingsCard />
            <ProfileTab />
            <SignInMethodsCard />
          </TabsContent>

          <TabsContent value="appearance">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Aparência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="theme">Modo de Cor</Label>
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
              </CardContent>
            </Card>
          </TabsContent>

          {hasPermission('settings') && (
            <>
              <TabsContent value="company">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Detalhes da Empresa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCompanyUpdate} className="space-y-6">
                      {/* Logo Upload Section */}
                      <div className="flex flex-col items-center gap-4 pb-6 border-b">
                        <Label className="text-base font-semibold">Logotipo da Empresa</Label>
                        {companyDetails.logoUrl ? (
                          <div className="relative group">
                            <img
                              src={companyDetails.logoUrl}
                              alt="Logotipo da Empresa"
                              className="h-24 max-w-[200px] object-contain rounded-lg border bg-white p-2"
                            />
                            <button
                              type="button"
                              onClick={() => setCompanyDetails(prev => ({ ...prev, logoUrl: '' }))}
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="h-24 w-48 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                            <ImagePlus className="h-8 w-8" />
                            <span className="text-xs">Sem logotipo</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Label htmlFor="logo-upload" className="cursor-pointer">
                            <Button type="button" variant="outline" size="sm" asChild>
                              <span>
                                <ImagePlus className="mr-2 h-4 w-4" />
                                {companyDetails.logoUrl ? 'Alterar' : 'Carregar Logotipo'}
                              </span>
                            </Button>
                          </Label>
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  toast({ title: "Carregando...", description: "A enviar o logótipo para a nuvem." });
                                  const url = await uploadProductImage(file, getAuth(), companyId!);
                                  setCompanyDetails(prev => ({ ...prev, logoUrl: url }));
                                  toast({ title: "Logótipo Carregado", description: "A imagem foi carregada e salva com sucesso!" });
                                } catch (error: any) {
                                  toast({ variant: 'destructive', title: 'Erro no Upload', description: error.message });
                                }
                              }
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">PNG ou JPG, max. 200x60px recomendado. Aparecerá nos e-mails de notificação e cabeçalho dos documentos.</p>
                      </div>

                      {/* Signature Upload Section */}
                      <div className="flex flex-col items-center gap-4 pb-6 border-b">
                        <Label className="text-base font-semibold">Carimbo ou Assinatura Digital</Label>
                        {companyDetails.signatureUrl ? (
                          <div className="relative group">
                            <img
                              src={companyDetails.signatureUrl}
                              alt="Carimbo / Assinatura"
                              className="h-24 max-w-[200px] object-contain rounded-lg border bg-white p-2"
                            />
                            <button
                              type="button"
                              onClick={() => setCompanyDetails(prev => ({ ...prev, signatureUrl: '' }))}
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="h-24 w-48 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                            <ImagePlus className="h-8 w-8" />
                            <span className="text-xs">Sem Assinatura</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Label htmlFor="signature-upload" className="cursor-pointer">
                            <Button type="button" variant="outline" size="sm" asChild>
                              <span>
                                <ImagePlus className="mr-2 h-4 w-4" />
                                {companyDetails.signatureUrl ? 'Alterar' : 'Carregar Assinatura/Carimbo'}
                              </span>
                            </Button>
                          </Label>
                          <input
                            id="signature-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  toast({ title: "Carregando...", description: "A enviar a assinatura para a nuvem." });
                                  const url = await uploadProductImage(file, getAuth(), companyId!);
                                  setCompanyDetails(prev => ({ ...prev, signatureUrl: url }));
                                  toast({ title: "Assinatura Carregada", description: "O carimbo/assinatura foi salvo com sucesso!" });
                                } catch (error: any) {
                                  toast({ variant: 'destructive', title: 'Erro no Upload', description: error.message });
                                }
                              }
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Recomendado enviar uma imagem com fundo transparente (.PNG). Aparecerá no rodapé dos documentos.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome da Empresa</Label>
                          <Input id="name" value={companyDetails.name} onChange={handleDetailChange} />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo de Negócio</Label>
                          <Select value={companyDetails.businessType} onValueChange={(value: 'manufacturer' | 'reseller') => setCompanyDetails(prev => ({ ...prev, businessType: value }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo de negócio" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manufacturer">Fábrica / Produtor</SelectItem>
                              <SelectItem value="reseller">Loja / Revendedor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {companyDetails.businessType === 'manufacturer' && (
                          <div className="space-y-2">
                            <Label htmlFor="curingDays">Dias até ficar pronto (secagem / cura)</Label>
                            <Input
                              id="curingDays"
                              type="number"
                              min={0}
                              max={30}
                              inputMode="numeric"
                              value={companyDetails.curingDays}
                              onChange={(e) => setCompanyDetails(prev => ({ ...prev, curingDays: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))}
                            />
                            <p className="text-xs text-muted-foreground">Só para quem tem um tempo de espera depois de produzir (betão a secar, cura, acabamento). Durante esses dias o produto já conta no stock, mas só se vende como “levanta depois”. Deixe em 0 se o produto fica pronto na hora — nada muda.</p>
                          </div>
                        )}
                        <div className="space-y-2" data-tour="set-count-every">
                          <Label htmlFor="countEveryDays">Lembrete de contagem do stock (dias)</Label>
                          <Input
                            id="countEveryDays"
                            type="number"
                            min={7}
                            max={180}
                            inputMode="numeric"
                            value={companyDetails.countEveryDays}
                            onChange={(e) => setCompanyDetails(prev => ({ ...prev, countEveryDays: Number(e.target.value) || 0 }))}
                            onBlur={() => setCompanyDetails(prev => ({ ...prev, countEveryDays: countEvery(prev.countEveryDays) }))}
                          />
                          <p className="text-xs text-muted-foreground">Se passar este tempo sem uma contagem, a app avisa no painel e por email — o stock da app pode já não bater certo com a prateleira. Entre 7 e 180 dias (por defeito {DEFAULT_COUNT_EVERY_DAYS}).</p>
                        </div>
                        <div className="flex items-start justify-between gap-3 rounded-md border p-3" data-tour="set-email-tips">
                          <div>
                            <Label htmlFor="emailTips" className="cursor-pointer">Dicas e lembretes por email</Label>
                            <p className="text-xs text-muted-foreground">Primeiros passos, contagem em atraso e "precisa de ajuda?" quando a app não é usada há uns dias. Os avisos de fim do teste ou da subscrição chegam sempre.</p>
                          </div>
                          <Switch id="emailTips" checked={companyDetails.emailTips} onCheckedChange={(checked) => setCompanyDetails(prev => ({ ...prev, emailTips: checked }))} />
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
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="paymentInfo">Informações de Pagamento (NIB, M-Pesa, Bancos)</Label>
                          <Textarea
                            id="paymentInfo"
                            className="min-h-[100px]"
                            placeholder="Descreva aqui as formas de pagamento. Ex:&#10;BCI: 1234 5678 9000&#10;M-Pesa: +258 84 000 0000"
                            value={companyDetails.paymentInfo}
                            onChange={(e) => setCompanyDetails(prev => ({ ...prev, paymentInfo: e.target.value }))}
                          />
                          <p className="text-xs text-muted-foreground">Esta informação aparecerá listada no final das suas Facturas e Recibos.</p>
                        </div>
                      </div>

                      <div className="space-y-4 pt-6 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2 font-semibold text-base">
                            <Mail className="h-5 w-5 text-primary" />
                            Notificações por E-mail
                          </Label>
                          <Button type="button" variant="outline" size="sm" onClick={addEmailSetting}>
                            + Adicionar E-mail
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 bg-card" data-tour="eod-time">
                          <div className="min-w-[12rem] flex-1">
                            <Label htmlFor="endOfDayTime" className="text-sm">Hora do Relatório Fecho do Dia</Label>
                            <p className="text-xs text-muted-foreground">Conta as vendas de hoje até essa hora, iguais ao Financeiro. O envio pode variar uns 30 minutos.</p>
                          </div>
                          <Select
                            value={companyDetails.notificationSettings.endOfDayTime}
                            onValueChange={(v) => setCompanyDetails(prev => ({ ...prev, notificationSettings: { ...prev.notificationSettings, endOfDayTime: reportTime(v) } }))}
                          >
                            <SelectTrigger id="endOfDayTime" className="w-32" aria-label="Hora do relatório"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {REPORT_TIMES.map((t) => <SelectItem key={t} value={t}>{reportTimeLabel(t)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        {(!companyDetails?.notificationSettings?.emails || companyDetails.notificationSettings.emails.length === 0) ? (
                          <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg text-center">
                            Nenhum e-mail de notificação configurado.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {companyDetails.notificationSettings.emails.map((emailConfig, index) => (
                              <div key={index} className="grid gap-4 rounded-2xl border p-4 relative bg-card">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                                  onClick={() => removeEmailSetting(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>

                                <div className="space-y-2 pr-10">
                                  <Label>E-mail {index + 1}</Label>
                                  <Input
                                    type="email"
                                    value={emailConfig.email || ''}
                                    onChange={(e) => handleEmailSettingsChange(index, 'email', e.target.value)}
                                    placeholder="ex: gerente@suaempresa.com"
                                  />
                                </div>
                                <div className="space-y-3 pt-2">
                                  <h4 className="font-medium text-sm text-muted-foreground">Alertas Ativos:</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="flex items-center justify-between space-x-2 rounded-md border p-3 bg-background/50">
                                      <Label htmlFor={`email-${index}-critical`} className="cursor-pointer text-sm flex-1">Stock Crítico</Label>
                                      <Switch
                                        id={`email-${index}-critical`}
                                        checked={!!emailConfig.onCriticalStock}
                                        onCheckedChange={(checked) => handleEmailSettingsChange(index, 'onCriticalStock', checked)}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between space-x-2 rounded-md border p-3 bg-background/50">
                                      <Label htmlFor={`email-${index}-sale`} className="cursor-pointer text-sm flex-1">Novas Vendas</Label>
                                      <Switch
                                        id={`email-${index}-sale`}
                                        checked={!!emailConfig.onSale}
                                        onCheckedChange={(checked) => handleEmailSettingsChange(index, 'onSale', checked)}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between space-x-2 rounded-md border p-3 bg-background/50">
                                      <Label htmlFor={`email-${index}-eod`} className="cursor-pointer text-sm flex-1">Relatório Fecho do Dia</Label>
                                      <Switch
                                        id={`email-${index}-eod`}
                                        checked={!!emailConfig.onEndOfDayReport}
                                        onCheckedChange={(checked) => handleEmailSettingsChange(index, 'onEndOfDayReport', checked)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 pt-6 border-t">
                        <Label className="flex items-center gap-2 font-semibold text-base">
                          <Hash className="h-5 w-5 text-primary" />
                          Numeração de Documentos
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Configure o formato dos números para cada tipo de documento. Cada tipo pode ter a sua própria numeração independente.
                        </p>
                        <Accordion type="multiple" className="w-full space-y-2">
                          {DOCUMENT_TYPES.map((docType) => {
                            const cfg = docNumberingMap[docType] || defaultTypeConfig;
                            const updateField = (field: string, value: any) => {
                              setDocNumberingMap(prev => ({
                                ...prev,
                                [docType]: { ...defaultTypeConfig, ...prev[docType], [field]: value }
                              }));
                            };
                            const previewNum = cfg.padding > 0 ? String(cfg.nextNumber || 1).padStart(cfg.padding, '0') : String(cfg.nextNumber || 1);
                            return (
                              <AccordionItem key={docType} value={docType} className="border rounded-lg">
                                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium">{docType}</span>
                                    {cfg.prefix && (
                                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                                        {cfg.prefix}{cfg.separator}{previewNum}
                                      </span>
                                    )}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Prefixo</Label>
                                      <Input
                                        value={cfg.prefix}
                                        onChange={(e) => updateField('prefix', e.target.value)}
                                        placeholder="Ex: VD"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Separador</Label>
                                      <Input
                                        value={cfg.separator}
                                        onChange={(e) => updateField('separator', e.target.value)}
                                        placeholder="-"
                                        maxLength={3}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Próx. Número</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={cfg.nextNumber || 1}
                                        onChange={(e) => updateField('nextNumber', Math.max(1, parseInt(e.target.value) || 1))}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Zeros</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={10}
                                        value={cfg.padding || 0}
                                        onChange={(e) => updateField('padding', Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                                      />
                                    </div>
                                  </div>
                                  {cfg.prefix && (
                                    <div className="mt-3 rounded-md bg-muted p-3 flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">Pré-visualização:</span>
                                      <span className="font-mono font-bold">{cfg.prefix}{cfg.separator}{previewNum}</span>
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>

                      <div className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? 'A guardar...' : 'Salvar Alterações'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents">
                <AfterSaleSetting />
                <DocumentsStyle />
              </TabsContent>

              <TabsContent value="locations">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Gestão de Localizações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LocationsManager />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="classification">
                <UnitsCategoriesManager />
              </TabsContent>


              <TabsContent value="security">
                <div className="space-y-6">
                  <BackupManager />
                  <StartFresh />
                  <FullReset />
                  <RecycleBin />
                </div>
              </TabsContent>

              <TabsContent value="advanced">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Ferramentas Avançadas</CardTitle>
                    <CardDescription>Ações de manutenção para corrigir inconsistências nos dados. Use com cuidado.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="font-semibold">Recalcular Stock Reservado</h3>
                      <p className="text-sm text-muted-foreground">
                        Sincroniza o stock reservado de todos os produtos com base nas vendas "Pagas" existentes. Útil para corrigir "reservas fantasma".
                      </p>
                      <Button onClick={() => inventoryContext?.recalculateReservedStock()} disabled={inventoryContext?.loading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Executar Recálculo
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        Atualização Rápida de Custos
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Atualize custos de múltiplos produtos agilmente para garantir o cálculo real do lucro.
                      </p>
                      <BulkEditCosts />
                    </div>

                    <Separator />

                    {user?.role === 'Admin' && (
                      <>
                        <CategoryMergeTool />
                        <Separator />
                        <AdminMergeTool />
                        <Separator />
                      </>
                    )}

                    <Separator />

                    <div className="space-y-2">
                      <h3 className="font-semibold text-destructive">Limpar Inventário</h3>
                      <p className="text-sm text-muted-foreground">
                        Move todos os produtos do inventário para a Lixeira (podem ser restaurados). Para apagar tudo de vez e recomeçar do zero, use "Apagar todos os dados da empresa" em Segurança.
                      </p>
                      <Button variant="destructive" onClick={() => setShowClearConfirm(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpar Produtos do Firestore
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}

        </Tabs>
      </div>
    </>
  );
}
