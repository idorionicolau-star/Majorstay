
export type PermissionLevel = 'none' | 'read' | 'write';

export type ModulePermission =
  | 'dashboard'
  | 'diagnostico'
  | 'inventory'
  | 'sales'
  | 'customers'
  | 'production'
  | 'raw-materials'
  | 'finance'
  | 'orders'
  | 'reports'
  | 'users'
  | 'settings';

// This is the User Map object for quick lookups.
export type UserMap = {
  companyId: string;
}

export type Employee = {
  id: string;
  username: string;
  email: string; // This is the full login email
  password?: string; // Should be handled securely, never stored in plain text
  role: 'Admin' | 'Employee' | 'Dono';

  companyId: string;
  permissions: Partial<Record<ModulePermission, PermissionLevel>>;
  profilePictureUrl?: string; // URL for the profile picture
  /** Ponto onde trabalha: só vê e vende o stock das localizações desse ponto (vazio = vê tudo). */
  site?: string;
};

export type NotificationEmail = {
  email: string;
  onSale: boolean;
  onCriticalStock: boolean;
  onEndOfDayReport: boolean;
};

export type NotificationSettings = {
  // Legacy fields for backward compatibility, optional now
  email?: string;
  onSale?: boolean;
  onCriticalStock?: boolean;

  // New multi-email structure
  emails?: NotificationEmail[];
  /** Hora (Maputo) do relatório do fim do dia: uma de REPORT_TIMES; sem valor = 21:30 */
  endOfDayTime?: string;
};

export type Company = {
  id: string;
  name: string;
  /** Transferências com confirmação de receção (fica em trânsito até o destino confirmar). */
  confirmTransfers?: boolean;
  ownerId?: string; // Optional: To track the original creator
  phone?: string;
  address?: string;
  taxId?: string;
  email?: string;
  businessType: 'manufacturer' | 'reseller';
  /** Dias que o produto fica a secar antes de se poder carregar (betão: 3). 0 = não se usa. */
  curingDays?: number;
  /** Lembrete de contagem do stock: a cada N dias (por defeito 30). Ver lib/followups-core.ts */
  countEveryDays?: number;
  /** false = não quer emails de dicas (primeiros passos, falta de uso, contagem). Os avisos de prazos vão sempre. */
  emailTips?: boolean;
  /** Última vez que alguém da empresa abriu a app (gravado pelo servidor, /api/activity). */
  lastActiveAt?: string;
  notificationSettings?: NotificationSettings;
  isMultiLocation?: boolean;
  locations?: Location[];
  saleCounter?: number;
  documentNumbering?: Record<string, {
    prefix: string;
    separator: string;
    nextNumber: number;
    padding: number;
  }>;
  validUnits?: string[];
  validCategories?: string[]; // Also adding categories while we are at it, for future proofing or if we want to migrate catalogCategories to here.
  logoUrl?: string; // Base64 Data URL for the company logo, displayed in email headers
  signatureUrl?: string; // Base64 Data URL or Firebase Storage URL for the signature/stamp
  paymentInfo?: string; // Text containing bank accounts, M-Pesa, etc.
  /** Aspecto por defeito dos documentos exportados (ver doc-themes.ts) */
  documentTheme?: import('./doc-themes').DocThemeId;
  documentAccent?: string; // "#rrggbb"
  documentFooterNote?: string;
  documentSignaturePlace?: string; // ex.: "Maputo"
  documentShowSignatures?: boolean;
  /** assinatura do cliente nos documentos (desligada por defeito) */
  documentShowClientSignature?: boolean;
  status?: 'active' | 'trial' | 'suspended';
  trialEndsAt?: string;
  /** Quando o teste foi (re)iniciado: empresas novas ao registar; antigas no reinício único. Se existir, não há novo reinício. */
  trialRestartedAt?: string;
  subscriptionEndsAt?: string;
  /** Código de convite/desconto (gravado só pelo servidor; serve para mostrar e lembrar). Ver lib/coupon-core.ts */
  coupon?: import('@/lib/coupon-core').CompanyCoupon;
  /** Numeric copy (end + grace) used by Firestore rules */
  paidUntilMs?: number;
  plan?: string;
  /** Nível da subscrição (Básico/Pro/Business). Sem nível = plano antigo, tudo incluído. Só o servidor/super-admin grava. Ver lib/tiers.ts */
  tier?: string;
  /** Quando o responsável confirmou o email (pedido antes da primeira venda real; ver lib/email-confirm.ts). */
  emailVerifiedAt?: string;
  /** De onde veio a empresa: "escalepay" = registou-se pelo link dos afiliados (ver lib/escalepay-core.ts). */
  source?: string;
  /** Arranque oficial: quando se apagaram os registos anteriores (só uma vez). */
  dataResetAt?: string;
};

