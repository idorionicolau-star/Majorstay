"use client";

// "Formas de entrar" no Perfil: mostra se a conta entra com o Google e/ou com email e senha, e deixa juntar a que falta.
// Com as duas ligadas, entrar por uma nunca apaga a outra (ver lib/sign-in-methods.ts).
import { useCallback, useEffect, useState } from "react";
import {
    EmailAuthProvider, GoogleAuthProvider, getAuth, linkWithCredential, linkWithPopup, onAuthStateChanged, reauthenticateWithPopup,
    reload, sendEmailVerification, updatePassword, type User,
} from "firebase/auth";
import { CheckCircle2, KeyRound, Loader2, MailWarning } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { linkErrorMessage, passwordAtRisk, signInMethods, type SignInMethods } from "@/lib/sign-in-methods";

const read = (u: User | null): SignInMethods => signInMethods(u?.providerData.map((p) => p.providerId) ?? []);

export function SignInMethodsCard() {
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [methods, setMethods] = useState<SignInMethods>({ google: false, password: false });
    const [verified, setVerified] = useState(true);
    const [busy, setBusy] = useState<null | "google" | "password" | "verify">(null);
    const [open, setOpen] = useState(false);
    const [pass, setPass] = useState("");
    const [confirm, setConfirm] = useState("");

    const refresh = useCallback(async () => {
        const u = getAuth().currentUser;
        if (u) await reload(u).catch(() => {}); // o email pode ter sido confirmado noutro separador
        setUser(u);
        setMethods(read(u));
        setVerified(!!u?.emailVerified);
    }, []);

    // ao abrir a página a sessão ainda pode estar a ser recuperada: espera por ela
    useEffect(() => onAuthStateChanged(getAuth(), () => { refresh(); }), [refresh]);

    const fail = (e: any) => {
        if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") return;
        toast({ variant: "destructive", title: "Não foi possível", description: linkErrorMessage(e?.code) });
    };

    const linkGoogle = async () => {
        if (!user) return;
        setBusy("google");
        try {
            await linkWithPopup(user, new GoogleAuthProvider());
            await refresh();
            toast({ title: "Google ligado", description: "Agora pode entrar com o Google ou com email e senha." });
        } catch (e) {
            fail(e);
        } finally {
            setBusy(null);
        }
    };

    const createPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.email) return;
        if (pass.length < 6) return toast({ variant: "destructive", title: "Senha curta", description: "Use pelo menos 6 caracteres." });
        if (pass !== confirm) return toast({ variant: "destructive", title: "As senhas não coincidem" });
        setBusy("password");
        // ligar a senha à conta; se a Firebase recusar por o email já ser desta mesma conta, define-a diretamente
        const addPassword = () => linkWithCredential(user, EmailAuthProvider.credential(user.email!, pass))
            .catch((err) => { if (err?.code === "auth/email-already-in-use") return updatePassword(user, pass); throw err; });
        try {
            try {
                await addPassword();
            } catch (err: any) {
                // entrou há muito tempo: confirma com o Google e tenta outra vez
                if (err?.code !== "auth/requires-recent-login" || !methods.google) throw err;
                await reauthenticateWithPopup(user, new GoogleAuthProvider());
                await addPassword();
            }
            await refresh();
            setOpen(false);
            setPass("");
            setConfirm("");
            toast({ title: "Senha criada", description: `Já pode entrar com ${user.email} e esta senha, ou com o Google.` });
        } catch (err) {
            fail(err);
        } finally {
            setBusy(null);
        }
    };

    const sendVerification = async () => {
        if (!user) return;
        setBusy("verify");
        try {
            await sendEmailVerification(user, { url: window.location.origin + "/settings" });
            toast({ title: "Email enviado", description: `Abra o email enviado para ${user.email} e toque no link de confirmação.` });
        } catch (e) {
            fail(e);
        } finally {
            setBusy(null);
        }
    };

    if (!user?.email) return null;

    const row = (label: string, on: boolean, action: React.ReactNode) => (
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div className="flex items-center gap-2 min-w-0">
                {on ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground">{on ? "Ligado" : "Não ligado"}</p>
                </div>
            </div>
            {!on && action}
        </div>
    );

    return (
        <Card className="glass-card" id="formas-de-entrar">
            <CardHeader>
                <CardTitle>Formas de entrar</CardTitle>
                <CardDescription>Com as duas ligadas, pode entrar por qualquer uma — e nenhuma apaga a outra.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {row("Google", methods.google,
                    <Button size="sm" variant="outline" onClick={linkGoogle} disabled={!!busy}>
                        {busy === "google" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ligar ao Google
                    </Button>)}
                {row(`Email e senha (${user.email})`, methods.password,
                    <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!!busy}>Criar senha</Button>)}

                {passwordAtRisk(methods, verified) && (
                    <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                        <p className="flex gap-2">
                            <MailWarning className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>O seu email ainda não está confirmado. Se entrar com o Google antes de o confirmar, a Google fica no lugar da senha. Ligue o Google acima ou confirme o email.</span>
                        </p>
                        <Button size="sm" variant="outline" className="self-start" onClick={sendVerification} disabled={!!busy}>
                            {busy === "verify" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar email de confirmação
                        </Button>
                    </div>
                )}
            </CardContent>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Criar senha</DialogTitle>
                        <DialogDescription>Para entrar também com {user.email} e senha.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={createPassword} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="link-pass">Senha</Label>
                            <Input id="link-pass" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="link-confirm">Repetir a senha</Label>
                            <Input id="link-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy === "password"}>Cancelar</Button>
                            <Button type="submit" disabled={busy === "password"}>
                                {busy === "password" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar senha
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
