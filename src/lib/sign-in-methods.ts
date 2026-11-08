// Formas de entrar numa conta (Google e/ou email+senha).
// Porque é que a senha "desaparece": a Firebase guarda uma conta por email. Se alguém criou a conta com email e senha
// e NUNCA confirmou o email, ao entrar depois com o Google (que garante que o email é dele) a Firebase apaga a senha —
// para impedir que quem registou o email primeiro (talvez um impostor) continue a entrar. Com o email confirmado, ou com
// o Google ligado a partir da própria conta, as duas formas ficam.

export type SignInMethods = { google: boolean; password: boolean };

export function signInMethods(providerIds: readonly string[]): SignInMethods {
    return { google: providerIds.includes('google.com'), password: providerIds.includes('password') };
}

/** Senha que ainda pode ser apagada por uma entrada com o Google: tem senha, não tem Google e o email não está confirmado. */
export const passwordAtRisk = (m: SignInMethods, emailVerified: boolean) => m.password && !m.google && !emailVerified;

const KEY = 'msx-password-hint:';

/** Depois de entrar com o Google numa conta sem senha: avisar uma vez (por conta) que pode criar uma. */
export function shouldHintPassword(uid: string, m: SignInMethods, store: Pick<Storage, 'getItem' | 'setItem'> | null): boolean {
    if (m.password || !m.google) return false;
    try {
        if (!store || store.getItem(KEY + uid)) return false;
        store.setItem(KEY + uid, '1');
        return true;
    } catch {
        return false;
    }
}

/** Mensagens dos erros ao ligar formas de entrar. */
export function linkErrorMessage(code: string | undefined): string {
    switch (code) {
        case 'auth/credential-already-in-use':
            return 'Esta conta Google já está ligada a outro utilizador do MajorStockX.';
        case 'auth/email-already-in-use':
            return 'Este email já é usado por outra conta do MajorStockX.';
        case 'auth/provider-already-linked':
            return 'Esta forma de entrar já está ligada.';
        case 'auth/weak-password':
            return 'A senha tem de ter pelo menos 6 caracteres.';
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
            return 'Cancelado.';
        case 'auth/popup-blocked':
            return 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente outra vez.';
        case 'auth/requires-recent-login':
            return 'Por segurança, saia e entre outra vez na conta antes de fazer isto.';
        case 'auth/too-many-requests':
            return 'Muitas tentativas. Espere uns minutos e tente outra vez.';
        default:
            return 'Não foi possível concluir. Verifique a ligação e tente outra vez.';
    }
}
