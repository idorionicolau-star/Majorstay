// Envia erros de ecrã para /api/log-error (sem bibliotecas externas nem chaves).
import { appFrames, formatContext, snippetAt } from '@/lib/error-context';

let sent = 0;
const seen = new Set<string>();

/** Versão publicada (Vercel), para saber em que versão do código o erro aconteceu. */
const VERSION = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);

/** O código à volta de cada linha da pilha (até 3 ficheiros, no máximo 2,5 s): diz de que componente vem o erro. */
async function codeContext(stack: string | undefined): Promise<string> {
    const frames = appFrames(stack, location.origin);
    if (!frames.length) return '';
    const files = [...new Set(frames.map((f) => f.file))].slice(0, 3);
    const texts = new Map<string, string>();
    await Promise.race([
        Promise.all(files.map(async (f) => {
            const r = await fetch(f, { cache: 'force-cache' });
            if (r.ok) texts.set(f, await r.text());
        })).catch(() => {}),
        new Promise((done) => setTimeout(done, 2500)),
    ]);
    return formatContext(frames.filter((f) => texts.has(f.file)).map((frame) => ({ frame, snippet: snippetAt(texts.get(frame.file)!, frame.line, frame.col) })));
}

export function reportError(error: unknown, source: string) {
    try {
        if (typeof window === 'undefined' || sent >= 10) return;
        const e = error as { message?: string; stack?: string } | undefined;
        const message = e?.message || String(error);
        if (!message || /ResizeObserver loop|Script error\.?$/i.test(message)) return;
        const key = `${source}|${message}`;
        if (seen.has(key)) return;
        seen.add(key);
        sent++;
        const url = location.pathname;
        codeContext(e?.stack).catch(() => '').then((context) => {
            const body = JSON.stringify({ message, stack: e?.stack, source, url, context, version: VERSION });
            fetch('/api/log-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
        });
    } catch { /* o registo nunca pode causar outro erro */ }
}
