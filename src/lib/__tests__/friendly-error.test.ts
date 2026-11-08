import { describe, expect, it } from 'vitest';
import { friendlyError } from '../friendly-error';

describe('friendlyError', () => {
    it('erros de permissão das regras viram uma frase simples', () => {
        const e = Object.assign(new Error("evaluation error at L241:42 for 'update' @ L241"), { code: 'permission-denied' });
        expect(friendlyError(e, 'editar Inventário e Matéria-Prima')).toBe('Sem permissão para isto. Peça ao responsável da empresa para lhe dar permissão de editar Inventário e Matéria-Prima (em Funcionários).');
        expect(friendlyError(new Error('Missing or insufficient permissions.'))).toBe('Sem permissão para isto. Peça ao responsável da empresa.');
    });
    it('os outros erros ficam como estão', () => {
        expect(friendlyError(new Error('Stock insuficiente de Areia.'))).toBe('Stock insuficiente de Areia.');
    });
});
