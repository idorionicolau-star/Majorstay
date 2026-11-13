import type { ModulePermission, PermissionLevel } from './types';

/**
 * Perfis de funcionário: em vez de marcar módulo a módulo, escolhe-se um perfil e as permissões preenchem-se.
 * Por baixo continua o mesmo modelo (role + permissions), por isso as regras e as rotas não mudam.
 */
export type ProfileId = 'gerente' | 'dono' | 'recepcionista' | 'cozinha' | 'personalizado';
type Role = 'Admin' | 'Employee' | 'Dono';
type Perms = Partial<Record<ModulePermission, PermissionLevel>>;

export const ALL_MODULES: ModulePermission[] = [
  'dashboard', 'diagnostico', 'rooms', 'inventory', 'sales', 'customers', 'production', 'raw-materials',
  'finance', 'orders', 'reports', 'users', 'settings',
];

const fill = (level: PermissionLevel, over: Perms = {}): Perms =>
  ALL_MODULES.reduce((acc, m) => ({ ...acc, [m]: over[m] ?? level }), {} as Perms);

export const PROFILES: { id: ProfileId; label: string; description: string; role: Role; permissions?: Perms }[] = [
  {
    id: 'recepcionista',
    label: 'Recepcionista',
    description: 'Quartos, check-in e check-out, pedidos e vendas do bar, e o seu turno. Não vê finanças, relatórios nem definições.',
    role: 'Employee',
    permissions: fill('none', { dashboard: 'read', rooms: 'write', sales: 'write', customers: 'write', inventory: 'read' }),
  },
  {
    id: 'cozinha',
    label: 'Cozinha / Bar',
    description: 'Stock e vendas do bar e da cozinha, e vê os pedidos dos quartos. Não faz check-in nem vê finanças.',
    role: 'Employee',
    permissions: fill('none', { dashboard: 'read', inventory: 'write', sales: 'write', rooms: 'read', 'raw-materials': 'write', production: 'write' }),
  },
  {
    id: 'gerente',
    label: 'Gerente',
    description: 'Tudo: preços dos quartos, funcionários, definições, Controlo e os turnos de todos.',
    role: 'Admin',
  },
  {
    id: 'dono',
    label: 'Dono (só vê)',
    description: 'Vê tudo (quartos, caixa, turnos, Controlo, relatórios), mas não altera nada.',
    role: 'Dono',
  },
  {
    id: 'personalizado',
    label: 'Personalizado',
    description: 'Escolher módulo a módulo o que a pessoa pode ver e editar.',
    role: 'Employee',
  },
];

export function getProfile(id: ProfileId) {
  return PROFILES.find((p) => p.id === id)!;
}

/** Permissões de um perfil (gerente: tudo editar; dono: tudo ver; personalizado: só o painel). */
export function permissionsForProfile(id: ProfileId): Perms {
  if (id === 'gerente') return fill('write');
  if (id === 'dono') return fill('read');
  const p = getProfile(id).permissions;
  return p ? { ...p } : fill('none', { dashboard: 'read', diagnostico: 'read' });
}

/** Nome do perfil para mostrar nas listas. */
export function profileLabel(role: Role | string | undefined, permissions: Perms | undefined): string {
  return getProfile(profileOf(role, permissions)).label;
}

/** O perfil que melhor descreve um funcionário já existente (igual a um perfil, senão personalizado). */
export function profileOf(role: Role | string | undefined, permissions: Perms | undefined): ProfileId {
  if (role === 'Admin') return 'gerente';
  if (role === 'Dono') return 'dono';
  const have = permissions || {};
  for (const p of PROFILES) {
    if (!p.permissions) continue;
    if (ALL_MODULES.every((m) => (have[m] ?? 'none') === (p.permissions![m] ?? 'none'))) return p.id;
  }
  return 'personalizado';
}
