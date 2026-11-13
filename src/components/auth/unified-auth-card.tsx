'use client';

import React, { useState, useEffect, useContext, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { BRAND } from '@/lib/brand';
import { MajorStayLogo } from '@/components/brand-logo';
import { haul } from '@/lib/haul';
import { emailLink, SUPPORT, whatsappLink } from '@/lib/support';
import { savePendingCoupon, PENDING_COUPON_KEY } from '@/components/billing/pending-coupon';
import { saveOrigin } from '@/components/billing/escalepay-claim';
import { ESCALEPAY_SOURCE } from '@/lib/escalepay-core';
import { deriveUsername } from '@/lib/onboarding';
import { enterGuestMode, applyServerRemaining } from '@/lib/guest-mode';
import { guestTrialStart } from '@/lib/guest-trial-client';
import { InventoryContext } from '@/context/inventory-context';
import { useToast } from '@/hooks/use-toast';
import { getAuth, signOut } from 'firebase/auth';
import { beginRegistration, endRegistration } from '@/lib/registration-guard';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sparkles, Info, ArrowRight, Building2, User, Lock, Mail, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const registerSchema = z.object({
  companyName: z
    .string()
    .min(3, 'O nome do alojamento deve ter pelo menos 3 caracteres.')
    .refine((s) => !s.includes('@'), 'O nome não pode conter "@".'),
  adminEmail: z.string().email('O email fornecido não é válido.'),
  adminPassword: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const loginSchema = z.object({
  email: z.string().email('O email fornecido não é válido.'),
  password: z.string().min(1, 'A senha é obrigatória.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface UnifiedAuthCardProps {
  initialTab?: 'register' | 'login';
}

export function UnifiedAuthCard({ initialTab }: UnifiedAuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const context = useContext(InventoryContext);
  const { login, loginWithGoogle, registerCompany, registerCompanyWithGoogle } = context || {};

  // Estado da aba (default para 'register' para novos clientes a menos que venham com login explícito)
  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  // Fluxo Google sem fricção: quando o Google autentica mas ainda não tem empresa
  const [googleSetup, setGoogleSetup] = useState<{ email: string; displayName?: string } | null>(null);
  // ao sair desta página com a conta Google ainda sem hotel, deixa de segurar a sessão (como antes: sem empresa, sai)
  const googleSetupActive = useRef(false);
  useEffect(() => { googleSetupActive.current = !!googleSetup; }, [googleSetup]);
  useEffect(() => () => { if (googleSetupActive.current) endRegistration(); }, []);
  const [googleHotelName, setGoogleHotelName] = useState('');

  // Código de convite / cupão
  const [inviteCode, setInviteCode] = useState('');
  const [fromEscalepay, setFromEscalepay] = useState(false);

  // Inicialização inteligente da aba
  useEffect(() => {
    // 1. Respeitar query param explícito (?tab=login ou ?tab=register)
    const tabParam = searchParams.get('tab');
    if (tabParam === 'login' || tabParam === 'register') {
      setActiveTab(tabParam);
    } else if (initialTab) {
      setActiveTab(initialTab);
    } else {
      // 2. Se for um dispositivo com sessão anterior gravada, default = login; se novo = register
      try {
        const lastEmail = localStorage.getItem('majorstay_last_login_email');
        if (lastEmail) {
          setActiveTab('login');
        } else {
          setActiveTab('register');
        }
      } catch {
        setActiveTab('register');
      }
    }

    // Google query flag
    if (searchParams.get('google') === '1') {
      const email = searchParams.get('email') || '';
      setGoogleSetup({ email });
    }

    // Cupões e afiliados
    const c = searchParams.get('codigo') || searchParams.get('convite') || searchParams.get('cupao') || searchParams.get('code');
    if (c) setInviteCode(c.trim().toUpperCase());

    if ((searchParams.get('origem') || '').toLowerCase() === ESCALEPAY_SOURCE) {
      setFromEscalepay(true);
      saveOrigin(ESCALEPAY_SOURCE);
    }
  }, [initialTab, searchParams]);

  // Formulário de Registo
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: '',
      adminEmail: '',
      adminPassword: '',
    },
  });

  // Formulário de Login
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Pre-popular email anterior se existir
  useEffect(() => {
    try {
      const lastEmail = localStorage.getItem('majorstay_last_login_email');
      if (lastEmail && !loginForm.getValues('email')) {
        loginForm.setValue('email', lastEmail);
      }
    } catch {
      // ignorar
    }
  }, [loginForm]);

  const keepInvite = () => savePendingCoupon(inviteCode);
  const dropInvite = () => {
    try {
      localStorage.removeItem(PENDING_COUPON_KEY);
    } catch {
      // ignorar
    }
  };

  // --- 1. Submissão de Registo Manual ---
  const handleRegisterSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    if (!registerCompany) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Função de registo indisponível.' });
      setIsLoading(false);
      return;
    }

    keepInvite();
    try {
      const username = deriveUsername(data.adminEmail);
      const success = await haul('auth', 'A criar o seu alojamento…', 'Alojamento criado', async () => {
        const r = await registerCompany(data.companyName.trim(), username, data.adminEmail.trim(), data.adminPassword, 'reseller');
        if (!r) throw new Error('registo');
        return r;
      }).catch(() => false as const);

      if (success === 'existing') {
        dropInvite();
        toast({ title: 'Já tinha conta', description: 'Este email já tem uma conta — a entrar nela…' });
        try {
          localStorage.setItem('majorstay_last_login_email', data.adminEmail.trim());
        } catch {}
        router.push('/dashboard');
      } else if (success) {
        try {
          localStorage.setItem('majorstay_last_login_email', data.adminEmail.trim());
        } catch {}
        toast({
          title: 'Conta Criada com Sucesso! 🎉',
          description: `Bem-vindo ao ${BRAND.name}. A iniciar o seu período de teste grátis...`,
        });
        router.push('/dashboard');
      } else {
        dropInvite();
      }
    } catch (err: any) {
      dropInvite();
      console.error('Erro no registo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. Submissão de Login Manual ---
  const handleLoginSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    if (!login) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço de autenticação indisponível.' });
      setIsLoading(false);
      return;
    }

    try {
      const success = await haul('auth', 'A entrar…', 'Bem-vindo', async () => {
        const ok = await login(data.email.trim(), data.password);
        if (!ok) throw new Error('login');
        return ok;
      }).catch(() => false);

      if (success) {
        try {
          localStorage.setItem('majorstay_last_login_email', data.email.trim());
        } catch {}
        toast({
          title: 'Login bem-sucedido!',
          description: 'A redirecionar para o painel de quartos...',
        });
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Erro no login:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. Continuar com o Google (Universal: Entrar OU Criar Conta) ---
  const handleUniversalGoogleAuth = async () => {
    setIsGoogleLoading(true);
    if (!loginWithGoogle) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço de autenticação Google indisponível.' });
      setIsGoogleLoading(false);
      return;
    }

    try {
      const res = await loginWithGoogle();

      if (res && typeof res === 'object' && res.noCompany) {
        // Conta Google sem empresa: NÃO faz signOut! Permanece autenticada e mostra o campo do hotel
        setGoogleSetup({
          email: res.noCompany,
          displayName: res.displayName || '',
        });
        toast({
          title: 'Google autenticado com sucesso!',
          description: 'Falta apenas dar o nome ao seu Hotel ou Alojamento para começar.',
        });
      } else if (res === true) {
        // Já tem empresa associada: entra direto!
        toast({
          title: 'Bem-vindo de volta!',
          description: 'A redirecionar para o painel de quartos...',
        });
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Erro no Google Auth:', err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // --- 4. Conclusão do Registo Google (Passo Único do Nome do Alojamento) ---
  const handleCompleteGoogleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleHotelName.trim() || googleHotelName.trim().length < 3) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Por favor insira o nome do seu Hotel, Pensão ou Alojamento (mín. 3 caracteres).',
      });
      return;
    }

    setIsGoogleLoading(true);
    if (!registerCompanyWithGoogle) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Função de registo com Google indisponível.' });
      setIsGoogleLoading(false);
      return;
    }

    keepInvite();
    try {
      // Reutiliza o auth.currentUser já autenticado sem abrir pop-up secundário!
      const ok = await registerCompanyWithGoogle(googleHotelName.trim(), 'reseller');
      if (ok) {
        toast({
          title: 'Alojamento Configurado com Sucesso! 🎉',
          description: 'A iniciar o seu período de teste grátis no MajorStay...',
        });
        router.push('/dashboard');
      } else {
        dropInvite();
        beginRegistration(); // falhou: continua no ecrã do nome do hotel, sem a sessão ser dada por perdida
      }
    } catch (err: any) {
      dropInvite();
      beginRegistration();
      console.error('Erro ao finalizar Google Setup:', err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Cancelar setup Google e voltar ao início
  const handleCancelGoogleSetup = async () => {
    try {
      await signOut(getAuth());
    } catch {
      // ignorar
    }
    endRegistration(); // liberta a espera da sessão (ver loginWithGoogle)
    setGoogleSetup(null);
    setGoogleHotelName('');
  };

  // --- 5. Modo Convidado / Demo ---
  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    const reply = await guestTrialStart();
    if (reply?.tracked && !reply.allowed) {
      setIsGuestLoading(false);
      toast({
        variant: 'destructive',
        title: reply.reason === 'network' ? 'Testes a mais nesta rede' : 'Tempo de teste esgotado',
        description: reply.reason === 'network'
          ? 'Esta rede já abriu muitos testes. Crie a sua conta para continuar.'
          : 'Os 30 minutos de teste já foram usados neste aparelho. Crie a sua conta para continuar.',
      });
      return;
    }
    if (reply?.tracked) applyServerRemaining(reply.remainingMs);
    if (!enterGuestMode()) {
      setIsGuestLoading(false);
      toast({
        variant: 'destructive',
        title: 'Tempo de teste esgotado',
        description: 'Os 30 minutos de teste já foram usados neste aparelho. Crie a sua conta para continuar.',
      });
      return;
    }
    toast({
      title: 'Modo Convidado Activado!',
      description: 'A carregar dados de demonstração dos últimos 30 dias...',
    });
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] dark:bg-[#150F0C] px-4 py-8">
      <Card className="w-full max-w-sm bg-[#FFFDF9] dark:bg-[#1E1714] border-[#E5DFD6] dark:border-[#382D26] shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="text-center pb-3">
          <div className="flex justify-center mb-2">
            <MajorStayLogo size="lg" horizontal={false} showTagline />
          </div>

          {/* Se estiver no passo final do Google Setup */}
          {googleSetup ? (
            <>
              <CardTitle className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center justify-center gap-1.5">
                <span>Olá, {googleSetup.displayName ? googleSetup.displayName.split(' ')[0] : 'Gestor'}!</span> 👋
              </CardTitle>
              <CardDescription className="text-xs text-stone-500 dark:text-stone-400">
                Falta apenas dar o nome ao seu alojamento para começar o teste grátis.
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                {activeTab === 'register' ? 'Comece o seu Teste Grátis' : 'Bem-vindo de volta!'}
              </CardTitle>
              <CardDescription className="text-xs text-stone-500 dark:text-stone-400">
                {activeTab === 'register'
                  ? 'Controlo total de quartos, consumos, caixa e QR Code em 5 segundos.'
                  : 'Inicie sessão para gerir os quartos, check-ins e faturação.'}
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* PASSO ESPECÍFICO: Setup Google (Quando já autenticou no Google mas falta só o hotel) */}
          {googleSetup ? (
            <form onSubmit={handleCompleteGoogleSetup} className="space-y-4">
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-blue-950 dark:text-sky-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Conta Google Verificada</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px] truncate">
                  {googleSetup.email}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleHotelName" className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  Nome do seu Hotel, Pensão ou Alojamento <span className="text-[#fd761a]">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                  <Input
                    id="googleHotelName"
                    autoFocus
                    value={googleHotelName}
                    onChange={(e) => setGoogleHotelName(e.target.value)}
                    placeholder="Ex: Pensão Central / Residencial Luanda"
                    className="pl-9 h-11 rounded-xl bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 font-medium"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isGoogleLoading || !googleHotelName.trim()}
                className="w-full h-11 rounded-xl bg-[#007bb9] hover:bg-[#006194] text-white font-bold text-sm shadow-md transition-all active:scale-95"
              >
                {isGoogleLoading ? 'A preparar o seu sistema...' : 'Criar Alojamento e Entrar 🚀'}
              </Button>

              <button
                type="button"
                onClick={handleCancelGoogleSetup}
                className="w-full text-center text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 underline pt-1"
              >
                Cancelar ou usar outra conta
              </button>
            </form>
          ) : (
            <>
              {/* COMUTADOR DE ABAS MODERNO NO TOPO */}
              <div className="grid grid-cols-2 p-1 bg-stone-100 dark:bg-stone-900 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className={cn(
                    'py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                    activeTab === 'register'
                      ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Criar Conta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className={cn(
                    'py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                    activeTab === 'login'
                      ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                  )}
                >
                  <span>Iniciar Sessão</span>
                </button>
              </div>

              {/* BOTÃO UNIVERSAL GOOGLE: 1 CLIQUE RESOLVE TUDO */}
              <Button
                variant="outline"
                type="button"
                disabled={isLoading || isGoogleLoading || isGuestLoading}
                onClick={handleUniversalGoogleAuth}
                className="w-full h-11 bg-white hover:bg-stone-50 text-stone-800 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800 border-stone-200 dark:border-stone-800 rounded-xl shadow-xs font-semibold text-xs transition-all active:scale-98"
              >
                {isGoogleLoading ? (
                  'A autenticar...'
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                      <path d="M1 1h22v22H1z" fill="none" />
                    </svg>
                    <span>{activeTab === 'register' ? 'Criar Conta com o Google' : 'Continuar com o Google'}</span>
                  </>
                )}
              </Button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-stone-200 dark:border-stone-800" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-[#FFFDF9] dark:bg-[#1E1714] px-2 text-stone-400 font-medium">
                    {activeTab === 'register' ? 'ou registe com email' : 'ou com email e senha'}
                  </span>
                </div>
              </div>

              {/* ABA 1: CRIAR CONTA (100% Hotelaria, sem Fábrica/Loja) */}
              {activeTab === 'register' && (
                <form onSubmit={registerForm.handleSubmit(handleRegisterSubmit)} className="space-y-3">
                  {fromEscalepay && (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                      <p className="font-semibold">Comprou na EscalePay? 🎉</p>
                      <p className="text-[11px] mt-0.5">Use o mesmo email da compra para ativar a sua licença automaticamente.</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="companyName" className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Nome do Hotel, Pensão ou Alojamento
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <Input
                        id="companyName"
                        {...registerForm.register('companyName')}
                        placeholder="Ex: Pensão Central / Residencial Sol"
                        className="pl-9 h-10 rounded-xl bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-xs font-medium"
                      />
                    </div>
                    {registerForm.formState.errors.companyName && (
                      <p className="text-[11px] text-red-500">{registerForm.formState.errors.companyName.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="adminEmail" className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Email do Administrador
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <Input
                        id="adminEmail"
                        type="email"
                        {...registerForm.register('adminEmail')}
                        placeholder="ex: admin@seualojamento.com"
                        className="pl-9 h-10 rounded-xl bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-xs font-medium"
                      />
                    </div>
                    {registerForm.formState.errors.adminEmail && (
                      <p className="text-[11px] text-red-500">{registerForm.formState.errors.adminEmail.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="adminPassword" className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Senha de Acesso
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <Input
                        id="adminPassword"
                        type={showPassword ? 'text' : 'password'}
                        {...registerForm.register('adminPassword')}
                        placeholder="Crie uma senha segura (mín. 6 letras)"
                        className="pl-9 h-10 rounded-xl bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-xs font-medium"
                      />
                    </div>
                    {registerForm.formState.errors.adminPassword && (
                      <p className="text-[11px] text-red-500">{registerForm.formState.errors.adminPassword.message}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 pt-0.5">
                    <Checkbox
                      id="show-password-reg"
                      checked={showPassword}
                      onCheckedChange={(checked) => setShowPassword(!!checked)}
                    />
                    <label
                      htmlFor="show-password-reg"
                      className="text-xs font-medium text-stone-600 dark:text-stone-400 cursor-pointer select-none"
                    >
                      Mostrar senha
                    </label>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || isGoogleLoading || isGuestLoading}
                    className="w-full h-11 rounded-xl bg-[#007bb9] hover:bg-[#006194] text-white font-bold text-xs shadow-md transition-all active:scale-95 mt-1"
                  >
                    {isLoading ? 'A criar a sua conta...' : 'Começar Teste Grátis (14 Dias) 🚀'}
                  </Button>
                </form>
              )}

              {/* ABA 2: INICIAR SESSÃO */}
              {activeTab === 'login' && (
                <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="loginEmail" className="text-xs font-bold text-stone-800 dark:text-stone-200">
                        Email de Login
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="p-0.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="Ajuda sobre o formato do email">
                            <Info className="h-3.5 w-3.5 text-stone-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 max-w-xs" side="top" align="end">
                          <div className="p-3 text-xs space-y-1.5">
                            <p className="font-bold">Formato do Email</p>
                            <p><strong className="text-primary">Admin:</strong> Use o email do registo.</p>
                            <p><strong className="text-primary">Receção/Staff:</strong> Use o formato `utilizador@empresa.com`.</p>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <Input
                        id="loginEmail"
                        type="email"
                        {...loginForm.register('email')}
                        placeholder="ex: admin@seualojamento.com"
                        className="pl-9 h-10 rounded-xl bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-xs font-medium"
                      />
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="text-[11px] text-red-500">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="loginPassword" className="text-xs font-bold text-stone-800 dark:text-stone-200">
                        Senha
                      </Label>
                      <ForgotPasswordDialog />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <Input
                        id="loginPassword"
                        type={showPassword ? 'text' : 'password'}
                        {...loginForm.register('password')}
                        placeholder="A sua senha"
                        className="pl-9 h-10 rounded-xl bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-xs font-medium"
                      />
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-[11px] text-red-500">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 pt-0.5">
                    <Checkbox
                      id="show-password-login"
                      checked={showPassword}
                      onCheckedChange={(checked) => setShowPassword(!!checked)}
                    />
                    <label
                      htmlFor="show-password-login"
                      className="text-xs font-medium text-stone-600 dark:text-stone-400 cursor-pointer select-none"
                    >
                      Mostrar senha
                    </label>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || isGoogleLoading || isGuestLoading}
                    className="w-full h-11 rounded-xl bg-[#007bb9] hover:bg-[#006194] text-white font-bold text-xs shadow-md transition-all active:scale-95 mt-1"
                  >
                    {isLoading ? 'A entrar...' : 'Entrar no Sistema'}
                  </Button>
                </form>
              )}

              {/* DEMO / MODO CONVIDADO */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isLoading || isGoogleLoading || isGuestLoading}
                  onClick={handleGuestLogin}
                  className="w-full h-10 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-300 text-xs font-medium flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>{isGuestLoading ? 'A abrir...' : 'Experimentar como Convidado (30 min)'}</span>
                </Button>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-1.5 text-xs pb-5 border-t border-stone-100 dark:border-stone-900 pt-3">
          <p className="text-stone-500 dark:text-stone-400 text-center">
            Precisa de ajuda?{' '}
            <a
              href={whatsappLink(`Olá, preciso de ajuda com o ${BRAND.name}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#007bb9] dark:text-sky-400 hover:underline"
            >
              WhatsApp {SUPPORT.whatsappDisplay}
            </a>
          </p>
          <p className="text-[11px] text-stone-400 dark:text-stone-500">
            <Link href="/termos" className="hover:underline">Termos</Link> · <Link href="/privacidade" className="hover:underline">Privacidade</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function ForgotPasswordDialog() {
  const { resetPassword } = useContext(InventoryContext) || {};
  const [email, setEmail] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword || !email) return;

    setIsLoading(true);
    try {
      await resetPassword(email);
      setIsOpen(false);
    } catch {
      // tratado no contexto
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-[11px] text-[#007bb9] dark:text-sky-400 hover:underline font-bold">
          Esqueceu a senha?
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Recuperar Senha</DialogTitle>
          <DialogDescription className="text-xs">
            Insira o seu email de administrador para receber o link de redefinição de senha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleReset} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reset-email" className="text-xs font-bold">Email</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="ex: admin@seualojamento.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl h-10 text-xs"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading} className="w-full rounded-xl bg-[#007bb9] hover:bg-[#006194] text-white font-bold text-xs">
              {isLoading ? 'A enviar...' : 'Enviar Link de Redefinição'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
