import type { Employee, Company, Product, Sale, Expense, Customer, StockMovement, Order, Production, AppNotification } from "@/lib/types";
import { GUEST_PRODUCTS, GUEST_LOCATIONS, guestLocation } from "@/lib/demo-data";
import { GUEST_TRIAL_LIMIT_MS, GUEST_TRIAL_GAP_MS } from "@/lib/guest-trial";

/** Sessão a decorrer: guarda a hora em que começou (some ao sair). */
export const GUEST_KEY = "majorstockx-guest-mode";
export const GUEST_DURATION_MINUTES = GUEST_TRIAL_LIMIT_MS / 60000;
/** Id da empresa fictícia. É ISTO (e não a chave do localStorage) que diz à app que a sessão é de convidado. */
export const GUEST_COMPANY_ID = "demo-company";
/** Disparado quando se entra/sai do modo convidado (a app liga/desliga a sessão fictícia). */
export const GUEST_SESSION_EVENT = "msx:guest-session";
/** Disparado quando os dados do convidado mudam (a app volta a ler). */
export const GUEST_DATA_EVENT = "msx:guest-data";

const STORE_PREFIX = "majorstockx-guest-";
const DISMISSED_KEY = "majorstockx-guest-dismissed";
/** Último "ainda cá estou" da sessão: se a app fecha, o tempo em que esteve fechada não conta. */
const BEAT_KEY = STORE_PREFIX + "beat";
/** Tempo já gasto em sessões acabadas (ms). Fica no aparelho entre sessões: sair e voltar CONTINUA a contagem. */
const USED_KEY = STORE_PREFIX + "used";
/** Versão do formato dos dados guardados: se mudar, os dados antigos do convidado são deitados fora (não ficam com formatos velhos). */
const SCHEMA_KEY = STORE_PREFIX + "schema";
const SCHEMA_VERSION = "2";
/** Código deste aparelho para o servidor (ver lib/guest-trial.ts): o tempo conta por aparelho, e a rede limita quantos abre. */
const DEVICE_KEY = STORE_PREFIX + "device";
/** As chaves do relógio nunca se apagam com os dados (senão limpar os dados dava tempo novo). */
const CLOCK_KEYS = [GUEST_KEY, BEAT_KEY, USED_KEY, DEVICE_KEY];

function emit(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(name));
  } catch {
    /* ignore */
  }
}

export const isGuestCompany = (companyId?: string | null): boolean => companyId === GUEST_COMPANY_ID;

// -----------------------------------------------------------------------------
// Relógio do aparelho. O servidor guarda o mesmo por IP (ver lib/guest-trial.ts e
// lib/guest-trial-client.ts); aqui conta-se também, para funcionar sem rede.
// -----------------------------------------------------------------------------