export type Location = {
  id: string;
  name: string;
  /** Ponto (loja/sítio) a que pertence, ex.: "Matola". Agrupa as localizações e limita o que cada vendedor vê. */
  site?: string;
};

export type Product = {
  id?: string; // Document ID from Firestore
  instanceId: string; // Temporary UI-only ID for React keys
  sourceIds?: string[]; // To track merged documents
  name: string;
  category: string;
  stock: number;
  reservedStock: number;
  price: number;
  lowStockThreshold: number;
  criticalStockThreshold: number;
  lastUpdated: string;
  location?: string;
  unit?: string;
  cost?: number;
  deletedAt?: string;
  deletedBy?: string;
  imageUrl?: string;
  thresholdMode?: 'auto' | 'manual';
  ads?: number;
  targetStock?: number;
  /** Código de barras (EAN/UPC/Code128…) — lido com a câmara ou um leitor */
  barcode?: string;
  /** Catálogo: últimas alterações de preço (mais recente no fim; no máximo 20). */
  priceHistory?: { at: string; from: number; to: number; by?: string }[];
  /** Variações: o nome base da família ("Pavê Borbulha") e o valor de cada tipo ({ Cor: "Vermelho" }). Ver lib/variants.ts */
  variantGroup?: string;
  variantValues?: Record<string, string>;
  /** Variação com custo mudado à mão: o custo da família ("Editar família") já não o substitui. */
  ownCost?: boolean;
  /** Nomes que o produto já teve (ver lib/rename.ts): o histórico com esses nomes aparece com o nome actual. */
  formerNames?: string[];
};


export type RawMaterial = {
  id: string;
  name: string;
  stock: number;
  unit: string;
  lowStockThreshold: number;
  cost?: number;
};

export type RecipeIngredient = {
  rawMaterialId: string;
  rawMaterialName: string;
  quantity: number;
  yieldPerUnit?: number; // How many finished products 1 unit of this material produces (e.g., 1 bag → 75 grelhas)
};

export type Recipe = {
  id: string;
  productName: string;
  ingredients: RecipeIngredient[];
};

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  totalPurchases: number;
  lastVisit: string;
  notes?: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  status: 'Pago' | 'Pendente';
  registeredBy: string;
};

export type Sale = {
  id: string;
  orderId?: string;
  date: string;
  productId: string;
  productName: string;
  deletedAt?: string;
  deletedBy?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  unitCost?: number;
  subtotal: number;
  discount?: number;
  vat?: number;
  totalValue: number;
  amountPaid?: number;
  soldBy: string;
  guideNumber: string;
  location?: string;
  customerId?: string; // Link to Customer
  status: 'Pago' | 'Levantado' | 'Pendente';
  documentType: 'Venda a Dinheiro' | 'Guia de Remessa' | 'Factura' | 'Factura Proforma' | 'Recibo' | 'Encomenda' | 'Cotação';
  clientName?: string; // Legacy field, allow keep for history
  notes?: string;
  transactionId?: string; // For grouping multi-item sales
  paymentMethod?: string;
  timestamp?: any; // Firestore serverTimestamp or Date
  /** Venda feita sem internet: o guideNumber é provisório (OFF-…) até ser numerada ao sincronizar. */
  offlinePending?: boolean;
  /** Número provisório que a venda teve antes de receber o oficial. */
  provisionalNumber?: string;
};

export type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  originalCost?: number;
  unit?: string;
  location?: string;
  subtotal: number;
};

