
import type { NavItem, NavGroup, Order, Sale, Production, AppNotification, Product, InitialCatalog, ModulePermission } from './types';
import {
  LayoutDashboard,
  Box,
  ShoppingCart,
  Hammer,
  Settings,
  ClipboardList,
  Users,
  FileText,
  Layers, // Using Layers for raw materials
  Zap,
  Truck,
  CreditCard,
} from 'lucide-react';

export const mainNavItems: NavItem[] = [
  // Início
  // o Diagnóstico (a análise completa) abre-se do Painel
  { title: 'Dashboard', href: '/dashboard', id: 'dashboard', icon: LayoutDashboard, group: 'inicio', also: ['/diagnostico'] },
  // Vender
  { title: 'Venda Rápida', href: '/pos', id: 'sales', icon: Zap, group: 'vender' },
  { title: 'Histórico de Vendas', href: '/sales', id: 'sales', icon: ShoppingCart, group: 'vender' },
  { title: 'Lista de Carga', href: '/sales/carga', id: 'sales', isSubItem: true, icon: Truck, group: 'vender' },
  { title: 'Documentos', href: '/documents', id: 'sales', icon: FileText, group: 'vender' },
  { title: 'Encomendas', href: '/orders', id: 'orders', icon: ClipboardList, group: 'vender' },
  // Stock
  // Produtos: o stock (Inventário), o Catálogo (preços), os Movimentos e as Perdas são abas da mesma secção
  { title: 'Produtos', href: '/inventory', id: 'inventory', icon: Box, group: 'stock', also: ['/catalog'], fallback: { id: 'settings', href: '/catalog' } },
  { title: 'Produção', href: '/production', id: 'production', icon: Hammer, group: 'stock' },
  { title: 'Matéria-Prima', href: '/raw-materials', id: 'raw-materials', icon: Layers, group: 'stock' },
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
  { id: 'vender', label: 'Vender' },
  { id: 'stock', label: 'Stock' },
  { id: 'pessoas', label: 'Pessoas' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'ajustes', label: 'Ajustes' },
];

export const allPermissions: Readonly<{ id: ModulePermission; label: string; adminOnly: boolean; }[]> = [
  { id: "dashboard", label: "Dashboard", adminOnly: false },
  { id: "diagnostico", label: "Diagnóstico", adminOnly: false },
  { id: "inventory", label: "Inventário", adminOnly: false },
  { id: "sales", label: "Vendas", adminOnly: false },
  { id: "production", label: "Produção", adminOnly: false },
  { id: "raw-materials", label: "Matéria-Prima", adminOnly: false },
  { id: "orders", label: "Encomendas", adminOnly: false },
  { id: "customers", label: "Clientes", adminOnly: false },
  { id: "finance", label: "Financeiro", adminOnly: false },
  { id: "reports", label: "Relatórios", adminOnly: false },
  { id: "users", label: "Funcionários", adminOnly: true },
  { id: "settings", label: "Ajustes", adminOnly: false },
] as const;


export const initialCatalog: InitialCatalog = {
  "Grelhas": {
    "30x30": ["Bonita difícil", "4 furos", "Floriada", "Xadrez", "Livia", "Livia quadrada", "Flor", "Y", "Livia sem paredes", "+", "Coração", "Passarinho", "Flor de arroz", "Flor de arroz sem paredes"],
    "24x24": ["Floriada 4 furos"],
    "40x40": ["8 duplo"],
    "80x80": ["Letra chinesa"],
    "1mx60": ["Favo de mel"],
    "20x40": ["Grelha 8"],
    "25x20": ["Cardinal"],
    "50x30": ["Duplo V"],
    "20x20": ["4 furos"],
    "60x60": ["Arredondada", "Recta"],
    "45x30": ["Chinesa"]
  },
  "Pavê": {
    "": ["Borbulhas", "Pavê grande", "Rectangular", "Zig-zag", "Saia", "V", "Osso de cão", "Aviãozinho", "Losângulo"]
  },
  "Passadeiras": {
    "30x30": ["Circular", "Rectangular", "8 rectângulos", "Cardinal", "Pedras da praia", "Passadeira padrão"],
    "60x30": ["Rústica"],
    "50x25": ["Diagonal", "Paralelos perpendiculares"],
    "20x20": ["Passadeira padrão"],
    "40x40": ["Passadeira padrão"],
    "50x50": ["Passadeira padrão"],
    "50x60": ["Passadeira padrão"],
    "1mx60": ["Passadeira padrão"],
    "Outros": ["Pé de jardim"]
  },
  "Lancis de concreto": {
    "": ["Dentado", "1mx12", "1mx8", "175x50cm", "250x50cm", "Barra de 1m"]
  },
  "Tanques": {
    "": ["Chinês", "3 bocas", "2 bocas", "1 boca"]
  },
  "Parede rústica": {
    "": ["Mista", "Namaacha", "Grande", "Rectangular", "Média", "Tijolo"]
  },
  "Parede 3D": {
    "": ["Fundo do mar", "Onda 3D", "Pentágono", "Cristalina", "Tranças", "Wave", "3D arte", "3D Build"]
  },
  "Tampas de concreto": {
    "": ["Tampa 30x40", "Tampa 40x50", "Tampa 50x60", "Tampa 60x70", "Tampa 80x90", "Tampa Circular R50xR60"]
  },
  "Canaletas": {
    "E14x48": [],
    "E14x70": [],
    "Grelhas das canaletas": ["5 furos", "7 furos"]
  },
  "Ventiladores de betão": {
    "": ["Pequenos", "Grandes"]
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
