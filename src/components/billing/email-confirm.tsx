"use client";

// Confirmar o email antes do primeiro produto (ver lib/email-confirm.ts).
// - requireEmailConfirmed(): quem cria produtos pergunta antes de gravar; se faltar a confirmação abre o aviso
//   ("Reenviar email" / "Já confirmei") e só continua depois de confirmado.
// - EmailConfirmHost (uma vez, no layout): o aviso, a faixa discreta no topo e o registo automático — um Dono/Admin com
//   email confirmado (o Google já vem confirmado) fica registado na empresa (emailVerifiedAt) ao abrir a app.
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { reload, sendEmailVerification } from "firebase/auth";
import { Loader2, MailCheck, X } from "lucide-react";
import { InventoryContext } from "@/context/inventory-context";
import { useAuth } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canMarkVerified, needsEmailConfirm } from "@/lib/email-confirm";

const EVENT = "msx-email-gate";
let hostReady = false;

/** Antes de criar produtos: true = pode continuar (já confirmado, ou confirmou agora); false = desistiu. */
export function requireEmailConfirmed(): Promise<boolean> {
    if (typeof window === "undefined" || !hostReady) return Promise.resolve(true);
    return new Promise((resolve) => window.dispatchEvent(new CustomEvent(EVENT, { detail: { resolve } })));
}

export function EmailConfirmHost() {
    const ctx = useContext(InventoryContext);
    const auth = useAuth();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState<null | "send" | "check">(null);
    const [bannerClosed, setBannerClosed] = useState(false);
    const waiting = useRef<((ok: boolean) => void) | null>(null);
    const synced = useRef(false);

    const company = ctx?.companyData;
    const productsCount = (ctx?.catalogProducts?.length || 0) + (ctx?.products?.length || 0);
    const isManager = ctx?.user?.role === "Admin" || ctx?.user?.role === "Dono";
    const email = auth.currentUser?.email || "";
    const pending = company?.status === "trial" && !company?.emailVerifiedAt;

    const markVerified = useCallback(async (): Promise<boolean> => {
        const u = auth.currentUser;
        if (!u) return false;
        await reload(u).catch(() => {});
        if (!canMarkVerified(ctx?.user?.role, !!auth.currentUser?.emailVerified)) return false;
        if (!ctx?.companyData?.emailVerifiedAt) await ctx?.updateCompany?.({ emailVerifiedAt: new Date().toISOString() });
        return true;
    }, [auth, ctx]);

    // ao abrir a app: email já confirmado (ou Google) → fica registado e nunca se vê o aviso
    useEffect(() => {
        if (!pending || synced.current || !ctx?.user) return;
        synced.current = true;
        markVerified().catch(() => {});
    }, [pending, ctx?.user, markVerified]);

    // pedidos de quem cria produtos
    const needRef = useRef(false);
    needRef.current = needsEmailConfirm(company, productsCount);
    useEffect(() => {
        hostReady = true;
        const onAsk = (e: Event) => {
            const resolve = (e as CustomEvent<{ resolve: (ok: boolean) => void }>).detail.resolve;
            if (!needRef.current) return resolve(true);
            waiting.current?.(false);
            waiting.current = resolve;
            setOpen(true);
        };
        window.addEventListener(EVENT, onAsk);
        return () => { hostReady = false; window.removeEventListener(EVENT, onAsk); };
    }, []);

    const finish = (ok: boolean) => {
        const r = waiting.current;
        waiting.current = null;
        setOpen(false);
        r?.(ok);
    };

    const resend = async () => {
        const u = auth.currentUser;
        if (!u) return;
        setBusy("send");
        try {
            await sendEmailVerification(u, { url: window.location.origin + "/catalog" });
            toast({ title: "Email enviado", description: `Abra o email enviado para ${email} e toque no link.` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Não foi possível enviar", description: e?.code === "auth/too-many-requests" ? "Já enviámos há pouco. Veja a caixa de entrada (e o spam)." : "Tente outra vez daqui a pouco." });
        } finally {
            setBusy(null);
        }
    };

    const confirmed = async () => {
        setBusy("check");
        try {
            if (await markVerified()) {
                toast({ title: "Email confirmado ✅", description: "Pode continuar." });
                finish(true);
            } else {
                toast({ variant: "destructive", title: "Ainda não está confirmado", description: "Abra o link do email que enviámos e toque outra vez em \"Já confirmei\"." });
            }
        } finally {
            setBusy(null);
        }
    };

    const showBanner = pending && isManager && !bannerClosed && !auth.currentUser?.emailVerified;

    return (
        <>
            {showBanner && (
                <div className="flex items-center gap-2 border-b border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs text-sky-900 dark:text-sky-200" data-testid="email-confirm-banner">
                    <MailCheck className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">Confirme o seu email: enviámos um link para <b>{email}</b>.</span>
                    <button type="button" onClick={resend} disabled={!!busy} className="shrink-0 font-semibold underline">Reenviar</button>
                    <button type="button" aria-label="Fechar aviso" onClick={() => setBannerClosed(true)} className="shrink-0 p-1"><X className="h-3.5 w-3.5" /></button>
                </div>
            )}
            <Dialog open={open} onOpenChange={(o) => { if (!o) finish(false); }}>
                <DialogContent data-testid="email-confirm-gate">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><MailCheck className="h-5 w-5 text-primary" /> Confirme o seu email</DialogTitle>
                        <DialogDescription>
                            {isManager
                                ? <>Antes do primeiro produto, confirme que <b>{email}</b> é seu: abra o email que enviámos e toque no link. É só uma vez.</>
                                : <>Antes do primeiro produto, o responsável da conta tem de confirmar o email dele. Peça-lhe para abrir a app.</>}
                        </DialogDescription>
                    </DialogHeader>
                    {isManager && (
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={resend} disabled={!!busy}>
                                {busy === "send" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reenviar email
                            </Button>
                            <Button type="button" onClick={confirmed} disabled={!!busy}>
                                {busy === "check" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Já confirmei
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
