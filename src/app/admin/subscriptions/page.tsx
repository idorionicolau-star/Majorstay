"use client";

import { useState, useEffect, useContext, useMemo } from 'react';
import { InventoryContext } from '@/context/inventory-context';
import { useFirestore } from '@/firebase/provider';
import { collection, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, ShieldAlert, CheckCircle, Clock, AlertOctagon, Bug } from 'lucide-react';
import Link from 'next/link';
import { Company } from '@/lib/types';
import { TIERS, isTierId, tierAmount } from '@/lib/tiers';
import { ZumboPayCheck } from '@/components/admin/zumbopay-check';
import { EscalepayPanel } from '@/components/admin/escalepay-panel';
import { ManualPaymentsPanel } from '@/components/admin/manual-payments-panel';
import { TestEmailsPanel } from '@/components/admin/test-emails-panel';
import { AffiliatesPanel } from '@/components/admin/affiliates-panel';
import { getAuth } from 'firebase/auth';
import { isSuperAdminEmail } from '@/lib/super-admin';
import { companyStanding, standingOrder, toDateInput, type CompanyStanding } from '@/lib/admin-subscription';
import { cn } from '@/lib/utils';



export default function SubscriptionsAdminPage() {
  const inventoryContext = useContext(InventoryContext);
  const firestore = useFirestore();
  const { toast } = useToast();

  const user = inventoryContext?.user;
  const firebaseUser = inventoryContext?.firebaseUser;
  const loadingContext = inventoryContext?.loading;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Checks access based on currently logged in user email
  const userEmail = firebaseUser?.email || user?.email || "";
  const isAuthorized = isSuperAdminEmail(userEmail);

  useEffect(() => {
    if (!isAuthorized || !firestore) return;

    async function fetchCompanies() {
      try {
        setLoadingCompanies(true);
        // Uma chamada ao servidor primeiro: na 1.ª visita ele põe a marca superAdmin no Firestore (ver verifyIdToken),
        // que as regras exigem para ler a lista de todas as empresas.
        const token = await getAuth().currentUser?.getIdToken().catch(() => null);
        if (token) await fetch('/api/admin/manual-payments', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
        const companiesRef = collection(firestore!, 'companies');
        const querySnapshot = await getDocs(companiesRef);
        const list: Company[] = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Company);
        });
        setCompanies(list);
      } catch (error: any) {
        console.error("Error loading companies list:", error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar empresas",
          description: "Verifique se a sua conta Firestore tem a permissão 'superAdmin' ativada.",
        });
      } finally {
        setLoadingCompanies(false);
      }
    }

    fetchCompanies();
  }, [firestore, isAuthorized, toast]);

  const handleUpdateCompany = async (
    companyId: string,
    status: Company['status'],
    trialEndsAt: string,
    subscriptionEndsAt: string,
    tier: string
  ) => {
    try {
      setUpdatingId(companyId);
      // pelo servidor: grava as datas no formato que as regras lêem e actualiza paidUntilMs (ver /api/admin/companies)
      const token = await getAuth().currentUser?.getIdToken();
      const r = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId, status, trialEndsAt, subscriptionEndsAt, tier }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Não foi possível atualizar a subscrição.');

      setCompanies(prev => prev.map(c => c.id === companyId ? {
        ...c, status: j.status, trialEndsAt: j.trialEndsAt || undefined, subscriptionEndsAt: j.subscriptionEndsAt || undefined, tier: j.tier || undefined,
      } : c));

      toast({
        title: "Alterações salvas",
        description: "Os dados da subscrição foram atualizados com sucesso.",
      });
    } catch (e: any) {
      console.error("Failed to update company subscription:", e);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: e.message || "Não foi possível atualizar a subscrição."
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // Tempo restante de cada empresa (teste ou subscrição), o que pede atenção primeiro
  const rows = useMemo(() => {
    const now = new Date();
    return companies
      .map((c) => ({ company: c, standing: companyStanding(c, now) }))
      .sort((a, b) => standingOrder(a.standing) - standingOrder(b.standing) || (a.company.name || '').localeCompare(b.company.name || ''));
  }, [companies]);

  const summary = useMemo(() => {
    const count = (f: (s: CompanyStanding) => boolean) => rows.filter((r) => f(r.standing)).length;
    return [
      { label: 'Em teste', n: count((s) => s.kind === 'trial'), cls: 'text-sky-600' },
      { label: 'Activas (pagas)', n: count((s) => s.kind === 'active' || s.kind === 'active_open'), cls: 'text-emerald-600' },
      { label: 'Acabam em ≤ 7 dias', n: count((s) => (s.kind === 'trial' || s.kind === 'active') && s.daysLeft != null && s.daysLeft <= 7), cls: 'text-amber-600' },
      { label: 'Em tolerância', n: count((s) => s.kind === 'grace'), cls: 'text-orange-600' },
      { label: 'Teste acabado', n: count((s) => s.kind === 'trial_expired'), cls: 'text-red-600' },
      { label: 'Subscrição acabada', n: count((s) => s.kind === 'expired'), cls: 'text-red-600' },
      { label: 'Suspensas', n: count((s) => s.kind === 'suspended'), cls: 'text-muted-foreground' },
    ];
  }, [rows]);

  // 1. Loading state
  if (loadingContext) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">A verificar permissões...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthorized state
  if (!isAuthorized) {
    return (
      <div className="container mx-auto py-8 max-w-md mt-10">
        <Card className="border-destructive/20 bg-destructive/5 dark:bg-destructive/10">
          <CardHeader className="text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-xl">Acesso Negado</CardTitle>
            <CardDescription>
              Apenas os administradores do sistema têm acesso a esta página de gestão de subscrições.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            O seu utilizador atual (<strong>{userEmail || 'Convidado'}</strong>) não está autorizado.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl md:text-3xl font-headline font-[900] text-slate-900 dark:text-white tracking-tighter">
            Gestão de Subscrições (Admin)
          </h1>
          <p className="text-muted-foreground">
            Ative, suspenda ou configure os períodos de teste (Trial) de todas as empresas no sistema.
          </p>
        </div>
        {/* os erros que os clientes apanharam no ecrã (o mesmo que o resumo diário por email) */}
        <Button asChild variant="outline">
          <Link href="/admin/errors"><Bug className="mr-2 h-4 w-4" /> Erros</Link>
        </Button>
      </div>

      <ManualPaymentsPanel />

      <AffiliatesPanel />

      <TestEmailsPanel ownEmail={userEmail} />

      <EscalepayPanel ownEmail={userEmail} />

      <ZumboPayCheck />

      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Empresas Registadas
          </CardTitle>
          <CardDescription>
            Quanto falta a cada empresa (teste gratuito ou subscrição) — as que pedem atenção primeiro. Pode mudar o estado e as datas e guardar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCompanies ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhuma empresa encontrada ou erro de permissão no Firestore.
            </div>
          ) : (
            <>
            <div data-tour="admin-summary" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {summary.map((x) => (
                <div key={x.label} className="rounded-lg border px-3 py-2">
                  <p className={cn("text-xl font-bold tabular-nums", x.n ? x.cls : "text-muted-foreground")}>{x.n}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{x.label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tempo restante</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Término do Trial (AAAA-MM-DD)</TableHead>
                    <TableHead>Término da Subscrição (AAAA-MM-DD)</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ company, standing }) => (
                    <CompanyRow
                      key={company.id}
                      company={company}
                      standing={standing}
                      isUpdating={updatingId === company.id}
                      onSave={(status, trial, sub, tier) => handleUpdateCompany(company.id, status, trial, sub, tier)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Inner component to manage row-level editing states easily
const STANDING_STYLE: Record<CompanyStanding['kind'], string> = {
  trial: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  active_open: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  grace: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  trial_expired: 'bg-red-500/15 text-red-700 dark:text-red-400',
  expired: 'bg-red-500/15 text-red-700 dark:text-red-400',
  suspended: 'bg-muted text-muted-foreground',
};

function CompanyRow({
  company,
  standing,
  isUpdating,
  onSave
}: {
  company: Company;
  standing: CompanyStanding;
  isUpdating: boolean;
  onSave: (status: Company['status'], trial: string, sub: string, tier: string) => void;
}) {
  const [status, setStatus] = useState<Company['status']>(company.status || 'trial');
  // as datas vêm em ISO completo; a caixa de data só aceita AAAA-MM-DD (antes ficava vazia)
  const savedTrial = toDateInput(company.trialEndsAt);
  const savedSub = toDateInput(company.subscriptionEndsAt);
  const [trialEndsAt, setTrialEndsAt] = useState(savedTrial);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState(savedSub);
  // plano (nível): "atual" = sem nível, o plano antigo com tudo incluído
  const savedTier = isTierId(company.tier) ? company.tier! : 'atual';
  const [tier, setTier] = useState(savedTier);
  useEffect(() => { setTrialEndsAt(savedTrial); setSubscriptionEndsAt(savedSub); setStatus(company.status || 'trial'); setTier(savedTier); }, [savedTrial, savedSub, company.status, savedTier]);
  const urgent = (standing.kind === 'trial' || standing.kind === 'active') && standing.daysLeft != null && standing.daysLeft <= 7;

  const hasChanges =
    status !== (company.status || 'trial') ||
    trialEndsAt !== savedTrial ||
    subscriptionEndsAt !== savedSub ||
    tier !== savedTier;

  return (
    <TableRow>
      <TableCell className="font-semibold">
        <div className="flex flex-col">
          <span>{company.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{company.id}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", STANDING_STYLE[standing.kind], urgent && "ring-1 ring-amber-500")}>
          {standing.label}
        </span>
        {standing.endsAt && (
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {standing.kind.startsWith('trial') ? 'fim do teste' : 'fim'}: {new Date(standing.endsAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Select 
          value={status} 
          onValueChange={(val: any) => setStatus(val)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">
              <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                <CheckCircle className="h-3.5 w-3.5" /> Ativo
              </span>
            </SelectItem>
            <SelectItem value="trial">
              <span className="flex items-center gap-1.5 text-blue-500 font-medium">
                <Clock className="h-3.5 w-3.5" /> Trial
              </span>
            </SelectItem>
            <SelectItem value="suspended">
              <span className="flex items-center gap-1.5 text-destructive font-semibold">
                <AlertOctagon className="h-3.5 w-3.5" /> Suspenso
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-[150px]" aria-label="Plano"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="atual">Completo (antigo)</SelectItem>
            {TIERS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label} · {tierAmount(t.id, 'mensal')} MT</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input 
          type="date" 
          value={trialEndsAt} 
          onChange={(e) => setTrialEndsAt(e.target.value)}
          className="w-40 font-mono"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="date" 
          value={subscriptionEndsAt} 
          onChange={(e) => setSubscriptionEndsAt(e.target.value)}
          className="w-40 font-mono"
        />
      </TableCell>
      <TableCell className="text-right">
        <Button 
          size="sm" 
          disabled={!hasChanges || isUpdating}
          onClick={() => onSave(status, trialEndsAt, subscriptionEndsAt, tier)}
        >
          {isUpdating ? 'A Guardar...' : 'Guardar'}
        </Button>
      </TableCell>
    </TableRow>
  );
}
