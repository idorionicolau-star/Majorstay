// Quando conta uma leitura da câmara. O mesmo código só conta outra vez depois de sair da imagem: enquanto a pessoa
// mantém o artigo à frente da câmara ele é visto várias vezes por segundo e não pode entrar 2, 3, 4 vezes.
// Para juntar mais um igual, há o botão "Ler outra vez" (ou mudar a quantidade no carrinho).

/** Tempo sem ver o código para se considerar que saiu da imagem. */
export const SCAN_GONE_MS = 1200;

export function createScanGate(goneMs = SCAN_GONE_MS) {
    let current = '';
    let seenAt = -Infinity;
    return {
        /** O código foi visto agora: conta como uma leitura nova? */
        seen(code: string, now: number): boolean {
            const fresh = code !== current || now - seenAt > goneMs;
            current = code;
            seenAt = now;
            return fresh;
        },
        reset() { current = ''; seenAt = -Infinity; },
    };
}

/** As mensagens de leitura bem-sucedida começam por "✓". */
export const isGoodRead = (msg: string | void | undefined): msg is string => !!msg && msg.startsWith('✓');

/** O que `onScan` devolve quando o código não é de nenhum produto: o leitor fica aberto e pede para tentar de novo. */
export const UNKNOWN_CODE = '?desconhecido';
