'use client';

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/report-error";
import { SUPPORT, supportMessage, whatsappLink } from "@/lib/support";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Application error:", error);
        reportError(error, "react");
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
            <div className="max-w-md text-center space-y-4">
                <div className="mb-4 flex justify-center">
                    <div className="rounded-full bg-destructive/10 p-4">
                        <AlertTriangle className="h-10 w-10 text-destructive" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold">Algo correu mal!</h2>

                <p className="text-muted-foreground">
                    Ocorreu um erro inesperado. A nossa equipa já foi notificada automaticamente e está a trabalhar para resolver o problema.
                </p>

                {process.env.NODE_ENV === 'development' && (
                    <details className="text-left text-sm bg-muted p-4 rounded-lg">
                        <summary className="cursor-pointer font-semibold mb-2">Detalhes do erro (dev only)</summary>
                        <pre className="overflow-auto text-xs">
                            {error.message}
                            {'\n\n'}
                            {error.stack}
                        </pre>
                    </details>
                )}

                <div className="flex gap-3 justify-center pt-4">
                    <Button onClick={reset} variant="default">
                        Tentar novamente
                    </Button>
                    <Button onClick={() => window.location.href = '/'} variant="outline">
                        Ir para o início
                    </Button>
                </div>
                <p className="pt-2 text-sm text-muted-foreground">
                    Continua a acontecer?{" "}
                    <a
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={whatsappLink(supportMessage({ page: typeof window !== "undefined" ? window.location.pathname : null, detail: error.digest ? `${error.message} (${error.digest})` : error.message }))}
                    >
                        Envie-nos uma captura de ecrã pelo WhatsApp ({SUPPORT.whatsappDisplay})
                    </a>
                </p>
            </div>
        </div>
    );
}
