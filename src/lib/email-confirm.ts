// Antes do primeiro produto de uma conta nova, o responsável confirma que o email é dele: contas com emails falsos não
// chegam a montar a loja (nem, por isso, a vender). É um momento calmo — ninguém está à espera, ao contrário de uma venda.
// Quem entra com o Google já vem confirmado. Puro, para ser testado.

type CompanyLike = { status?: string; emailVerifiedAt?: string | null } | null | undefined;

/** Precisa de confirmar o email antes de criar produtos? Só numa conta em teste, ainda sem produtos e sem a confirmação. */
export function needsEmailConfirm(company: CompanyLike, productsCount: number): boolean {
    if (!company || company.emailVerifiedAt) return false;
    if (company.status !== 'trial') return false; // conta paga (ou antiga) é real
    return productsCount === 0;
}

/** Pode registar a confirmação na empresa: é Dono/Admin e o email dele está confirmado. */
export const canMarkVerified = (role: string | undefined, emailVerified: boolean) => emailVerified && (role === 'Admin' || role === 'Dono');