function readNum(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeNum(key: string, n: number): void {
  try {
    localStorage.setItem(key, String(Math.round(n)));
  } catch {
    /* ignore */
  }
}

const clampUsed = (n: number) => Math.min(GUEST_TRIAL_LIMIT_MS, Math.max(0, n));

/** Sem batimento há mais de um minuto: a sessão acabou no último batimento (o tempo parado não conta). */
function settleStale(now: number): void {
  const start = readNum(GUEST_KEY);
  if (start === null) return;
  const last = readNum(BEAT_KEY) ?? start;
  if (now - last > GUEST_TRIAL_GAP_MS) {
    writeNum(USED_KEY, clampUsed((readNum(USED_KEY) ?? 0) + Math.max(0, last - start)));
    try {
      localStorage.removeItem(GUEST_KEY);
      localStorage.removeItem(BEAT_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Tempo gasto no total, contando a sessão a decorrer. */
function usedMsLocal(now: number): number {
  settleStale(now);
  const start = readNum(GUEST_KEY);
  return clampUsed((readNum(USED_KEY) ?? 0) + (start !== null ? Math.max(0, now - start) : 0));
}

/** Quanto resta do teste (conta o que já se gastou, mesmo sem sessão a decorrer). */
export function getGuestRemainingSeconds(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Math.max(0, Math.floor((GUEST_TRIAL_LIMIT_MS - usedMsLocal(Date.now())) / 1000));
  } catch {
    return 0;
  }
}

/** Há uma sessão de convidado a decorrer e ainda resta tempo. Só para arrancar/terminar a sessão — a app decide por GUEST_COMPANY_ID. */
export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const now = Date.now();
    const left = GUEST_TRIAL_LIMIT_MS - usedMsLocal(now);
    if (readNum(GUEST_KEY) === null) return false;
    if (left <= 0) {
      exitGuestMode(); // o tempo acabou
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Batimento: "ainda cá estou". Reabre a sessão se o aparelho adormeceu. Devolve false quando o tempo acabou. */
export function touchGuestSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const now = Date.now();
    if (GUEST_TRIAL_LIMIT_MS - usedMsLocal(now) <= 0) {
      exitGuestMode();
      return false;
    }
    if (readNum(GUEST_KEY) === null) writeNum(GUEST_KEY, now);
    writeNum(BEAT_KEY, now);
    return true;
  } catch {
    return false;
  }
}

/** Adota o tempo que o servidor diz que resta, se for menor do que o do aparelho (nunca dá tempo a mais). */
export function applyServerRemaining(remainingMs: number): void {
  if (typeof window === "undefined" || !Number.isFinite(remainingMs)) return;
  try {
    const now = Date.now();
    const local = usedMsLocal(now);
    const server = clampUsed(GUEST_TRIAL_LIMIT_MS - remainingMs);
    if (server > local) writeNum(USED_KEY, clampUsed((readNum(USED_KEY) ?? 0) + (server - local)));
  } catch {
    /* ignore */
  }
}

/** Código deste aparelho (32 letras/números), criado à primeira vez. Sem armazenamento, devolve um que não se guarda. */
export function getGuestDeviceId(): string {
  const fresh = () => {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };
  if (typeof window === "undefined") return fresh();
  try {
    const have = localStorage.getItem(DEVICE_KEY);
    if (have && /^[a-f0-9]{32}$/.test(have)) return have;
    const id = fresh();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return fresh();
  }
}

/**
 * Apaga os dados fictícios do convidado (vendas, despesas, clientes…). Usa-se quando ele ativa a conta de teste: a conta
 * nova começa vazia e nada do que mexeu como convidado sobe para o servidor. O relógio NÃO se apaga.
 */
export function discardGuestData(): void {
  if (typeof window === "undefined") return;
  clearGuestData();
  emit(GUEST_DATA_EVENT);
}

/** Apaga os dados do convidado guardados no aparelho (não mexe na sessão nem no relógio). */
function clearGuestData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORE_PREFIX) && !CLOCK_KEYS.includes(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** Dados guardados por uma versão antiga do formato não se reaproveitam. */
function ensureSchema(): void {
  try {
    if (localStorage.getItem(SCHEMA_KEY) === SCHEMA_VERSION) return;
    clearGuestData();
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
  } catch {
    /* ignore */
  }
}

/**
 * Entra no modo convidado. O relógio CONTINUA de onde ficou (não recomeça) e os dados (vendas, despesas, clientes…)
 * também. Devolve false se o tempo do teste já acabou.
 */
export function enterGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    ensureSchema();
    const now = Date.now();
    if (GUEST_TRIAL_LIMIT_MS - usedMsLocal(now) <= 0) return false;
    if (readNum(GUEST_KEY) === null) writeNum(GUEST_KEY, now);
    writeNum(BEAT_KEY, now);
    sessionStorage.removeItem(DISMISSED_KEY);
  } catch {
    return false;
  }
  emit(GUEST_SESSION_EVENT);
  return true;
}

/** Termina a sessão de convidado (sair, tempo esgotado ou entrada com conta real). O tempo gasto e os dados ficam no aparelho. */
export function exitGuestMode(): void {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    settleStale(now);
    const start = readNum(GUEST_KEY);
    if (start !== null) {
      writeNum(USED_KEY, clampUsed((readNum(USED_KEY) ?? 0) + Math.max(0, now - start)));
      localStorage.removeItem(GUEST_KEY);
      localStorage.removeItem(BEAT_KEY);
    }
    sessionStorage.removeItem(DISMISSED_KEY);
  } catch {
    /* ignore */
  }
  emit(GUEST_SESSION_EVENT);
}

// -----------------------------------------------------------------------------
// Empresa e Usuário Convidado
// -----------------------------------------------------------------------------

export const GUEST_COMPANY: Company = {
  id: GUEST_COMPANY_ID,
  name: "Ferragens & Construção Central (Convidado)",
  businessType: "manufacturer",
  phone: "+258 84 300 1234",
  address: "Av. de Moçambique, Km 7, Maputo",
  taxId: "400891234",
  email: "contacto@ferragenscentral.co.mz",
  curingDays: 3,
  countEveryDays: 30,
  locations: GUEST_LOCATIONS.map((name) => ({ id: name, name })),
  validUnits: ["un", "saco", "kg", "m³", "barra", "rolo", "balde", "lata", "garrafão", "fardo", "caixa"],
  validCategories: [
    "Materiais de Construção",
    "Coberturas",
    "Ferragens",
    "Ferramentas",
    "Consumíveis",
    "Canalização",
    "Eletricidade",
    "Tintas & Acabamento",
    "Acessórios Pintura",
    "Adesivos & Químicos",
    "Mercearia Grossista",
    "Bebidas",
    "Higiene & Limpeza"
  ]
};

export const GUEST_USER: Employee = {
  id: "guest-user",
  username: "Gestor Comercial",
  email: "convidado@majorstockx.demo",
  role: "Admin",
  companyId: GUEST_COMPANY_ID,
  permissions: {
    dashboard: "write",
    diagnostico: "write",
    inventory: "write",
    sales: "write",
    customers: "write",
    production: "write",
    "raw-materials": "write",
    finance: "write",
    orders: "write",
    reports: "write",
    users: "write",
    settings: "write"
  }
};

