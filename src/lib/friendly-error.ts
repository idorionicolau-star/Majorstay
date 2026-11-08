// Mensagens de erro do Firebase em português simples (as das regras de acesso são técnicas e ilegíveis).

const isPermission = (e: unknown) => {
    const code = (e as { code?: string })?.code || "";
    const msg = e instanceof Error ? e.message : String(e ?? "");
    return code === "permission-denied" || /permission[-_ ]denied|insufficient permissions|evaluation error/i.test(msg);
};

/** O texto a mostrar à pessoa. `permissionHint` diz que permissão pedir (ex.: "editar Inventário e Matéria-Prima"). */
export function friendlyError(e: unknown, permissionHint?: string): string {
    if (isPermission(e)) {
        return `Sem permissão para isto.${permissionHint ? ` Peça ao responsável da empresa para lhe dar permissão de ${permissionHint} (em Funcionários).` : " Peça ao responsável da empresa."}`;
    }
    return e instanceof Error ? e.message : "Erro desconhecido. Tente de novo.";
}
