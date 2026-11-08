// Para saber de que componente vem um erro do site publicado (código minificado, sem nomes): guarda-se, junto do erro,
// um pedaço do código à volta de cada linha da pilha. Esses pedaços têm textos legíveis ("A carregar aplicação…",
// nomes de campos) que dizem logo qual é o componente. Puro, para ser testado.

export type StackFrame = { file: string; line: number; col: number };

/** As linhas da pilha que apontam para ficheiros do próprio site (/_next/static/…), sem repetições. */
export function appFrames(stack: string | undefined, origin: string, max = 6): StackFrame[] {
    if (!stack) return [];
    const out: StackFrame[] = [];
    const seen = new Set<string>();
    const re = /(https?:\/\/[^\s()]+?\/_next\/static\/[^\s():]+\.js):(\d+):(\d+)/g;
    for (const m of stack.matchAll(re)) {
        if (!m[1].startsWith(origin)) continue;
        const f = { file: m[1], line: Number(m[2]), col: Number(m[3]) };
        const key = `${f.file}:${f.line}:${f.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(f);
        if (out.length >= max) break;
    }
    return out;
}

/** O código à volta de linha:coluna (as colunas contam a partir de 1). */
export function snippetAt(source: string, line: number, col: number, before = 120, after = 220): string {
    const text = source.split('\n')[line - 1] ?? '';
    const at = Math.max(0, col - 1);
    return text.slice(Math.max(0, at - before), at) + '⟦' + text.slice(at, at + after);
}

/** Junta tudo num texto curto: "ficheiro:linha:coluna" e o pedaço de código de cada linha da pilha. */
export function formatContext(parts: { frame: StackFrame; snippet: string }[], limit = 3500): string {
    let out = '';
    for (const { frame, snippet } of parts) {
        const name = frame.file.split('/').pop();
        const block = `# ${name}:${frame.line}:${frame.col}\n${snippet}\n\n`;
        if (out.length + block.length > limit) break;
        out += block;
    }
    return out.trim();
}
