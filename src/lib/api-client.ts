/** Tempo máximo de espera por uma rota da app: sem resposta, avisa em vez de ficar a rodar para sempre. */
const TIMEOUT_MS = 30_000;

/** Chama uma rota da app com o token da sessão e devolve o JSON (ou lança Error com a mensagem do servidor). */
export async function authedFetch(url: string, method: string, body: Record<string, unknown>) {
    const { getAuth } = await import('firebase/auth');
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) throw new Error('Sessão expirada. Entre de novo.');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Sem internet. Verifique a ligação e tente de novo.');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
        res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
    } catch (e: any) {
        throw new Error(e?.name === 'AbortError'
            ? 'O servidor está a demorar muito a responder. Verifique a internet e tente de novo — nada foi perdido.'
            : 'Não foi possível ligar ao servidor. Verifique a internet e tente de novo.');
    } finally {
        clearTimeout(timer);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
    return json;
}