export type Production = {
  id: string;
  date: string;
  productName: string;
  quantity: number;
  unit?: string;
  registeredBy: string;
  location?: string;
  status: 'Concluído' | 'Transferido';
  orderId?: string;
  deletedAt?: string;
  deletedBy?: string;
  /** Notas livres (ex.: "foram usados 3 sacos, faltou água"). */
  notes?: string;
  /** Matéria-prima realmente gasta (pré-preenchida pela receita, corrigível). Apagar/editar usa estes valores. */
  materialsUsed?: { rawMaterialId: string; name: string; quantity: number; unit?: string }[];
};

/** Edição de uma produção já registada (ver editProduction). */
export type ProductionEdit = {
  productName: string;
  quantity: number;
  unit?: string;
  date: string;
  location?: string;
  notes?: string;
  materialsUsed: { rawMaterialId: string; name: string; quantity: number; unit?: string }[];
};

export type ProductionLog = {
  id: string;
  date: string;
  quantity: number;
  notes?: string;
  registeredBy: string;
};

export type Order = {
  id: string;
  productId: string; // This can be the name or a catalog ID
  productName: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalValue?: number;
  clientName?: string;
  deliveryDate?: string;
  location?: string;
  status: 'Pendente' | 'Em produção' | 'Concluída' | 'Entregue';
  /** Quanto esta encomenda reservou no stock ao ser registada (para libertar o certo). Ausente nas antigas. */
  reservedQuantity?: number;
  productionStartDate?: string | null;
  /** Produzido para a encomenda e ainda no stock (o que o cliente leva antes sai daqui primeiro) */
  quantityProduced: number;
  /** Quanto o cliente já levou (levantamentos parciais); o resto sai em "Entregar" */
  quantityDelivered?: number;
  deliveries?: { date: string; quantity: number; by: string }[];
  productionLogs: ProductionLog[];
  deletedAt?: string;
  deletedBy?: string;
};

export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';

export interface StockMovement {
  id?: string;
  productId: string;
  productName: string; // Denormalized name for easier log reading
  type: MovementType;
  quantity: number; // e.g., +10 for IN, -5 for OUT
  fromLocationId?: string; // Used in TRANSFER and OUT
  toLocationId?: string;   // Used in TRANSFER and IN
  reason: string;          // e.g., "Venda #102", "Auditoria", "Dano", "Transferência"
  userId: string;          // Who performed the action
  userName: string;        // Denormalized name for quick log reading
  timestamp: any;          // Firestore serverTimestamp

  // For Audits
  isAudit?: boolean;
  systemCountBefore?: number; // What the system thought it had before adjustment
  physicalCount?: number;     // What the user actually counted
}

export type AppNotification = {
  id: string;
  message: string;
  date: string;
  read: boolean;
  type: 'stock' | 'sale' | 'production' | 'order';
  href?: string;
};

export type NavItem = {
  title: string;
  href: string;
  id: ModulePermission | string; // Allow string for sub-routes like history
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  adminOnly?: boolean;
  isSubItem?: boolean;
  /** Secção do menu (por tarefa). */
  group?: NavGroup;
  /** Outras páginas que pertencem a esta entrada (abas da mesma secção): acendem-na e usam o seu título. */
  also?: string[];
  /** Sem permissão para a página principal, mas com esta: a entrada abre a outra aba (ex.: só Financeiro). */
  fallback?: { id: ModulePermission; href: string };
  /** Não está no plano da empresa: aparece com cadeado e a página convida a mudar de plano. */
  locked?: boolean;
};

export type NavGroup = 'inicio' | 'vender' | 'stock' | 'pessoas' | 'dinheiro' | 'ajustes';

export type InitialCatalog = {
  [category: string]: {
    [subType: string]: string[];
  };
};

export type DashboardStats = {
  monthlySalesValue: number;
  averageTicket: number;
  totalInventoryValue: number;
  totalItemsInStock: number;
  pendingOrders: number;
  readyForTransfer: number;
};

export interface ModelInfo {
  name: string;
  displayName: string;
  description: string;
  version: string;
}

export type ChatMessage = {
  role: 'user' | 'model';
  text: string;
};