// -----------------------------------------------------------------------------
// Clientes Reais de Moçambique (8 clientes ativos)
// -----------------------------------------------------------------------------

export const INITIAL_GUEST_CUSTOMERS: Customer[] = [
  {
    id: "cust-01",
    name: "Construtora Horizonte & Filhos, Lda",
    phone: "+258 84 312 9900",
    email: "obras@horizonte.co.mz",
    totalPurchases: 148500,
    lastVisit: daysAgoIso(1, 10, 30),
    notes: "Grande empreiteiro em Maputo — compras semanais de cimento, varões e chapas."
  },
  {
    id: "cust-02",
    name: "Mestre Inácio Chissano",
    phone: "+258 82 455 1200",
    totalPurchases: 62400,
    lastVisit: daysAgoIso(0, 9, 15),
    notes: "Mestre de obras Matola Rio — paga sempre por M-Pesa."
  },
  {
    id: "cust-03",
    name: "Mercearia Popular da Machava",
    phone: "+258 84 890 3344",
    email: "popularmachava@gmail.com",
    totalPurchases: 94250,
    lastVisit: daysAgoIso(2, 14, 20),
    notes: "Revenda grossista de arroz, óleo vegetal, sabão e água mineral."
  },
  {
    id: "cust-04",
    name: "Eng. Carlos Machava",
    phone: "+258 87 220 4455",
    totalPurchases: 48900,
    lastVisit: daysAgoIso(3, 11, 45),
    notes: "Moradia privada na Sommerschield 2 — compras de tintas, acabamentos e disjuntores."
  },
  {
    id: "cust-05",
    name: "Dona Maria Muthemba",
    phone: "+258 84 551 8822",
    totalPurchases: 32600,
    lastVisit: daysAgoIso(0, 11, 10),
    notes: "Construção de dependências e reabilitação na Costa do Sol."
  },
  {
    id: "cust-06",
    name: "Ferragens Polana Caniço",
    phone: "+258 84 102 7788",
    totalPurchases: 54100,
    lastVisit: daysAgoIso(5, 16, 0),
    notes: "Revendedor local de pregos, tubos PVC, fitas e acessórios."
  },
  {
    id: "cust-07",
    name: "Restaurante & Bar Zambézia",
    phone: "+258 84 901 0022",
    totalPurchases: 18200,
    lastVisit: daysAgoIso(4, 15, 30),
    notes: "Compra semanal de fardos de água mineral e sabão de limpeza."
  },
  {
    id: "cust-08",
    name: "Consumidor Final (Balcão)",
    phone: "",
    totalPurchases: 27800,
    lastVisit: daysAgoIso(0, 12, 0),
    notes: "Vendas diretas no balcão a dinheiro e M-Pesa."
  }
];

// -----------------------------------------------------------------------------
// Despesas dos Últimos 30 Dias (Financeiro consistente)
// -----------------------------------------------------------------------------

export const INITIAL_GUEST_EXPENSES: Expense[] = [
  {
    id: "exp-01",
    description: "Electricidade EDM — Fábrica de Blocos & Armazém",
    amount: 14500,
    category: "Energia",
    date: daysAgoIso(3, 10, 0),
    status: "Pago",
    registeredBy: "Gestor Comercial"
  },
  {
    id: "exp-02",
    description: "Combustível Carrinha Isuzu (Entregas aos clientes)",
    amount: 18000,
    category: "Transporte",
    date: daysAgoIso(5, 14, 30),
    status: "Pago",
    registeredBy: "Gestor Comercial"
  },
  {
    id: "exp-03",
    description: "Salários da Quinzena — 4 Operários de Produção",
    amount: 48000,
    category: "Salários",
    date: daysAgoIso(12, 17, 0),
    status: "Pago",
    registeredBy: "Gestor Comercial"
  },
  {
    id: "exp-04",
    description: "Aluguer do Armazém Principal e Pátio",
    amount: 35000,
    category: "Instalações",
    date: daysAgoIso(18, 9, 0),
    status: "Pago",
    registeredBy: "Gestor Comercial"
  },
  {
    id: "exp-05",
    description: "Internet Fibra Vodacom Empresas (Mensalidade)",
    amount: 4500,
    category: "Comunicações",
    date: daysAgoIso(8, 11, 0),
    status: "Pago",
    registeredBy: "Gestor Comercial"
  },
  {
    id: "exp-06",
    description: "Água FIPAG — Consumo Industrial de Betão",
    amount: 3200,
    category: "Água",
    date: daysAgoIso(10, 15, 0),
    status: "Pago",
    registeredBy: "Gestor Comercial"
  },
  {
    id: "exp-07",
    description: "Manutenção Preventiva da Prensa Vibromoldadora",
    amount: 7500,
    category: "Manutenção",
    date: daysAgoIso(15, 16, 30),
    status: "Pago",
    registeredBy: "Gestor Comercial"
  },
  {
    id: "exp-08",
    description: "Material de Escritório, Papel de Faturação e Limpeza",
    amount: 2100,
    category: "Operacional",
    date: daysAgoIso(22, 10, 0),
    status: "Pago",
    registeredBy: "Gestor Comercial"
  }
];

