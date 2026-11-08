// Contactos do suporte da MajorStockX e a mensagem já preenchida — num só sítio.
// O número é só para WhatsApp (mensagens, não chamadas). O que mais ajuda: uma ou mais capturas de ecrã
// e uma descrição breve do problema.

export const SUPPORT = {
    /** formato internacional para o wa.me (Moçambique +258) */
    whatsapp: "258842333717",
    whatsappDisplay: "84 233 3717",
    email: "idorionicolau@gmail.com",
} as const;

export type SupportContext = {
    company?: string | null;
    user?: string | null;
    /** a página onde a pessoa estava (ex.: /inventory/quick) */
    page?: string | null;
    /** o que a pessoa escreveu sobre o problema */
    problem?: string | null;
    /** texto técnico (ex.: mensagem de erro da página "Algo correu mal") */
    detail?: string | null;
};

/** A mensagem que vai para o WhatsApp ou para o email, com o que ajuda a resolver mais depressa. */
export function supportMessage(ctx: SupportContext): string {
    const lines = ["Olá, preciso de ajuda com a MajorStockX."];
    if (ctx.company) lines.push(`Empresa: ${ctx.company}`);
    if (ctx.user) lines.push(`Utilizador: ${ctx.user}`);
    if (ctx.page) lines.push(`Página: ${ctx.page}`);
    if (ctx.detail) lines.push(`Erro: ${ctx.detail.slice(0, 300)}`);
    lines.push("");
    lines.push(`O problema: ${ctx.problem?.trim() || ""}`);
    lines.push("");
    lines.push("(Envio a seguir uma ou mais capturas de ecrã.)");
    return lines.join("\n");
}

export const whatsappLink = (text?: string) =>
    `https://wa.me/${SUPPORT.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const emailLink = (subject: string, body?: string) =>
    `mailto:${SUPPORT.email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;