export interface InventoryContextType {
  /** Sessão de convidado (empresa fictícia, sem Firebase). */
  isGuest: boolean;
  // Auth related
  user: Employee | null;
  firebaseUser: any | null;
  companyId: string | null;
  loading: boolean;
  isReadOnly: boolean;
  isTrial: boolean;
  daysLeft: number;
  renewInDays?: number | null;
  subscriptionReason?: 'trial_expired' | 'suspended' | 'expired' | null;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean | { noCompany: string }>;
  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<boolean>;
  registerCompany: (companyName: string, adminUsername: string, adminEmail: string, adminPass: string, businessType: 'manufacturer' | 'reseller') => Promise<boolean | 'existing'>;
  registerCompanyWithGoogle: (companyName: string, businessType: 'manufacturer' | 'reseller') => Promise<boolean>;
  profilePicture: string | null;
  setProfilePicture: (url: string) => void;

  // Permission helpers
  canView: (module: ModulePermission) => boolean;
  canEdit: (module: ModulePermission) => boolean;

  // Data related
  products: Product[];
  allProducts: Product[];
  sales: Sale[];
  allSales: Sale[];
  productions: Production[];
  allProductions: Production[]; // Included for Recycle Bin
  orders: Order[];
  allOrders: Order[]; // Included for Recycle Bin
  stockMovements: StockMovement[];
  catalogProducts: CatalogProduct[];
  /** Catálogo incluindo os produtos na lixeira (para a Lixeira). */
  allCatalogProducts: CatalogProduct[];
  catalogCategories: CatalogCategory[];
  rawMaterials: RawMaterial[];
  recipes: Recipe[];
  locations: Location[];
  isMultiLocation: boolean;
  companyData: Company | null;
  /** Todas as localizações (as `locations` são só as do ponto de quem está a usar, se tiver um). */
  allLocations: Location[];
  businessStartDate: Date | null;
  notifications: AppNotification[];
  monthlySalesChartData: { name: string; vendas: number }[];
  dashboardStats: DashboardStats;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;


