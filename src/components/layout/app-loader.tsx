// Ecrã "A carregar aplicação…": uma roda a girar e, por baixo, a barra de progresso do arranque (footer).
export function AppLoader({ label = "A carregar aplicação...", footer }: { label?: string; footer?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-4" role="status" aria-label={label}>
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden />
            {footer ?? <p className="text-sm text-muted-foreground">{label}</p>}
        </div>
    );
}
