import { describe, it, expect } from 'vitest';
import { permissionsForProfile, profileOf, PROFILES } from '../role-profiles';

describe('perfis de funcionário', () => {
  it('o recepcionista faz quartos e vendas, mas não vê finanças, relatórios, definições nem funcionários', () => {
    const p = permissionsForProfile('recepcionista');
    expect(p.rooms).toBe('write');
    expect(p.sales).toBe('write');
    for (const m of ['finance', 'reports', 'settings', 'users'] as const) expect(p[m]).toBe('none');
  });

  it('gerente edita tudo e dono só vê', () => {
    expect(Object.values(permissionsForProfile('gerente')).every((v) => v === 'write')).toBe(true);
    expect(Object.values(permissionsForProfile('dono')).every((v) => v === 'read')).toBe(true);
  });

  it('reconhece o perfil de quem já existe', () => {
    expect(profileOf('Admin', {})).toBe('gerente');
    expect(profileOf('Dono', {})).toBe('dono');
    expect(profileOf('Employee', permissionsForProfile('recepcionista'))).toBe('recepcionista');
    expect(profileOf('Employee', permissionsForProfile('cozinha'))).toBe('cozinha');
  });

  it('permissões à medida ficam como personalizado', () => {
    expect(profileOf('Employee', { rooms: 'write', finance: 'read' })).toBe('personalizado');
    expect(profileOf('Employee', undefined)).toBe('personalizado');
  });

  it('cada perfil tem descrição', () => {
    for (const p of PROFILES) expect(p.description.length).toBeGreaterThan(10);
  });
});
