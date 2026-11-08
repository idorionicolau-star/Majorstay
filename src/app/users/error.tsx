'use client';

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function UsersError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Users page error:", error);
    }, [error]);

    return (
        <Card className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-destructive/5 border-destructive/20 max-w-2xl mx-auto my-8">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
            </div>

            <h2 className="text-xl font-bold text-destructive mb-2">Erro na Página de Funcionários</h2>

            <p className="text-muted-foreground mb-6">
                Não foi possível carregar ou exibir a lista de funcionários. Isto pode dever-se a uma falha na ligação ou a um erro inesperado nos dados.
            </p>

            <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg text-left mb-6 w-full max-h-40 overflow-auto border border-destructive/10">
                <p className="text-xs font-mono text-destructive tracking-tight">
                    {error.message || "Erro desconhecido"}
                </p>
                {error.stack && (
                    <pre className="text-[10px] mt-2 opacity-50 font-mono">
                        {error.stack.split('\n').slice(0, 3).join('\n')}
                    </pre>
                )}
            </div>

            <div className="flex gap-3">
                <Button onClick={reset} variant="destructive" className="gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Tentar Novamente
                </Button>
                <Button onClick={() => window.location.href = '/dashboard'} variant="outline">
                    Ir para o Dashboard
                </Button>
            </div>
        </Card>
    );
}
