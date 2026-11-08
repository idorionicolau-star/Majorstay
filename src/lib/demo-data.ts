// Produtos fictícios da venda de demonstração. Só existem no ecrã: nunca são gravados.
import type { Product } from "@/lib/types";
import { rememberSeen } from "@/lib/seen-store";

const base = { reservedStock: 0, lowStockThreshold: 10, criticalStockThreshold: 5, lastUpdated: "", location: "" };

export const DEMO_PRODUCTS: Product[] = [
    { ...base, id: "demo-cimento", instanceId: "demo-cimento", name: "Cimento 32,5N (exemplo)", category: "Cimentos", unit: "saco", price: 650, cost: 540, stock: 120 },
    { ...base, id: "demo-bloco", instanceId: "demo-bloco", name: "Bloco 15 (exemplo)", category: "Blocos", unit: "un", price: 45, cost: 30, stock: 800 },
    { ...base, id: "demo-areia", instanceId: "demo-areia", name: "Areia grossa (exemplo)", category: "Agregados", unit: "m³", price: 2500, cost: 1800, stock: 30 },
    { ...base, id: "demo-varao", instanceId: "demo-varao", name: "Varão 10 mm (exemplo)", category: "Ferro", unit: "un", price: 520, cost: 430, stock: 200 },
    { ...base, id: "demo-tinta", instanceId: "demo-tinta", name: "Tinta branca 20 L (exemplo)", category: "Tintas", unit: "lata", price: 4800, cost: 3900, stock: 15 },
];

const gbase = { reservedStock: 0, lastUpdated: "", location: "" };

/** As 3 localizações da empresa do modo convidado (ver GUEST_COMPANY em guest-mode.ts). */
export const GUEST_LOCATIONS = ["Armazém Principal", "Pátio de Produção", "Loja Principal"] as const;

/** Os produtos de demonstração têm sub-locais ("Prateleira F1", "Setor Tintas"…); na empresa convidada contam como uma das 3 localizações. */
export function guestLocation(label?: string | null): string {
    const l = (label || "").toLowerCase();
    if (!l) return "Armazém Principal";
    if (l.startsWith("pátio") || l.startsWith("patio")) return "Pátio de Produção";
    if (/(prateleira|vitrine|painel de ferramentas|painel ferramentas|gaveta|loja|balc)/.test(l)) return "Loja Principal";
    return "Armazém Principal";
}