// -----------------------------------------------------------------------------
// Vendas Reais dos Últimos 30 Dias (~36 vendas com distribuição dinâmica)
// -----------------------------------------------------------------------------

function generateInitialGuestSales(): Sale[] {
  const sales: Sale[] = [
    // --- HOJE ---
    createSaleItem("s-01", daysAgoIso(0, 9, 15), "demo-cim-01", "Cimento Portland 32.5N Limak 50kg", 20, 580, 480, "VD-2026/0348", "Venda a Dinheiro", "Mestre Inácio Chissano", "cust-02", "M-Pesa", "Armazém Principal"),
    createSaleItem("s-02", daysAgoIso(0, 10, 30), "demo-blo-02", "Bloco de Betão 15 cm", 250, 42, 28, "VD-2026/0349", "Venda a Dinheiro", "Dona Maria Muthemba", "cust-05", "Numerário", "Pátio de Produção"),
    createSaleItem("s-03", daysAgoIso(0, 11, 45), "demo-agu-29", "Água Mineral 500 ml (Fardo c/ 24)", 5, 380, 280, "VD-2026/0350", "Venda a Dinheiro", "Consumidor Final (Balcão)", "cust-08", "M-Pesa", "Loja Principal"),
    createSaleItem("s-04", daysAgoIso(0, 13, 0), "demo-arr-26", "Arroz Vaporizado 25 kg", 4, 1350, 1150, "VD-2026/0351", "Venda a Dinheiro", "Consumidor Final (Balcão)", "cust-08", "Numerário", "Armazém Principal"),

    // --- ONTEM ---
    createSaleItem("s-05", daysAgoIso(1, 10, 0), "demo-var-04", "Varão de Aço 12 mm (12m)", 15, 690, 560, "FT-2026/0141", "Factura", "Construtora Horizonte & Filhos, Lda", "cust-01", "Transferência", "Setor Metais"),
    createSaleItem("s-06", daysAgoIso(1, 11, 20), "demo-cha-07", "Chapa de Zinco IBR 0.40mm x 6m", 20, 780, 620, "FT-2026/0142", "Factura", "Construtora Horizonte & Filhos, Lda", "cust-01", "Transferência", "Armazém B"),
    createSaleItem("s-07", daysAgoIso(1, 14, 10), "demo-tin-22", "Tinta Acrílica Branca 20 L", 3, 4950, 3800, "VD-2026/0345", "Venda a Dinheiro", "Eng. Carlos Machava", "cust-04", "POS / Cartão", "Setor Tintas"),
    createSaleItem("s-08", daysAgoIso(1, 15, 30), "demo-pre-08", "Prego de Cabeça Redonda 3\"", 10, 130, 85, "VD-2026/0346", "Venda a Dinheiro", "Mestre Inácio Chissano", "cust-02", "M-Pesa", "Prateleira F1"),

    // --- HÁ 2 DIAS ---
    createSaleItem("s-09", daysAgoIso(2, 9, 30), "demo-arr-26", "Arroz Vaporizado 25 kg", 25, 1350, 1150, "FT-2026/0140", "Factura", "Mercearia Popular da Machava", "cust-03", "M-Pesa", "Palete Alimentar 1"),
    createSaleItem("s-10", daysAgoIso(2, 10, 45), "demo-ole-27", "Óleo Vegetal 5 L", 10, 590, 490, "FT-2026/0140", "Factura", "Mercearia Popular da Machava", "cust-03", "M-Pesa", "Palete Alimentar 2"),
    createSaleItem("s-11", daysAgoIso(2, 15, 0), "demo-tub-14", "Tubo PVC Esgoto 110mm x 6m", 6, 690, 520, "VD-2026/0343", "Venda a Dinheiro", "Ferragens Polana Caniço", "cust-06", "Numerário", "Corredor Tubagens"),

    // --- HÁ 3 DIAS ---
    createSaleItem("s-12", daysAgoIso(3, 10, 0), "demo-blo-02", "Bloco de Betão 15 cm", 400, 42, 28, "GR-2026/0091", "Guia de Remessa", "Eng. Carlos Machava", "cust-04", "Transferência", "Pátio de Produção"),
    createSaleItem("s-13", daysAgoIso(3, 11, 30), "demo-are-05", "Areia Grossa de Rio", 4, 2500, 1800, "GR-2026/0091", "Guia de Remessa", "Eng. Carlos Machava", "cust-04", "Transferência", "Pátio Aberto"),
    createSaleItem("s-14", daysAgoIso(3, 14, 0), "demo-agu-29", "Água Mineral 500 ml (Fardo c/ 24)", 8, 380, 280, "VD-2026/0342", "Venda a Dinheiro", "Restaurante & Bar Zambézia", "cust-07", "Numerário", "Depósito Bebidas"),

    // --- HÁ 5 DIAS ---
    createSaleItem("s-15", daysAgoIso(5, 9, 0), "demo-cim-01", "Cimento Portland 32.5N Limak 50kg", 40, 580, 480, "FT-2026/0138", "Factura", "Construtora Horizonte & Filhos, Lda", "cust-01", "Transferência", "Armazém Principal"),
    createSaleItem("s-16", daysAgoIso(5, 11, 15), "demo-cab-18", "Cabo Elétrico Flexível 2.5mm² (100m)", 3, 2450, 1850, "VD-2026/0339", "Venda a Dinheiro", "Ferragens Polana Caniço", "cust-06", "M-Pesa", "Armazém Fechado"),
    createSaleItem("s-17", daysAgoIso(5, 16, 20), "demo-dis-19", "Disjuntor Bipolar DIN 20A", 6, 380, 240, "VD-2026/0340", "Venda a Dinheiro", "Ferragens Polana Caniço", "cust-06", "M-Pesa", "Painel Elétrico"),

    // --- HÁ 7 DIAS ---
    createSaleItem("s-18", daysAgoIso(7, 10, 0), "demo-acu-28", "Açúcar Castanho 50 kg", 6, 2850, 2450, "FT-2026/0136", "Factura", "Mercearia Popular da Machava", "cust-03", "Transferência", "Palete Alimentar 1"),
    createSaleItem("s-19", daysAgoIso(7, 11, 45), "demo-sab-30", "Sabão Azul 1 kg (Caixa c/ 20)", 4, 850, 680, "FT-2026/0136", "Factura", "Mercearia Popular da Machava", "cust-03", "Transferência", "Prateleira Limpeza"),
    createSaleItem("s-20", daysAgoIso(7, 14, 30), "demo-ver-23", "Verniz Marítimo 5 L", 2, 1750, 1250, "VD-2026/0337", "Venda a Dinheiro", "Dona Maria Muthemba", "cust-05", "Numerário", "Setor Tintas"),
    createSaleItem("s-21", daysAgoIso(7, 16, 0), "demo-rol-24", "Rolo de Pintura Anti-Gota 23cm", 3, 280, 180, "VD-2026/0337", "Venda a Dinheiro", "Dona Maria Muthemba", "cust-05", "Numerário", "Prateleira T1"),

    // --- HÁ 10 DIAS ---
    createSaleItem("s-22", daysAgoIso(10, 9, 30), "demo-cim-01", "Cimento Portland 32.5N Limak 50kg", 30, 580, 480, "VD-2026/0334", "Venda a Dinheiro", "Mestre Inácio Chissano", "cust-02", "M-Pesa", "Armazém Principal"),
    createSaleItem("s-23", daysAgoIso(10, 11, 0), "demo-var-03", "Varão de Aço 10 mm (12m)", 8, 490, 390, "VD-2026/0334", "Venda a Dinheiro", "Mestre Inácio Chissano", "cust-02", "M-Pesa", "Setor Metais"),
    createSaleItem("s-24", daysAgoIso(10, 15, 20), "demo-lam-20", "Lâmpada LED 9W E27 6500K", 12, 110, 60, "VD-2026/0335", "Venda a Dinheiro", "Consumidor Final (Balcão)", "cust-08", "Numerário", "Prateleira E2"),

    // --- HÁ 14 DIAS ---
    createSaleItem("s-25", daysAgoIso(14, 10, 15), "demo-blo-02", "Bloco de Betão 15 cm", 500, 42, 28, "FT-2026/0130", "Factura", "Construtora Horizonte & Filhos, Lda", "cust-01", "Transferência", "Pátio de Produção"),
    createSaleItem("s-26", daysAgoIso(14, 11, 30), "demo-bri-06", "Brita 1 para Betão", 5, 2850, 2100, "FT-2026/0130", "Factura", "Construtora Horizonte & Filhos, Lda", "cust-01", "Transferência", "Pátio Aberto"),
    createSaleItem("s-27", daysAgoIso(14, 14, 0), "demo-fec-10", "Fechadura de Embutir c/ Puxador", 4, 950, 650, "VD-2026/0331", "Venda a Dinheiro", "Eng. Carlos Machava", "cust-04", "POS / Cartão", "Vitrine Loja"),

    // --- HÁ 18 DIAS ---
    createSaleItem("s-28", daysAgoIso(18, 9, 45), "demo-arr-26", "Arroz Vaporizado 25 kg", 20, 1350, 1150, "FT-2026/0125", "Factura", "Mercearia Popular da Machava", "cust-03", "M-Pesa", "Palete Alimentar 1"),
    createSaleItem("s-29", daysAgoIso(18, 14, 10), "demo-agu-29", "Água Mineral 500 ml (Fardo c/ 24)", 10, 380, 280, "VD-2026/0328", "Venda a Dinheiro", "Restaurante & Bar Zambézia", "cust-07", "Numerário", "Depósito Bebidas"),
    createSaleItem("s-30", daysAgoIso(18, 16, 0), "demo-col-25", "Cola de Madeira PVA 1 kg", 3, 290, 190, "VD-2026/0329", "Venda a Dinheiro", "Consumidor Final (Balcão)", "cust-08", "Numerário", "Prateleira T2"),

    // --- HÁ 22 DIAS ---
    createSaleItem("s-31", daysAgoIso(22, 10, 0), "demo-cim-01", "Cimento Portland 32.5N Limak 50kg", 25, 580, 480, "FT-2026/0120", "Factura", "Construtora Horizonte & Filhos, Lda", "cust-01", "Transferência", "Armazém Principal"),
    createSaleItem("s-32", daysAgoIso(22, 11, 20), "demo-cha-07", "Chapa de Zinco IBR 0.40mm x 6m", 15, 780, 620, "FT-2026/0120", "Factura", "Construtora Horizonte & Filhos, Lda", "cust-01", "Transferência", "Armazém B"),
    createSaleItem("s-33", daysAgoIso(22, 15, 30), "demo-mar-11", "Martelo de Carpinteiro 500g", 2, 480, 320, "VD-2026/0322", "Venda a Dinheiro", "Mestre Inácio Chissano", "cust-02", "Numerário", "Painel Ferramentas"),

    // --- HÁ 26 DIAS ---
    createSaleItem("s-34", daysAgoIso(26, 10, 30), "demo-blo-02", "Bloco de Betão 15 cm", 300, 42, 28, "VD-2026/0318", "Venda a Dinheiro", "Dona Maria Muthemba", "cust-05", "M-Pesa", "Pátio de Produção"),
    createSaleItem("s-35", daysAgoIso(26, 14, 15), "demo-fit-13", "Fita Métrica 5m", 3, 220, 140, "VD-2026/0319", "Venda a Dinheiro", "Consumidor Final (Balcão)", "cust-08", "Numerário", "Painel Ferramentas"),

    // --- HÁ 28 DIAS ---
    createSaleItem("s-36", daysAgoIso(28, 9, 0), "demo-arr-26", "Arroz Vaporizado 25 kg", 15, 1350, 1150, "FT-2026/0115", "Factura", "Mercearia Popular da Machava", "cust-03", "Transferência", "Palete Alimentar 1"),
    createSaleItem("s-37", daysAgoIso(28, 11, 0), "demo-ole-27", "Óleo Vegetal 5 L", 8, 590, 490, "FT-2026/0115", "Factura", "Mercearia Popular da Machava", "cust-03", "Transferência", "Palete Alimentar 2"),
    createSaleItem("s-38", daysAgoIso(28, 15, 0), "demo-tor-16", "Torneira de Esfera 3/4\"", 4, 320, 210, "VD-2026/0312", "Venda a Dinheiro", "Ferragens Polana Caniço", "cust-06", "Numerário", "Gaveteiro Hidráulica"),
  ];

  return sales;
}

