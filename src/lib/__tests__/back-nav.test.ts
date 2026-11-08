import { describe, expect, it } from 'vitest';
import { parentPath } from '../back-nav';

describe('parentPath (seta "voltar" do cabeçalho)', () => {
    it('páginas principais e de fora da app não têm seta', () => {
        for (const p of ['/dashboard', '/inventory', '/inventory/history', '/inventory/perdas', '/production', '/sales', '/pos', '/settings', '/login', '/', '/termos', '/inventory/']) {
            expect(parentPath(p)).toBeNull();
        }
    });
    it('sub-páginas voltam à mãe', () => {
        expect(parentPath('/sales/carga')).toBe('/sales');
        expect(parentPath('/inventory/quick')).toBe('/inventory');
        expect(parentPath('/inventory/abc123/edit')).toBe('/inventory');
        expect(parentPath('/raw-materials/recipes/x/edit')).toBe('/raw-materials');
        expect(parentPath('/production/new?planear=1')).toBe('/production');
        expect(parentPath('/reports/inventory-impact')).toBe('/reports');
        expect(parentPath('/documents/xyz')).toBe('/documents');
    });
    it('desconhecida → painel', () => {
        expect(parentPath('/qualquer/coisa')).toBe('/dashboard');
    });
});
