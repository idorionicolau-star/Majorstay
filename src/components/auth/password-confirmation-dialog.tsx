"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getFirebaseAuth } from "@/firebase/provider";
import {
    EmailAuthProvider,
    reauthenticateWithCredential,
    User,
} from "firebase/auth";

interface PasswordConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
    title?: string;
    description?: string;
    confirmLabel?: string;
}

export function PasswordConfirmationDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "Confirmação de Segurança",
    description = "Por favor, introduza a sua palavra-passe para confirmar esta ação crítica.",
    confirmLabel = "Confirmar",
}: PasswordConfirmationDialogProps) {
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const auth = getFirebaseAuth();

    const handleConfirm = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!password.trim()) return;

        setIsLoading(true);

        try {
            const user = auth.currentUser;
            if (!user || !user.email) {
                throw new Error("Utilizador não autenticado.");
            }

            // Re-authenticate
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);

            // If successful, proceed with action
            await onConfirm();
            onOpenChange(false);
            setPassword("");
        } catch (error: any) {
            console.error("Re-auth error:", error);
            let message = "Palavra-passe incorreta ou erro de autenticação.";
            if (error.code === 'auth/wrong-password') {
                message = "Palavra-passe incorreta.";
            } else if (error.code === 'auth/too-many-requests') {
                message = "Muitas tentativas falhadas. Tente novamente mais tarde.";
            }
            toast({
                variant: "destructive",
                title: "Erro de Confirmação",
                description: message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <form onSubmit={handleConfirm} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Palavra-passe Atual</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Sua palavra-passe de acesso"
                            disabled={isLoading}
                            autoFocus
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading} onClick={() => setPassword("")}>Cancelar</AlertDialogCancel>
                        <Button type="submit" disabled={!password || isLoading} variant="destructive">
                            {isLoading ? "A verificar..." : confirmLabel}
                        </Button>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
