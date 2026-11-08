'use client';

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";
import { SUPPORT, supportMessage, whatsappLink } from "@/lib/support";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global application error:", error);
        reportError(error, "global");
    }, [error]);

    return (
        <html>
            <body>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
                    <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Algo correu mal!</h2>

                        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                            Pedimos desculpa pelo inconveniente. A nossa equipa já foi notificada automaticamente e está a trabalhar para resolver o problema.
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                onClick={reset}
                                style={{ padding: '0.5rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                            >
                                Tentar novamente
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                style={{ padding: '0.5rem 1.5rem', backgroundColor: 'transparent', border: '1px solid #ccc', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                            >
                                Ir para o início
                            </button>
                        </div>
                        <p style={{ color: '#666', marginTop: '1.25rem', fontSize: '0.875rem' }}>
                            Continua a acontecer?{' '}
                            <a
                                style={{ color: '#3b82f6', fontWeight: 600 }}
                                target="_blank"
                                rel="noopener noreferrer"
                                href={whatsappLink(supportMessage({ page: typeof window !== 'undefined' ? window.location.pathname : null, detail: error.message }))}
                            >
                                Envie-nos uma captura de ecrã pelo WhatsApp ({SUPPORT.whatsappDisplay})
                            </a>
                        </p>
                    </div>
                </div>
            </body>
        </html>
    );
}
