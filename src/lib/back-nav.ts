// Botão "voltar" do cabeçalho: aparece em todas as sub-páginas (as do menu não têm "anterior" — o menu é a navegação).
// Puro, para ser testado.

/** Páginas principais (menu e barra de baixo): sem seta. */
export const TOP_LEVEL_PATHS = [
    '/dashboard', '/pos', '/sales', '/documents', '/orders', '/inventory', '/inventory/history', '/inventory/perdas', '/production',
    '/raw-materials', '/catalog', '/customers', '/users', '/finance', '/reports', '/settings', '/billing',
    '/calendar', '/admin/subscriptions', '/admin/errors',
] as const;

/** Fora da app (entrar, registar, termos): sem seta. */
const NO_BACK = ['/', '/login', '/register', '/termos', '/privacidade'];

const clean = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

/**
 * A página "mãe" de uma sub-página (para onde voltar quando não há página anterior na app), ou null se a página é
 * principal. /inventory/abc/edit → /inventory; /raw-materials/recipes/x/edit → /raw-materials; /sales/carga → /sales.
 */
export function parentPath(pathname: string): string | null {
    const path = clean(pathname.split('?')[0] || '/');
    if (NO_BACK.includes(path) || (TOP_LEVEL_PATHS as readonly string[]).includes(path)) return null;
    const segs = path.split('/').filter(Boolean);
    for (let i = segs.length - 1; i > 0; i--) {
        const up = '/' + segs.slice(0, i).join('/');
        if ((TOP_LEVEL_PATHS as readonly string[]).includes(up)) return up;
    }
    return '/dashboard';
}
