
'use client';

import { haul } from '@/lib/haul';
import { useState, useContext } from 'react';
import { emailLink, SUPPORT, whatsappLink } from "@/lib/support";
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { InventoryContext } from '@/context/inventory-context';
import Image from 'next/image';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { Info, Sparkles } from 'lucide-react';
import { enterGuestMode, applyServerRemaining } from '@/lib/guest-mode';
import { guestTrialStart } from '@/lib/guest-trial-client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';


const loginSchema = z.object({
  email: z.string().email('O email fornecido não é válido.'),
  password: z.string().min(1, 'A senha é obrigatória.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { login, loginWithGoogle } = useContext(InventoryContext) || {};
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    // O servidor guarda o tempo por aparelho e por rede: sair e voltar continua a contagem (não recomeça). Sem rede
    // (null) vale o relógio do aparelho.
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
      toast({ variant: 'destructive', title: 'Tempo de teste esgotado', description: 'Os 30 minutos de teste já foram usados neste aparelho. Crie a sua conta para continuar.' });
      return;
    }
    toast({
      title: 'Modo Convidado Activado!',
      description: 'A entrar com dados completos de demonstração dos últimos 30 dias...',
    });
    router.push('/dashboard');
  };

  const handleLogin = async (data: LoginFormValues) => {
    setIsLoading(true);
    if (!login) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço de autenticação indisponível.' });
      setIsLoading(false);
      return;
    }
    try {
      // a chave a puxar a barra enquanto entra (os erros continuam a aparecer no aviso de sempre)
      const success = await haul('auth', 'A entrar…', 'Bem-vindo', async () => {
        const ok = await login(data.email, data.password);
        if (!ok) throw new Error('login');
        return ok;
      }).catch(() => false);
      if (success) {
        toast({
          title: 'Login bem-sucedido!',
          description: 'A redirecionar para o dashboard...',
        });
        router.push('/dashboard');
      }
    } catch (error: any) {
      // Errors are toasted within the login function in the context
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    if (!loginWithGoogle) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço de autenticação com Google indisponível.' });
      setIsGoogleLoading(false);
      return;
    }
    try {
      const success = await loginWithGoogle();
      if (success && typeof success === 'object') {
        // conta Google sem empresa: leva ao registo, já só a pedir o nome da empresa
        router.push(`/register?google=1${success.noCompany ? `&email=${encodeURIComponent(success.noCompany)}` : ''}`);
      } else if (success) {
        toast({
          title: 'Login com Google bem-sucedido!',
          description: 'A redirecionar para o dashboard...',
        });
        router.push('/dashboard');
      }
    } catch (error: any) {
      // Errors handled within the context func
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image src="/logo.svg" alt="MajorStockX Logo" width={48} height={48} />
          </div>
          <CardTitle className="text-2xl font-bold">Bem-vindo de volta!</CardTitle>
          <CardDescription>Faça login para aceder ao MajorStockX.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <form onSubmit={handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email">Email de Login</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="p-1 rounded-full hover:bg-muted" aria-label="Ajuda sobre o formato do email">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 max-w-xs" side="top" align="end">
                      <div className="p-3 text-xs space-y-2">
                        <p className="font-bold">Formato do Email de Login</p>
                        <p><strong className="text-primary">Admin:</strong> Use o email completo do registo (ex: `admin@empresa.com`).</p>
                        <p><strong className="text-primary">Funcionário:</strong> Use o formato `utilizador@nome-da-empresa.com`.</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input id="email" {...register('email')} placeholder="ex: admin@suaempresa.com" type="email" />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <ForgotPasswordDialog />
                </div>
                <Input id="password" type={showPassword ? 'text' : 'password'} {...register('password')} placeholder="A sua senha" />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="show-password" checked={showPassword} onCheckedChange={(checked) => setShowPassword(!!checked)} />
                <label
                  htmlFor="show-password"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Mostrar senha
                </label>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
                {isLoading ? 'A entrar...' : 'Entrar'}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Ou continuar com</span>
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              disabled={isLoading || isGoogleLoading}
              onClick={handleGoogleLogin}
              className="w-full bg-white text-black hover:bg-gray-100 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {isGoogleLoading ? (
                'A autenticar...'
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
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
                  Entrar com o Google
                </>
              )}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Ou experimente sem criar conta</span>
              </div>
            </div>

            <Button
              type="button"
              disabled={isLoading || isGoogleLoading || isGuestLoading}
              onClick={handleGuestLogin}
              className="group relative h-auto w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-white shadow-lg shadow-blue-600/30 ring-1 ring-white/20 transition-all hover:scale-[1.01] hover:brightness-110 hover:shadow-xl hover:shadow-blue-600/40 active:scale-[0.99]"
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden="true" />
              <span className="relative flex items-center justify-center gap-3">
                <Sparkles className="h-6 w-6 shrink-0" />
                <span className="flex flex-col items-start text-left leading-tight">
                  <span className="text-base font-bold">{isGuestLoading ? 'A abrir o teste...' : 'Experimentar como Convidado'}</span>
                  <span className="text-xs font-normal text-white/85">Sem registo · 30 min com dados de exemplo</span>
                </span>
              </span>
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-2 text-sm">
          <p className="text-muted-foreground">
            Não tem uma conta? <Link href="/register" className="text-primary hover:underline">Crie uma aqui.</Link>
          </p>
          <p className="text-xs text-muted-foreground">
            Problemas a entrar?{" "}
            <a href={whatsappLink("Olá, estou com problemas a entrar na MajorStockX.")} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
              WhatsApp {SUPPORT.whatsappDisplay}
            </a>
            {" "}ou{" "}
            <a href={emailLink("Problemas a entrar na MajorStockX")} className="font-medium text-primary hover:underline">email</a>
          </p>
          <p className="text-[11px] text-muted-foreground">
            <Link href="/termos" className="hover:underline">Termos de Uso</Link> · <Link href="/privacidade" className="hover:underline">Privacidade</Link>
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
    } catch (error) {
      // Error is handled in the context with a toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="px-0 font-normal h-auto text-xs text-primary underline-offset-4 hover:underline">
          Esqueceu a senha?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Recuperar Senha</DialogTitle>
          <DialogDescription>
            Insira o seu e-mail para receber um link de redefinição de senha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleReset} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">E-mail</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="ex: voce@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'A enviar...' : 'Enviar Link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
