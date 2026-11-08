// Contas simples nos campos de quantidade: "120+35+48", "12x8+5", "2,5*4", "(10+2)*3".
// Sem eval: um analisador pequeno (somar, subtrair, multiplicar, dividir, parênteses). Vírgula ou ponto decimal.

/** O texto tem uma conta (e não só um número)? */
export const isExpression = (raw: string) => /\d\s*[-+*/x×÷]\s*[\d(]/i.test(String(raw).trim());

/** Resultado da conta, ou NaN se não for uma conta válida. Um número simples também conta. */
export function evalQty(raw: string): number {
    const s = String(raw ?? "").toLowerCase().replace(/[×x]/g, "*").replace(/÷/g, "/").replace(/\s+/g, "").replace(/,/g, ".");
    if (!s) return NaN;
    let i = 0;
    const peek = () => s[i];
    const num = (): number => {
        if (peek() === "(") {
            i++;
            const v = expr();
            if (peek() !== ")") return NaN;
            i++;
            return v;
        }
        if (peek() === "-") { i++; return -num(); }
        if (peek() === "+") { i++; return num(); }
        const m = /^\d+(?:\.\d+)?|^\.\d+/.exec(s.slice(i));
        if (!m) return NaN;
        i += m[0].length;
        return parseFloat(m[0]);
    };
    const term = (): number => {
        let v = num();
        while (peek() === "*" || peek() === "/") {
            const op = s[i++];
            const r = num();
            v = op === "*" ? v * r : r === 0 ? NaN : v / r;
        }
        return v;
    };
    const expr = (): number => {
        let v = term();
        while (peek() === "+" || peek() === "-") {
            const op = s[i++];
            const r = term();
            v = op === "+" ? v + r : v - r;
        }
        return v;
    };
    const v = expr();
    if (i !== s.length || !Number.isFinite(v)) return NaN;
    // sem lixo de vírgula flutuante (0.1+0.2)
    return Math.round(v * 1e6) / 1e6;
}

/** "120+35+48" → "120 + 35 + 48" (para mostrar as parcelas). */
export const prettyExpression = (raw: string) => String(raw).replace(/\s+/g, "").replace(/[*x]/gi, "×").replace(/([-+×/÷])/g, " $1 ").replace(/\s+/g, " ").trim();
