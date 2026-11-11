// Produtos fictícios da venda de demonstração. Só existem no ecrã: nunca são gravados.
import type { Product } from "@/lib/types";
import { rememberSeen } from "@/lib/seen-store";

const base = { reservedStock: 0, lowStockThreshold: 10, criticalStockThreshold: 5, lastUpdated: "", location: "" };

export const DEMO_PRODUCTS: Product[] = [
    { ...base, id: "demo-corona", instanceId: "demo-corona", name: "Cerveja Corona Extra 355ml (exemplo)", category: "Cervejas", unit: "garrafa", price: 160, cost: 110, stock: 120 },
    { ...base, id: "demo-heineken", instanceId: "demo-heineken", name: "Cerveja Heineken Long Neck (exemplo)", category: "Cervejas", unit: "garrafa", price: 150, cost: 100, stock: 150 },
    { ...base, id: "demo-2m", instanceId: "demo-2m", name: "Cerveja 2M 330ml (exemplo)", category: "Cervejas", unit: "garrafa", price: 120, cost: 80, stock: 200 },
    { ...base, id: "demo-gordon", instanceId: "demo-gordon", name: "Gin Gordon's London Dry 750ml (exemplo)", category: "Destilados", unit: "garrafa", price: 1200, cost: 850, stock: 18 },
    { ...base, id: "demo-agua", instanceId: "demo-agua", name: "Água Mineral Namaacha 500ml (exemplo)", category: "Bebidas", unit: "garrafa", price: 50, cost: 25, stock: 180 },
];

const gbase = { reservedStock: 0, lastUpdated: "", location: "" };

/** As 3 localizações da empresa do modo convidado (ver GUEST_COMPANY em guest-mode.ts). */
export const GUEST_LOCATIONS = ["Armazém Principal", "Pátio de Produção", "Loja Principal"] as const;

/** Os produtos de demonstração têm sub-locais; na empresa convidada contam como uma das 3 localizações. */
export function guestLocation(label?: string | null): string {
    const l = (label || "").toLowerCase();
    if (!l) return "Armazém Principal";
    if (l.startsWith("pátio") || l.startsWith("patio")) return "Pátio de Produção";
    if (/(prateleira|vitrine|painel de ferramentas|painel ferramentas|gaveta|loja|balc)/.test(l)) return "Loja Principal";
    return "Armazém Principal";
}

