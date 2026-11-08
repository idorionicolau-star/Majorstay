// Ao recarregar com a sessão aberta, a app ainda não sabe quem é (confirmar a sessão demora 0,5 a 3 s). Guarda-se
// aqui o que o menu mostrava, para a moldura (menu, cabeçalho, barra de baixo) aparecer logo igual e só o conteúdo
// esperar. É só aparência: cada página continua a confirmar as permissões. Sai ao terminar a sessão.
// Sem React aqui: o layout do servidor usa o RELOAD_GATE (o hook está em hooks/use-nav-hint.ts).
export const NAV_HINT_KEY = "msx-nav-hint";

export type NavHintItem = { title: string; id: string; href: string; locked?: boolean };
export type NavHint = { items: NavHintItem[]; simple: boolean; name?: string; email?: string; photo?: string };

export function parseNavHint(raw: string | null): NavHint | null {
    if (!raw) return null;
    try {
        const v = JSON.parse(raw);
        if (!v || !Array.isArray(v.items)) return null;
        const items = v.items.filter((i: unknown): i is NavHintItem => {
            const o = i as NavHintItem;
            return !!o && typeof o.title === "string" && typeof o.id === "string" && typeof o.href === "string" && o.href.startsWith("/");
        });
        return {
            items,
            simple: v.simple === true,
            name: typeof v.name === "string" ? v.name : undefined,
            email: typeof v.email === "string" ? v.email : undefined,
            photo: typeof v.photo === "string" && /^https:\/\//.test(v.photo) ? v.photo : undefined,
        };
    } catch {
        return null;
    }
}

const read = () => { try { return localStorage.getItem(NAV_HINT_KEY); } catch { return null; } };

let cachedRaw: string | null = null;
let cached: NavHint | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** O menu guardado da última vez (o mesmo objecto enquanto não muda). */
export function getNavHint(): NavHint | null {
    const raw = read();
    if (raw !== cachedRaw) { cachedRaw = raw; cached = parseNavHint(raw); }
    return cached;
}

export function subscribeNavHint(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
}

/** Guarda o menu actual (só escreve se mudou). */
export function saveNavHint(hint: NavHint) {
    const raw = JSON.stringify(hint);
    if (raw === read()) return;
    try { localStorage.setItem(NAV_HINT_KEY, raw); } catch { /* sem espaço ou bloqueado: recarrega como antes */ }
    notify();
}

/** Sessão terminada: a próxima abertura volta a ser em ecrã cheio. */
export function clearNavHint() {
    try {
        if (read() === null) return;
        localStorage.removeItem(NAV_HINT_KEY);
        const html = document.documentElement;
        delete html.dataset.reload;
        html.style.removeProperty("--msx-initials");
        html.style.removeProperty("--msx-avatar-photo");
    } catch { /* ignore */ }
    notify();
}

/** As iniciais do avatar: "Idório Nicolau" → "IN", "Admin" → "AD". */
export function initialsOf(name?: string) {
    const names = (name || "").trim().split(/\s+/);
    const first = names[0] || "", last = names[names.length - 1] || "";
    return (names.length > 1 && first && last ? first[0] + last[0] : first.slice(0, 2)).toUpperCase();
}

/**
 * Antes da primeira pintura: com sessão guardada, marca o <html> para a recarga mostrar a moldura e não o ecrã cheio,
 * e põe as iniciais (e a foto) do avatar em variáveis CSS, para o círculo do cabeçalho não aparecer vazio enquanto a
 * app arranca. As iniciais calculam-se como em `initialsOf`.
 */
export const RELOAD_GATE = `try{var h=localStorage.getItem('${NAV_HINT_KEY}');if(h){var d=document.documentElement;d.dataset.reload='1';var v=JSON.parse(h),n=String(v.name||'').trim().split(/\\s+/),f=n[0]||'',l=n[n.length-1]||'',i=(n.length>1&&f&&l?f[0]+l[0]:f.slice(0,2)).toUpperCase();if(typeof v.photo==='string'&&/^https:\\/\\//.test(v.photo))d.style.setProperty('--msx-avatar-photo','url('+JSON.stringify(v.photo)+')');else if(i)d.style.setProperty('--msx-initials',JSON.stringify(i))}}catch(e){}`;