function createSaleItem(
  id: string,
  date: string,
  productId: string,
  productName: string,
  quantity: number,
  unitPrice: number,
  unitCost: number,
  guideNumber: string,
  documentType: Sale["documentType"],
  clientName: string,
  customerId: string,
  paymentMethod: string,
  location: string
): Sale {
  const subtotal = quantity * unitPrice;
  return {
    id,
    date,
    productId,
    productName,
    quantity,
    unitPrice,
    unitCost,
    subtotal,
    totalValue: subtotal,
    amountPaid: subtotal,
    soldBy: "Gestor Comercial",
    guideNumber,
    documentType,
    clientName,
    customerId,
    paymentMethod,
    location: guestLocation(location),
    status: "Pago"
  };
}

// -----------------------------------------------------------------------------
// Movimentos de Stock e Auditorias
// -----------------------------------------------------------------------------

export const INITIAL_GUEST_MOVEMENTS: StockMovement[] = [
  {
    id: "mov-01",
    productId: "demo-cim-01",
    productName: "Cimento Portland 32.5N Limak 50kg",
    type: "IN",
    quantity: 150,
    toLocationId: "Armazém Principal",
    reason: "Entrada Fornecedor — Limak Cimentos (Factura Forn. 8812)",
    userId: "guest-user",
    userName: "Gestor Comercial",
    timestamp: daysAgoIso(20, 9, 0),
  },
  {
    id: "mov-02",
    productId: "demo-blo-02",
    productName: "Bloco de Betão 15 cm",
    type: "IN",
    quantity: 1000,
    toLocationId: "Pátio de Produção",
    reason: "Lote de Produção Própria #142 (Vibropensada)",
    userId: "guest-user",
    userName: "Gestor Comercial",
    timestamp: daysAgoIso(15, 14, 0),
  },
  {
    id: "mov-03",
    productId: "demo-var-04",
    productName: "Varão de Aço 12 mm (12m)",
    type: "IN",
    quantity: 60,
    toLocationId: "Armazém Principal",
    reason: "Descarga de Ferro da Matola",
    userId: "guest-user",
    userName: "Gestor Comercial",
    timestamp: daysAgoIso(10, 11, 0),
  },
  {
    id: "mov-04",
    productId: "demo-blo-02",
    productName: "Bloco de Betão 15 cm",
    type: "OUT",
    quantity: 4,
    fromLocationId: "Pátio de Produção",
    reason: "Perda/Quebra no manuseio de empilhador",
    userId: "guest-user",
    userName: "Gestor Comercial",
    timestamp: daysAgoIso(8, 16, 0),
  },
  {
    id: "mov-05",
    productId: "demo-cim-01",
    productName: "Cimento Portland 32.5N Limak 50kg",
    type: "OUT",
    quantity: 1,
    fromLocationId: "Armazém Principal",
    reason: "Saco rasgado durante descarregamento",
    userId: "guest-user",
    userName: "Gestor Comercial",
    timestamp: daysAgoIso(4, 15, 0),
  },
  {
    id: "mov-06",
    productId: "demo-arr-26",
    productName: "Arroz Vaporizado 25 kg",
    type: "ADJUSTMENT",
    quantity: 0,
    toLocationId: "Armazém Principal",
    reason: "Auditoria e Contagem Física de Stock (Conferido)",
    userId: "guest-user",
    userName: "Gestor Comercial",
    timestamp: daysAgoIso(2, 10, 0),
  }
];