/** Catálogo do modo convidado (30 produtos de Hotelaria, Bar & Lounge). */
export const GUEST_PRODUCTS: Product[] = [
    { ...gbase, id: "demo-cim-01", instanceId: "demo-cim-01", name: "Caixa de Cerveja Corona Extra 355ml (c/ 24)", category: "Bebidas", unit: "caixa", cost: 2400, price: 3600, stock: 150, lowStockThreshold: 30, criticalStockThreshold: 10, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-blo-02", instanceId: "demo-blo-02", name: "Caixa de Heineken Long Neck 330ml (c/ 24)", category: "Bebidas", unit: "caixa", cost: 2300, price: 3400, stock: 850, lowStockThreshold: 200, criticalStockThreshold: 50, location: guestLocation("Pátio de Produção") },
    { ...gbase, id: "demo-var-03", instanceId: "demo-var-03", name: "Grade de Cerveja 2M 330ml (c/ 24)", category: "Bebidas", unit: "grade", cost: 1700, price: 2600, stock: 4, lowStockThreshold: 20, criticalStockThreshold: 5, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-var-04", instanceId: "demo-var-04", name: "Grade de Laurentina Preta 330ml (c/ 24)", category: "Bebidas", unit: "grade", cost: 1800, price: 2700, stock: 45, lowStockThreshold: 15, criticalStockThreshold: 5, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-are-05", instanceId: "demo-are-05", name: "Savanna Dry Cider 330ml (Pack c/ 6)", category: "Bebidas", unit: "pack", cost: 650, price: 950, stock: 25, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Pátio de Produção") },
    { ...gbase, id: "demo-bri-06", instanceId: "demo-bri-06", name: "Gin Gordon's London Dry 750ml", category: "Bebidas", unit: "garrafa", cost: 850, price: 1350, stock: 8, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Pátio de Produção") },
    { ...gbase, id: "demo-cha-07", instanceId: "demo-cha-07", name: "Whisky Johnnie Walker Black Label 1L", category: "Bebidas", unit: "garrafa", cost: 2200, price: 3200, stock: 90, lowStockThreshold: 25, criticalStockThreshold: 10, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-pre-08", instanceId: "demo-pre-08", name: "Vodka Smirnoff Red 750ml", category: "Bebidas", unit: "garrafa", cost: 680, price: 1100, stock: 120, lowStockThreshold: 30, criticalStockThreshold: 10, location: guestLocation("Prateleira F1") },
    { ...gbase, id: "demo-ara-09", instanceId: "demo-ara-09", name: "Vinho Tinto Reserva Douro 750ml", category: "Bebidas", unit: "garrafa", cost: 650, price: 1200, stock: 7, lowStockThreshold: 20, criticalStockThreshold: 5, location: guestLocation("Prateleira F1") },
    { ...gbase, id: "demo-fec-10", instanceId: "demo-fec-10", name: "Espumante Brut Reserva 750ml", category: "Bebidas", unit: "garrafa", cost: 750, price: 1400, stock: 18, lowStockThreshold: 8, criticalStockThreshold: 3, location: guestLocation("Vitrine Loja") },
    { ...gbase, id: "demo-mar-11", instanceId: "demo-mar-11", name: "Água Mineral Namaacha 500ml (Fardo c/ 24)", category: "Bebidas", unit: "fardo", cost: 350, price: 600, stock: 14, lowStockThreshold: 5, criticalStockThreshold: 2, location: guestLocation("Balcão Principal") },
    { ...gbase, id: "demo-dis-12", instanceId: "demo-dis-12", name: "Água das Pedras Salgadas 250ml", category: "Bebidas", unit: "garrafa", cost: 55, price: 90, stock: 3, lowStockThreshold: 25, criticalStockThreshold: 5, location: guestLocation("Gaveta Balcão") },
    { ...gbase, id: "demo-fit-13", instanceId: "demo-fit-13", name: "Red Bull Energy Drink 250ml (Pack c/ 4)", category: "Bebidas", unit: "pack", cost: 480, price: 720, stock: 22, lowStockThreshold: 8, criticalStockThreshold: 2, location: guestLocation("Balcão Principal") },
    { ...gbase, id: "demo-tub-14", instanceId: "demo-tub-14", name: "Refrigerante Coca-Cola 330ml (Pack c/ 6)", category: "Bebidas", unit: "pack", cost: 320, price: 480, stock: 35, lowStockThreshold: 10, criticalStockThreshold: 4, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-tub-15", instanceId: "demo-tub-15", name: "Água Tónica Schweppes 200ml (Pack c/ 6)", category: "Bebidas", unit: "pack", cost: 300, price: 450, stock: 6, lowStockThreshold: 15, criticalStockThreshold: 5, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-tor-16", instanceId: "demo-tor-16", name: "Ginger Ale Schweppes 200ml (Pack c/ 6)", category: "Bebidas", unit: "pack", cost: 300, price: 450, stock: 28, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Balcão Principal") },
    { ...gbase, id: "demo-joe-17", instanceId: "demo-joe-17", name: "Castanha de Caju Torrada Salgada 200g", category: "Snacks", unit: "pacote", cost: 180, price: 280, stock: 65, lowStockThreshold: 20, criticalStockThreshold: 5, location: guestLocation("Balcão Principal") },
    { ...gbase, id: "demo-cab-18", instanceId: "demo-cab-18", name: "Amendoim Torrado com Sal 150g", category: "Snacks", unit: "pacote", cost: 40, price: 90, stock: 16, lowStockThreshold: 6, criticalStockThreshold: 2, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-dis-19", instanceId: "demo-dis-19", name: "Batata Frita Crocante Lay's 120g", category: "Snacks", unit: "pacote", cost: 95, price: 160, stock: 24, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Balcão Principal") },
    { ...gbase, id: "demo-lam-20", instanceId: "demo-lam-20", name: "Tábua Mista de Queijos e Frios", category: "Snacks", unit: "dose", cost: 350, price: 650, stock: 140, lowStockThreshold: 30, criticalStockThreshold: 10, location: guestLocation("Prateleira E2") },
    { ...gbase, id: "demo-tom-21", instanceId: "demo-tom-21", name: "Sumo Natural de Laranja 300ml", category: "Bebidas", unit: "copo", cost: 80, price: 150, stock: 2, lowStockThreshold: 15, criticalStockThreshold: 4, location: guestLocation("Prateleira E2") },
    { ...gbase, id: "demo-tin-22", instanceId: "demo-tin-22", name: "Café Expresso Nespresso Cápsula", category: "Bebidas", unit: "un", cost: 35, price: 80, stock: 9, lowStockThreshold: 15, criticalStockThreshold: 4, location: guestLocation("Balcão Principal") },
    { ...gbase, id: "demo-ver-23", instanceId: "demo-ver-23", name: "Chá Twinings Earl Grey", category: "Bebidas", unit: "un", cost: 25, price: 60, stock: 15, lowStockThreshold: 5, criticalStockThreshold: 2, location: guestLocation("Balcão Principal") },
    { ...gbase, id: "demo-rol-24", instanceId: "demo-rol-24", name: "Kit Amenities Higiene VIP", category: "Conveniência", unit: "kit", cost: 120, price: 200, stock: 30, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Prateleira T1") },
    { ...gbase, id: "demo-col-25", instanceId: "demo-col-25", name: "Pantufas Felpudas Hotelaria MajorStay", category: "Conveniência", unit: "par", cost: 90, price: 180, stock: 20, lowStockThreshold: 6, criticalStockThreshold: 2, location: guestLocation("Prateleira T2") },
    { ...gbase, id: "demo-arr-26", instanceId: "demo-arr-26", name: "Cerveja Heineken Lata 330ml (Pack c/ 6)", category: "Bebidas", unit: "pack", cost: 420, price: 600, stock: 75, lowStockThreshold: 20, criticalStockThreshold: 5, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-ole-27", instanceId: "demo-ole-27", name: "Cerveja Corona Extra 355ml (Pack c/ 6)", category: "Bebidas", unit: "pack", cost: 480, price: 720, stock: 12, lowStockThreshold: 20, criticalStockThreshold: 5, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-acu-28", instanceId: "demo-acu-28", name: "Licor Amarula Cream 750ml", category: "Bebidas", unit: "garrafa", cost: 780, price: 1300, stock: 40, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-agu-29", instanceId: "demo-agu-29", name: "Água Tónica Fever-Tree 200ml", category: "Bebidas", unit: "garrafa", cost: 90, price: 160, stock: 50, lowStockThreshold: 15, criticalStockThreshold: 5, location: guestLocation("Armazém Principal") },
    { ...gbase, id: "demo-sab-30", instanceId: "demo-sab-30", name: "Preservativo Durex Clássico (Caixa c/ 3)", category: "Conveniência", unit: "caixa", cost: 80, price: 180, stock: 1, lowStockThreshold: 10, criticalStockThreshold: 3, location: guestLocation("Gaveta Balcão") },
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