  // Functions
  addProduct: (
    newProductData: Omit<
      Product,
      'id' | 'lastUpdated' | 'instanceId' | 'reservedStock' | 'sourceIds'
    >
  ) => Promise<void>;
  updateProduct: (instanceId: string, updatedData: Partial<Product>) => Promise<void>;
  deleteProduct: (instanceId: string) => void;
  updateProductStock: (
    productName: string,
    quantity: number,
    locationId?: string
  ) => Promise<void>;
  auditStock: (product: Product, newQuantity: number, reason: string) => Promise<void>;
  transferStock: (productName: string, fromLocationId: string, toLocationId: string, quantity: number, opts?: { silent?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  updateCompany: (details: Partial<Company>) => Promise<void>;
  addSale: (newSaleData: Omit<Sale, 'id' | 'guideNumber'>, reserveStock?: boolean) => void;
  addBulkSale: (
    items: CartItem[],
    saleData: {
      customerId?: string;
      clientName?: string;
      documentType: Sale['documentType'];
      notes?: string;
      discount?: { type: 'fixed' | 'percentage'; value: number };
      applyVat: boolean;
      vatPercentage: number;
      isPickedUp?: boolean;
      /** ISO date for sales registered late (defaults to now) */
      date?: string;
      /** Numerário, M-Pesa, e-Mola, Transferência, POS… (defaults to Numerário) */
      paymentMethod?: string;
      /** Amount received now; less than the total leaves the rest as debt (defaults to full) */
      amountPaid?: number;
    }
  ) => Promise<Sale[] | void>;
  confirmSalePickup: (sale: Sale) => void;
  deleteSale: (saleId: string) => void;
  addProductionLog: (orderId: string, logData: { quantity: number; notes?: string; }) => void;
  addProduction: (data: Omit<Production, 'id' | 'date' | 'registeredBy' | 'status'> & { date?: string }, opts?: { silent?: boolean }) => Promise<void>;
  editProduction: (productionId: string, data: ProductionEdit) => Promise<void>;
  updateProduction: (productionId: string, data: Partial<Production>) => void;
  deleteProduction: (productionId: string) => void;
  deleteOrder: (orderId: string) => void;
  finalizeOrder: (orderId: string, finalPayment: number) => Promise<void>;
  deliverOrderPart: (orderId: string, qty: number) => Promise<boolean>;

  clearProductsCollection: () => Promise<void>;
  markNotificationAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void;
  /** Acerta o reservado com as vendas por levantar e as encomendas. `only`: ids dos documentos de produto a corrigir. */
  recalculateReservedStock: (only?: string[]) => Promise<void>;
  /** Vendas feitas sem internet que ainda não receberam o número oficial. */
  pendingOfflineSales: number;
  syncOfflineSales: () => Promise<void>;
  /** Anti-theft alerts to managers (feed + push). Ignored when the actor is a manager unless `always`. */
  notifyManagers: (msg: { title: string; body: string; link?: string; type?: string; dedupeId?: string; always?: boolean }) => void;
  addCatalogProduct: (productData: Omit<CatalogProduct, 'id'>) => Promise<void>;
  addCatalogCategory: (categoryName: string) => Promise<void>;
  /** Move produtos do catálogo para a lixeira (podem ser restaurados). Devolve quantos moveu. */
  deleteCatalogProducts: (ids: string[]) => Promise<number>;
  /** Altera vários produtos do catálogo de uma vez (em lotes). Devolve quantos alterou. */
  updateCatalogProducts: (updates: { id: string; data: Partial<CatalogProduct> }[]) => Promise<number>;
  /** Apaga uma categoria — só se estiver vazia. Devolve true se apagou. */
  deleteCatalogCategory: (categoryId: string) => Promise<boolean>;

  // Raw Materials & Recipes
  addRawMaterial: (material: Omit<RawMaterial, 'id'>) => Promise<void>;
  createRawMaterial: (material: Omit<RawMaterial, 'id'>) => Promise<string>;
  updateRawMaterial: (materialId: string, data: Partial<RawMaterial>) => Promise<void>;
  deleteRawMaterial: (materialId: string) => Promise<void>;
  addRecipe: (recipe: Omit<Recipe, 'id'>) => Promise<void>;
  updateRecipe: (recipeId: string, data: Partial<Recipe>) => Promise<void>;
  // deleteRecipe: (recipeId: string) => Promise<void>;
  categorizeProductWithAI: (productName: string) => Promise<string | null>;

  mergeProducts: (targetProductId: string, sourceProductIds: string[]) => Promise<void>;
  /** Muda o nome em todo o programa (catálogo, stock, receitas, encomendas em aberto). Ver lib/rename.ts */
  renameProduct: (oldName: string, newName: string, opts?: { family?: boolean; set?: { variantGroup?: string; variantValues?: Record<string, string> } }) => Promise<boolean>;
  /** Um produto solto passa a ser uma variação que já existe no catálogo (ver lib/rename.ts). */
  mergeIntoVariant: (fromName: string, targetName: string) => Promise<boolean>;
  restoreItem: (collectionName: string, id: string) => Promise<void>;
  hardDelete: (collectionName: string, id: string) => Promise<void>;
  exportCompanyData: () => Promise<void>;

  // Settings / Metadata
  availableUnits: string[];
  addUnit: (unit: string) => Promise<void>;
  editUnit: (oldUnit: string, newUnit: string) => Promise<void>;
  removeUnit: (unit: string) => Promise<void>;

  availableCategories: string[];
  addCategory: (category: string) => Promise<void>;
  editCategory: (oldCategory: string, newCategory: string) => Promise<void>;
  removeCategory: (category: string) => Promise<void>;
  syncSmartThresholds: (mode?: boolean | 'silent') => Promise<void>;
  /** Põe os produtos indicados em limites automáticos. */
  setAutoThresholds: (products: Product[]) => Promise<void>;
  confirmAction: (action: () => Promise<void>, title?: string, message?: string) => void;
}

type CatalogProduct = Omit<
  Product,
  'stock' | 'instanceId' | 'reservedStock' | 'location' | 'lastUpdated'
>;

export type CatalogCategory = { id: string; name: string };
