// Registo em curso: a conta de acesso já existe mas a empresa ainda está a ser gravada. Quem abre a sessão
// (onAuthStateChanged) espera por isto em vez de concluir "não tem empresa" e fazer logout a meio do registo —
// numa rede lenta isso deixava a conta criada sem empresa ("email já está a ser utilizado" ao tentar de novo).
let pending: Promise<void> | null = null;
let finish: (() => void) | null = null;

export function beginRegistration() {
    if (!pending) pending = new Promise<void>((resolve) => { finish = resolve; });
}

export function endRegistration() {
    finish?.();
    pending = null;
    finish = null;
}

/** A promessa do registo em curso (ou null). */
export const registrationPending = () => pending;