// -----------------------------------------------------------------------------
// Encomendas e Produção
// -----------------------------------------------------------------------------

export const INITIAL_GUEST_ORDERS: Order[] = [
  {
    id: "ord-01",
    productId: "demo-cha-07",
    productName: "Chapa de Zinco IBR 0.40mm x 6m",
    quantity: 30,
    unit: "un",
    unitPrice: 780,
    totalValue: 23400,
    clientName: "Construtora Horizonte & Filhos, Lda",
    deliveryDate: daysAgoIso(-2, 10, 0), // Entrega daqui a 2 dias
    location: "Armazém Principal",
    status: "Pendente",
    quantityProduced: 0,
    productionLogs: []
  },
  {
    id: "ord-02",
    productId: "demo-blo-02",
    productName: "Bloco de Betão 15 cm",
    quantity: 500,
    unit: "un",
    unitPrice: 42,
    totalValue: 21000,
    clientName: "Eng. Carlos Machava",
    deliveryDate: daysAgoIso(3, 14, 0),
    location: "Pátio de Produção",
    status: "Concluída",
    quantityProduced: 500,
    productionLogs: []
  }
];

export const INITIAL_GUEST_PRODUCTIONS: Production[] = [
  {
    id: "prod-01",
    date: daysAgoIso(2, 8, 30),
    productName: "Bloco de Betão 15 cm",
    quantity: 600,
    unit: "un",
    registeredBy: "Gestor Comercial",
    location: "Pátio de Produção",
    status: "Concluído"
  },
  {
    id: "prod-02",
    date: daysAgoIso(9, 8, 30),
    productName: "Bloco de Betão 15 cm",
    quantity: 800,
    unit: "un",
    registeredBy: "Gestor Comercial",
    location: "Pátio de Produção",
    status: "Concluído"
  }
];

