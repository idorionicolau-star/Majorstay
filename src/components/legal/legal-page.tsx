import Link from "next/link";
import { SUPPORT } from "@/lib/support";

/** Moldura simples das páginas legais (abrem com ou sem conta). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10 text-foreground">
            <Link href="/login" className="text-sm text-primary underline">← MajorStockX</Link>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Última actualização: {updated}</p>
            <div className="mt-6 space-y-5 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
                {children}
            </div>
            <p className="mt-10 border-t pt-4 text-sm text-muted-foreground">
                Dúvidas: WhatsApp <a className="underline" href={`https://wa.me/${SUPPORT.whatsapp}`}>{SUPPORT.whatsappDisplay}</a> (só mensagens) ou{" "}
                <a className="underline" href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a>.
            </p>
        </main>
    );
}