/** Catálogo do modo convidado (30 produtos). A demonstração de primeiros passos usa só DEMO_PRODUCTS. */
export const GUEST_PRODUCTS: Product[] = [
    { ...gbase, id: "demo-cim-01", instanceId: "demo-cim-01", name: "Cimento Portland 32.5N Limak 50kg", category: "Materiais de Construção", unit: "saco", cost: 480, price: 580, stock: 150, lowStockThreshold: 30, criticalStockThreshold: 10, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-blo-02", instanceId: "demo-blo-02", name: "Bloco de Betão 15 cm", category: "Materiais de Construção", unit: "un", cost: 28, price: 42, stock: 850, lowStockThreshold: 200, criticalStockThreshold: 50, location: guestLocation("Pátio de Produção") },
    { ...gbase, id: "demo-var-03", instanceId: "demo-var-03", name: "Varão de Aço 10 mm (12m)", category: "Materiais de Construção", unit: "barra", cost: 390, price: 490, stock: 4, lowStockThreshold: 20, criticalStockThreshold: 5, location: guestLocation("Setor Metais") },
    { ...gbase, id: "demo-var-04", instanceId: "demo-var-04", name: "Varão de Aço 12 mm (12m)", category: "Materiais de Construção", unit: "barra", cost: 560, price: 690, stock: 45, lowStockThreshold: 15, criticalStockThreshold: 5, location: guestLocation("Setor Metais") },
    { ...gbase, id: "demo-are-05", instanceId: "demo-are-05", name: "Areia Grossa de Rio", category: "Materiais de Construção", unit: "m³", cost: 1800, price: 2500, stock: 25, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Pátio Aberto") },
    { ...gbase, id: "demo-bri-06", instanceId: "demo-bri-06", name: "Brita 1 para Betão", category: "Materiais de Construção", unit: "m³", cost: 2100, price: 2850, stock: 8, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Pátio Aberto") },
    { ...gbase, id: "demo-cha-07", instanceId: "demo-cha-07", name: "Chapa de Zinco IBR 0.40mm x 6m", category: "Coberturas", unit: "un", cost: 620, price: 780, stock: 90, lowStockThreshold: 25, criticalStockThreshold: 10, location: guestLocation("Armazém B") },
    { ...gbase, id: "demo-pre-08", instanceId: "demo-pre-08", name: "Prego de Cabeça Redonda 3\"", category: "Ferragens", unit: "kg", cost: 85, price: 130, stock: 120, lowStockThreshold: 30, criticalStockThreshold: 10, location: guestLocation("Prateleira F1") },
    { ...gbase, id: "demo-ara-09", instanceId: "demo-ara-09", name: "Arame Queimado Recozido 1.2mm", category: "Ferragens", unit: "kg", cost: 90, price: 140, stock: 7, lowStockThreshold: 20, criticalStockThreshold: 5, location: guestLocation("Prateleira F1") },
    { ...gbase, id: "demo-fec-10", instanceId: "demo-fec-10", name: "Fechadura de Embutir c/ Puxador", category: "Ferragens", unit: "un", cost: 650, price: 950, stock: 18, lowStockThreshold: 8, criticalStockThreshold: 3, location: guestLocation("Vitrine Loja") },
    { ...gbase, id: "demo-mar-11", instanceId: "demo-mar-11", name: "Martelo de Carpinteiro 500g", category: "Ferramentas", unit: "un", cost: 320, price: 480, stock: 14, lowStockThreshold: 5, criticalStockThreshold: 2, location: guestLocation("Painel Ferramentas") },
    { ...gbase, id: "demo-dis-12", instanceId: "demo-dis-12", name: "Disco de Corte Metal 115mm", category: "Consumíveis", unit: "un", cost: 45, price: 80, stock: 3, lowStockThreshold: 25, criticalStockThreshold: 5, location: guestLocation("Gaveta Balcão") },
    { ...gbase, id: "demo-fit-13", instanceId: "demo-fit-13", name: "Fita Métrica 5m", category: "Ferramentas", unit: "un", cost: 140, price: 220, stock: 22, lowStockThreshold: 8, criticalStockThreshold: 2, location: guestLocation("Painel Ferramentas") },
    { ...gbase, id: "demo-tub-14", instanceId: "demo-tub-14", name: "Tubo PVC Esgoto 110mm x 6m", category: "Canalização", unit: "barra", cost: 520, price: 690, stock: 35, lowStockThreshold: 10, criticalStockThreshold: 4, location: guestLocation("Corredor Tubagens") },
    { ...gbase, id: "demo-tub-15", instanceId: "demo-tub-15", name: "Tubo PPR Soldável 25mm x 4m", category: "Canalização", unit: "barra", cost: 280, price: 390, stock: 6, lowStockThreshold: 15, criticalStockThreshold: 5, location: guestLocation("Corredor Tubagens") },
    { ...gbase, id: "demo-tor-16", instanceId: "demo-tor-16", name: "Torneira de Esfera 3/4\"", category: "Canalização", unit: "un", cost: 210, price: 320, stock: 28, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Gaveteiro Hidráulica") },
    { ...gbase, id: "demo-joe-17", instanceId: "demo-joe-17", name: "Joelho PVC 90° 110mm", category: "Canalização", unit: "un", cost: 55, price: 95, stock: 65, lowStockThreshold: 20, criticalStockThreshold: 5, location: guestLocation("Caixa Plástica H2") },
    { ...gbase, id: "demo-cab-18", instanceId: "demo-cab-18", name: "Cabo Elétrico Flexível 2.5mm² (100m)", category: "Eletricidade", unit: "rolo", cost: 1850, price: 2450, stock: 16, lowStockThreshold: 6, criticalStockThreshold: 2, location: guestLocation("Armazém Fechado") },
    { ...gbase, id: "demo-dis-19", instanceId: "demo-dis-19", name: "Disjuntor Bipolar DIN 20A", category: "Eletricidade", unit: "un", cost: 240, price: 380, stock: 24, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Painel Elétrico") },
    { ...gbase, id: "demo-lam-20", instanceId: "demo-lam-20", name: "Lâmpada LED 9W E27 6500K", category: "Eletricidade", unit: "un", cost: 60, price: 110, stock: 140, lowStockThreshold: 30, criticalStockThreshold: 10, location: guestLocation("Prateleira E2") },
    { ...gbase, id: "demo-tom-21", instanceId: "demo-tom-21", name: "Tomada Dupla de Embutir 2P+T", category: "Eletricidade", unit: "un", cost: 95, price: 160, stock: 2, lowStockThreshold: 15, criticalStockThreshold: 4, location: guestLocation("Prateleira E2") },
    { ...gbase, id: "demo-tin-22", instanceId: "demo-tin-22", name: "Tinta Acrílica Branca 20 L", category: "Tintas & Acabamento", unit: "balde", cost: 3800, price: 4950, stock: 9, lowStockThreshold: 15, criticalStockThreshold: 4, location: guestLocation("Setor Tintas") },
    { ...gbase, id: "demo-ver-23", instanceId: "demo-ver-23", name: "Verniz Marítimo 5 L", category: "Tintas & Acabamento", unit: "lata", cost: 1250, price: 1750, stock: 15, lowStockThreshold: 5, criticalStockThreshold: 2, location: guestLocation("Setor Tintas") },
    { ...gbase, id: "demo-rol-24", instanceId: "demo-rol-24", name: "Rolo de Pintura Anti-Gota 23cm", category: "Acessórios Pintura", unit: "un", cost: 180, price: 280, stock: 30, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Prateleira T1") },
    { ...gbase, id: "demo-col-25", instanceId: "demo-col-25", name: "Cola de Madeira PVA 1 kg", category: "Adesivos & Químicos", unit: "un", cost: 190, price: 290, stock: 20, lowStockThreshold: 6, criticalStockThreshold: 2, location: guestLocation("Prateleira T2") },
    { ...gbase, id: "demo-arr-26", instanceId: "demo-arr-26", name: "Arroz Vaporizado 25 kg", category: "Mercearia Grossista", unit: "saco", cost: 1150, price: 1350, stock: 75, lowStockThreshold: 20, criticalStockThreshold: 5, location: guestLocation("Palete Alimentar 1") },
    { ...gbase, id: "demo-ole-27", instanceId: "demo-ole-27", name: "Óleo Vegetal 5 L", category: "Mercearia Grossista", unit: "garrafão", cost: 490, price: 590, stock: 12, lowStockThreshold: 20, criticalStockThreshold: 5, location: guestLocation("Palete Alimentar 2") },
    { ...gbase, id: "demo-acu-28", instanceId: "demo-acu-28", name: "Açúcar Castanho 50 kg", category: "Mercearia Grossista", unit: "saco", cost: 2450, price: 2850, stock: 40, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Palete Alimentar 1") },
    { ...gbase, id: "demo-agu-29", instanceId: "demo-agu-29", name: "Água Mineral 500 ml (Fardo c/ 24)", category: "Bebidas", unit: "fardo", cost: 280, price: 380, stock: 50, lowStockThreshold: 15, criticalStockThreshold: 5, location: guestLocation("Depósito Bebidas") },
    { ...gbase, id: "demo-sab-30", instanceId: "demo-sab-30", name: "Sabão Azul 1 kg (Caixa c/ 20)", category: "Higiene & Limpeza", unit: "caixa", cost: 680, price: 850, stock: 1, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Prateleira Limpeza") },
];

export const isDemoProduct = (p: { id?: string }) => !!p.id && p.id.startsWith("demo-");

/** Marca no aparelho que a pessoa já fez a venda de demonstração (para a lista de primeiros passos). */
const demoKey = (companyId?: string | null) => `majorstockx-demo-sale-${companyId || "x"}`;

export function isDemoSaleDone(companyId?: string | null): boolean {
    try {
        return localStorage.getItem(demoKey(companyId)) === "1";
    } catch {
        return false;
    }
}

export function markDemoSaleDone(companyId?: string | null) {
    try {
        localStorage.setItem(demoKey(companyId), "1");
    } catch {
        /* ignore */
    }
    rememberSeen(demoKey(companyId));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("msx:guide-done"));
}