// -----------------------------------------------------------------------------
// Notificações em Aberto (Sino de Notificações do Topo)
// -----------------------------------------------------------------------------

export const INITIAL_GUEST_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-01",
    message: "🔴 Stock Crítico: Varão de Aço 10 mm tem apenas 4 barras disponíveis.",
    date: daysAgoIso(0, 8, 0),
    read: false,
    type: "stock"
  },
  {
    id: "notif-02",
    message: "🔴 Stock Crítico: Tomada Dupla de Embutir tem apenas 2 unidades.",
    date: daysAgoIso(0, 8, 30),
    read: false,
    type: "stock"
  },
  {
    id: "notif-03",
    message: "🟡 Stock Baixo: Tinta Acrílica Branca 20 L abaixo do limite (9 baldes).",
    date: daysAgoIso(1, 14, 0),
    read: false,
    type: "stock"
  },
  {
    id: "notif-04",
    message: "💰 Nova Factura FT-2026/0141 emitida para Construtora Horizonte (6.900 MT).",
    date: daysAgoIso(1, 10, 5),
    read: true,
    type: "sale"
  },
  {
    id: "notif-05",
    message: "📋 Contagem física mensal concluída sem discrepâncias no Armazém Principal.",
    date: daysAgoIso(4, 17, 0),
    read: true,
    type: "stock"
  }
];

// -----------------------------------------------------------------------------
// Dados do convidado: guardados no aparelho; sobrevivem a sair/entrar e ao fim dos 30 minutos
// -----------------------------------------------------------------------------

function readStore<T>(name: string, seed: () => T): T {
  if (typeof window === "undefined") return seed();
  try {
    ensureSchema();
    const raw = localStorage.getItem(STORE_PREFIX + name);
    if (raw) return JSON.parse(raw) as T;
    const initial = seed();
    localStorage.setItem(STORE_PREFIX + name, JSON.stringify(initial));
    return initial;
  } catch {
    return seed();
  }
}

function writeStore<T>(name: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_PREFIX + name, JSON.stringify(value));
  } catch {
    /* ignore */
  }
  emit(GUEST_DATA_EVENT);
}

