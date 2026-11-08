// Quem vê a área de administração (/admin/subscriptions: empresas, vendas da EscalePay, ZumboPay).
// No servidor, as rotas de admin exigem também users/{uid}.superAdmin = true no Firestore.
export const SUPER_ADMIN_EMAILS = ['digitalwarriorguru@gmail.com', 'idorionicolau@gmail.com'];

export const isSuperAdminEmail = (email?: string | null) => !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim());
