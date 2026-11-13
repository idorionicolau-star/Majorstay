
import type { NavItem, NavGroup, Order, Sale, Production, AppNotification, Product, InitialCatalog, ModulePermission } from './types';
import {
  LayoutDashboard,
  BedDouble,
  Box,
  ShoppingCart,
  Settings,
  Users,
  FileText,
  Zap,
  CreditCard,
  Wine,
  Utensils,
} from 'lucide-react';

export const mainNavItems: NavItem[] = [
  // Início
  // o Diagnóstico (a análise completa) abre-se do Painel
  { title: 'Dashboard', href: '/dashboard', id: 'dashboard', icon: LayoutDashboard, group: 'inicio', also: ['/diagnostico'] },
  // Quartos: o quadro de quartos e estadias (fica no grupo Início, que não mostra título)
  { title: 'Quartos', href: '/rooms', id: 'rooms', icon: BedDouble, group: 'inicio' },
  // Cozinha & Restaurante
  { title: 'Cozinha & Restaurante', href: '/restaurante', id: 'rooms', icon: Utensils, group: 'vender' },
  // Lounge (as vendas do bar)
  { title: 'Lounge & Bar', href: '/pos', id: 'sales', icon: Wine, group: 'vender' },
  { title: 'Histórico de Transações', href: '/sales', id: 'sales', icon: ShoppingCart, group: 'vender' },
  { title: 'Documentos', href: '/documents', id: 'sales', icon: FileText, group: 'vender' },
  // Bar
  // Produtos do Bar: o stock (Inventário), o Catálogo (preços), os Movimentos e as Perdas são abas da mesma secção
  { title: 'Produtos do Bar', href: '/inventory', id: 'inventory', icon: Box, group: 'stock', also: ['/catalog'], fallback: { id: 'settings', href: '/catalog' } },
  // Pessoas
  { title: 'Clientes', href: '/customers', id: 'customers', icon: Users, group: 'pessoas' },
  { title: 'Funcionários', href: '/users', id: 'users', icon: Users, adminOnly: true, group: 'pessoas' },
  // Dinheiro
  // Relatórios: as vendas e o Financeiro são abas da mesma secção
  { title: 'Relatórios', href: '/reports', id: 'reports', icon: FileText, group: 'dinheiro', also: ['/finance'], fallback: { id: 'finance', href: '/finance' } },
  // Ajustes
  { title: 'Ajustes', href: '/settings', id: 'settings', icon: Settings, group: 'ajustes' },
  { title: 'Subscrição', href: '/billing', id: 'settings', icon: CreditCard, adminOnly: true, group: 'ajustes' },
];

export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: 'inicio', label: 'Início' },
  { id: 'vender', label: 'Lounge' },
  { id: 'stock', label: 'Bar' },
  { id: 'pessoas', label: 'Pessoas' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'ajustes', label: 'Ajustes' },
];

export const allPermissions: Readonly<{ id: ModulePermission; label: string; adminOnly: boolean; }[]> = [
  { id: "dashboard", label: "Dashboard / Visão Geral", adminOnly: false },
  { id: "rooms", label: "Quartos e Estadias (Check-in / Saídas)", adminOnly: false },
  { id: "inventory", label: "Bar & Minibar (Produtos e Stock)", adminOnly: false },
  { id: "sales", label: "Caixa e Faturação", adminOnly: false },
  { id: "customers", label: "Hóspedes e Contactos", adminOnly: false },
  { id: "finance", label: "Financeiro", adminOnly: false },
  { id: "reports", label: "Relatórios de Ocupação e Receita", adminOnly: false },
  { id: "users", label: "Funcionários e Equipa", adminOnly: true },
  { id: "settings", label: "Ajustes do Alojamento", adminOnly: false },
  { id: "diagnostico", label: "Diagnóstico", adminOnly: false },
] as const;


export const initialCatalog: InitialCatalog = {
  "Bebidas": {
    "Águas e Sumos": ["Água Mineral 500ml", "Água das Pedras", "Coca-Cola 330ml", "Sumo Compal"],
    "Cervejas e Vinhos": ["Cerveja 2M 330ml", "Cerveja Laurentina", "Savanna Dry", "Vinho Tinto"]
  },
  "Snacks & Minibar": {
    "Petiscos": ["Batatas Fritas", "Amendoins Torrados", "Chocolates", "Bolachas"]
  },
  "Conveniência": {
    "Geral": ["Kit Higiene Dental", "Preservativos", "Carregador Universal"]
  }
};


// Empty arrays for initial state
export const products: Product[] = [];
export const sales: Sale[] = [];
export const productions: Production[] = [];
export const orders: Order[] = [];
export const notifications: Notification[] = [];
export const currentUser = {
  name: 'Utilizador Padrão',
  email: 'user@example.com',
  role: 'Admin',
  permissions: {
    canSell: true,
    canRegisterProduction: true,
    canEditInventory: true,
    canTransferStock: true,
    canViewReports: true,
  }
};