// --- Produtos ---------------------------------------------------------------

export function getGuestProducts(): Product[] {
  return readStore<Product[]>("products", () => GUEST_PRODUCTS);
}

// --- Vendas -----------------------------------------------------------------

export function getGuestSales(): Sale[] {
  return readStore<Sale[]>("sales", generateInitialGuestSales);
}

/** Regista a venda e tudo o que ela mexe: stock do produto, movimento de saída e total do cliente. */
export function addGuestSale(sale: Sale): void {
  writeStore("sales", [sale, ...getGuestSales()]);

  const products = getGuestProducts();
  const product = products.find((p) => p.id === sale.productId || p.name === sale.productName);
  writeStore(
    "products",
    products.map((p) => (p === product ? { ...p, stock: Math.max(0, p.stock - sale.quantity) } : p))
  );

  const movement: StockMovement = {
    id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    productId: product?.id || sale.productId,
    productName: sale.productName,
    type: "OUT",
    quantity: -Math.abs(sale.quantity),
    fromLocationId: sale.location || product?.location || "Armazém Principal",
    reason: `Venda ${sale.guideNumber}`,
    userId: GUEST_USER.id,
    userName: sale.soldBy || GUEST_USER.username,
    timestamp: sale.date || new Date().toISOString(),
  };
  writeStore("movements", [movement, ...getRawGuestMovements()]);

  const customers = getGuestCustomers();
  const match = customers.find((c) => (sale.customerId ? c.id === sale.customerId : c.name === sale.clientName));
  if (match) {
    writeStore(
      "customers",
      customers.map((c) =>
        c.id === match.id
          ? { ...c, totalPurchases: (c.totalPurchases || 0) + (sale.totalValue || sale.subtotal || 0), lastVisit: sale.date || new Date().toISOString() }
          : c
      )
    );
  }
}

// --- Despesas ---------------------------------------------------------------

export function getGuestExpenses(): Expense[] {
  return readStore<Expense[]>("expenses", () => INITIAL_GUEST_EXPENSES);
}

export function addGuestExpense(expense: Expense): void {
  writeStore("expenses", [expense, ...getGuestExpenses()]);
}

export function updateGuestExpense(id: string, data: Partial<Expense>): void {
  writeStore("expenses", getGuestExpenses().map((e) => (e.id === id ? { ...e, ...data } : e)));
}

export function deleteGuestExpense(id: string): void {
  writeStore("expenses", getGuestExpenses().filter((e) => e.id !== id));
}

// --- Clientes ---------------------------------------------------------------

export function getGuestCustomers(): Customer[] {
  return readStore<Customer[]>("customers", () => INITIAL_GUEST_CUSTOMERS);
}

export function addGuestCustomer(customer: Customer): void {
  writeStore("customers", [...getGuestCustomers(), customer]);
}

export function updateGuestCustomer(id: string, data: Partial<Customer>): void {
  writeStore("customers", getGuestCustomers().map((c) => (c.id === id ? { ...c, ...data } : c)));
}

export function deleteGuestCustomer(id: string): void {
  writeStore("customers", getGuestCustomers().filter((c) => c.id !== id));
}

// --- Só leitura (a demonstração não os altera) -------------------------------

/**
 * A app lê `timestamp` dos movimentos como um Timestamp do Firestore (`.toDate()`, `.toMillis()`): o dashboard e o
 * histórico rebentavam com "timestamp.toDate is not a function". No aparelho guarda-se texto ISO (o JSON não guarda
 * funções); ao ler, devolve-se um objeto com o mesmo formato do Timestamp.
 */
function fsTimestamp(v: unknown) {
  const raw = v as { seconds?: number; toDate?: () => Date } | string | number | Date | null | undefined;
  let ms = Date.now();
  if (raw instanceof Date) ms = raw.getTime();
  else if (typeof raw === "string" || typeof raw === "number") ms = new Date(raw).getTime();
  else if (raw && typeof raw.seconds === "number") ms = raw.seconds * 1000;
  if (!Number.isFinite(ms)) ms = Date.now();
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1e6,
    toDate: () => new Date(ms),
    toMillis: () => ms,
  };
}

/** Movimentos como se guardam no aparelho (timestamp em texto ISO). */
function getRawGuestMovements(): StockMovement[] {
  return readStore<StockMovement[]>("movements", () => INITIAL_GUEST_MOVEMENTS);
}

export function getGuestStockMovements(): StockMovement[] {
  return getRawGuestMovements().map((m) => ({ ...m, timestamp: fsTimestamp(m.timestamp) }));
}

export function getGuestOrders(): Order[] {
  return INITIAL_GUEST_ORDERS;
}

export function getGuestProductions(): Production[] {
  return INITIAL_GUEST_PRODUCTIONS;
}

export function getGuestNotifications(): AppNotification[] {
  return INITIAL_GUEST_NOTIFICATIONS;
}

// Helper date generator
function daysAgoIso(days: number, hour = 11, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
