/**
 * Major Assistant — offline. Answers questions about the business from the data already on the
 * device (Firestore local cache). No internet, no API key, no cost, instant.
 */
import type { Customer, Location, Order, Product, Production, Sale, StockMovement } from "@/lib/types";
import { analyzeBusiness, isLearning, rateLabel, runoutLabel, type Analysis } from "@/lib/business-analysis";
import { searchProducts } from "@/lib/quick-stock";
import { formatCurrency, normalizeString, plural } from "@/lib/utils";

export type AssistantData = {
    products: Product[];
    sales: Sale[];
    orders: Order[];
    productions: Production[];
    customers: Customer[];
    stockMovements: StockMovement[];
    locations: Location[];
    companyName?: string;
    userName?: string;
};

export const ASSISTANT_SUGGESTIONS = [
    "O que devo fazer hoje?",
    "Alertas críticos",
    "Vendas deste mês",
    "O que vai esgotar?",
    "Quem me deve dinheiro?",
    "Stock de pavê",
];

const n = (s: string) => normalizeString(s || "").replace(/[?!.,;:]/g, " ").replace(/\s+/g, " ").trim();
const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));
const word = (q: string, ...words: string[]) => words.some((w) => new RegExp(`(^| )${w}( |$)`).test(q));
const qty = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const list = (items: string[], max = 8) =>
    items.slice(0, max).map((i) => `- ${i}`).join("\n") + (items.length > max ? `\n- … e mais ${items.length - max}` : "");

const STOP = new Set(
    "o a os as de do da dos das e em no na nos nas um uma quanto quantos quantas qual quais tenho temos ha há stock estoque existe existem preco preço custa custo tem ainda sobre me diz diga mostra mostre ver quero saber do produto artigo artigos produtos de para por favor".split(" ")
);

export function answerOffline(question: string, data: AssistantData, cached?: Analysis): string {
    const a = cached ?? analyzeBusiness(data);
    const q = n(question);
    const locName = (id?: string) => data.locations.find((l) => l.id === id)?.name || id || "—";

    // ---------- greetings / help ----------
    if (!q || /^(ola|oi|bom dia|boa tarde|boa noite|hello|hey)\b/.test(q)) {
        return `Olá${data.userName ? `, ${data.userName.split(" ")[0]}` : ""}! 👋 Trabalho **sem internet**, com os dados que já estão neste aparelho.\n\n${today(a)}\n\n${help()}`;
    }
    if (has(q, "ajuda", "o que podes", "o que sabes", "como funcionas", "comandos")) return help();

    // ---------- what to do today ----------
    if (has(q, "o que devo fazer", "fazer hoje", "prioridade", "por onde comecar", "plano do dia", "resumo do dia", "bom dia")) {
        return today(a);
    }

    // ---------- alerts ----------
    if (has(q, "alerta", "critic", "urgente", "problema", "atencao")) {
        const al = a.alerts.filter((x) => x.severity !== "good");
        if (!al.length) return "🟢 Sem alertas importantes neste momento. Continue a registar vendas, produção e contagens.";
        return `### 🚨 Alertas (${al.length})\n\n` + al.slice(0, 6).map((x) => {
            const icon = x.severity === "critical" ? "🔴" : x.severity === "warning" ? "🟠" : "🔵";
            return `${icon} **${x.title}**\n${x.detail}${x.items?.length ? "\n" + list(x.items, 4) : ""}`;
        }).join("\n\n");
    }

    // ---------- debts / receivables ----------
    if (has(q, "deve", "divida", "receber", "fiado", "credito", "pagamento em falta", "nao pagou")) {
        const r = a.sales.receivablesList;
        if (!r.length) return "✅ Ninguém lhe deve dinheiro — todas as vendas registadas estão pagas.";
        return `### 💰 Por receber: ${formatCurrency(a.sales.receivables)}\n\n${list(r.map((x) => `**${x.client}** — ${formatCurrency(x.amount)} (guia ${x.guide || "—"}, há ${x.days} dias)`))}`;
    }

    // ---------- pickups / reservations ----------
    if (has(q, "levantar", "levantamento", "reservad", "reserva")) {
        const p = a.stock.pendingPickups;
        const ready = a.orders.readyForPickup;
        if (!p.length && !ready.length) return "✅ Não há vendas pagas nem encomendas prontas à espera de levantamento.";
        let md = "";
        if (p.length) md += `### 📦 Vendas pagas por levantar (${p.length})\n${list(p.map((x) => `${x.sale.productName} × ${qty(x.sale.quantity)} — ${x.sale.clientName || "cliente"} (há ${x.days} dias)`))}\n\nConfirme em **Histórico de Vendas → ✔ Confirmar levantamento**.\n\n`;
        if (ready.length) md += `### 🏗️ Encomendas prontas (${ready.length})\n${list(ready.map((o) => `${o.productName} × ${qty(o.quantity)} — ${o.clientName || "cliente"}`))}\n\nEntregue em **Encomendas → Finalizar / Levantar**.`;
        return md.trim();
    }

    // ---------- orders ----------
    if (has(q, "encomenda", "pedido")) {
        const o = a.orders;
        if (!o.open.length) return "Não há encomendas em aberto.";
        return `### 🧾 Encomendas em aberto: ${o.open.length}\n` +
            (o.overdue.length ? `\n🔴 **${o.overdue.length} atrasada(s):**\n${list(o.overdue.map((x) => `${x.productName} — ${x.clientName || "cliente"} (entrega ${fmtDate(x.deliveryDate)})`))}\n` : "") +
            `\n${list(o.open.map((x) => `${x.productName}: ${qty(x.quantityProduced || 0)}/${qty(x.quantity)} ${x.unit || ""} · ${x.status} · ${x.clientName || "cliente"}`))}`;
    }

    // ---------- runout / out of stock ----------
    if (has(q, "esgot", "acabar", "vai acabar", "rutura", "ruptura", "falta", "repor", "produzir", "reabastec")) {
        let md = "";
        { const soon = a.stock.runout.filter((r) => r.available > 0 && !isLearning(r)); if (soon.length) md += `### ⏳ Vão esgotar em ≤ 14 dias\n${list(soon.map((r) => `**${r.name}** — ${runoutLabel(r.daysLeft)} (${qty(r.available)} ${r.unit}, vende ${rateLabel(r.soldPerDay, r.unit)})`))}\n\n`; }
        if (a.stock.outOfStock.length) md += `### ❌ Esgotados (${a.stock.outOfStock.length})\n${list(a.stock.outOfStock.map((p) => `${p.name}${data.locations.length > 1 ? ` · ${locName(p.location)}` : ""}`))}\n\n`;
        if (a.stock.critical.length) md += `### 🟠 Nível crítico (${a.stock.critical.length})\n${list(a.stock.critical.map((p) => `${p.name}: ${qty(p.stock - p.reservedStock)} ${p.unit || "un"}`))}`;
        if (!md) md = "✅ Nada esgotado nem a acabar ao ritmo actual de vendas.";
        if (a.sales.daysSinceLastSale === null || a.sales.daysSinceLastSale > 7) md += `\n\n⚠️ Sem vendas recentes registadas, não consigo prever o que vai acabar. Registe as vendas para esta previsão funcionar.`;
        return md.trim();
    }

    // ---------- top products ----------
    if (has(q, "mais vendid", "campeo", "melhor produto", "mais vende") || word(q, "top")) {
        const t = a.sales.topProducts30;
        if (!t.length) return `Não há vendas registadas nos últimos 30 dias${a.sales.lastSaleDate ? ` (última em ${fmtDate(a.sales.lastSaleDate)})` : ""}. Registe as vendas em **Venda Rápida** para eu mostrar os campeões.`;
        return `### 🏆 Mais vendidos (30 dias)\n${t.map((x, i) => `${i + 1}. **${x.name}** — ${qty(x.qty)} ${x.unit}, ${formatCurrency(x.revenue)}`).join("\n")}`;
    }

    // ---------- sellers ----------
    if (has(q, "vendedor", "funcionario", "quem vendeu", "equipa")) {
        const s = a.sales.topSellers30;
        if (!s.length) return "Sem vendas nos últimos 30 dias.";
        return `### 👷 Vendas por funcionário (30 dias)\n${s.map((x) => `- **${x.name}** — ${formatCurrency(x.revenue)} em ${plural(x.tickets, "venda", "vendas")}`).join("\n")}`;
    }

    // ---------- profit / margin ----------
    if (has(q, "lucro", "margem", "ganho", "rentab")) {
        const m = a.sales.margin30;
        if (a.sales.last30 === 0) return `Sem vendas registadas nos últimos 30 dias, por isso não há lucro para calcular.${a.sales.lastSaleDate ? ` A última venda foi em ${fmtDate(a.sales.lastSaleDate)}.` : ""}`;
        if (m === null) return `Não consigo calcular o lucro: **${a.quality.missingCost.length} produtos não têm custo** preenchido. Complete o custo em Inventário → editar produto e eu passo a mostrar o lucro real.`;
        return `### 📈 Lucro bruto (30 dias)\n- Lucro: **${formatCurrency(m)}**\n- Margem: **${a.sales.marginPct30?.toFixed(0)}%**\n\n_Só conta vendas de produtos com custo preenchido (${a.quality.missingCost.length} ainda sem custo)._`;
    }

    // ---------- sales ----------
    if (has(q, "venda", "vendi", "faturado", "facturado", "faturacao", "facturacao", "receita", "dinheiro") || word(q, "hoje", "semana", "mes")) {
        const s = a.sales;
        if (word(q, "hoje")) return `### 💵 Hoje\n**${formatCurrency(s.today)}** em ${plural(s.todayTickets, "venda", "vendas")}.${s.todayTickets === 0 ? "\n\nAinda nenhuma venda registada hoje. Se já vendeu, registe em **Venda Rápida** para o stock ficar certo." : ""}`;
        if (word(q, "semana")) return `### 💵 Últimos 7 dias\n**${formatCurrency(s.last7)}**`;
        let md = `### 💵 Vendas\n- Hoje: **${formatCurrency(s.today)}** (${s.todayTickets})\n- Este mês: **${formatCurrency(s.month)}** (${s.monthTickets} vendas)\n- Mês passado: **${formatCurrency(s.lastMonth)}**\n- Últimos 30 dias: **${formatCurrency(s.last30)}**`;
        if (s.growth30 !== null) md += ` (${s.growth30 >= 0 ? "+" : ""}${s.growth30.toFixed(0)}% vs. 30 dias anteriores)`;
        if (s.month > 0) md += `\n- Previsão para o fim do mês: **${formatCurrency(s.projectedMonth)}**`;
        if (s.avgTicket30) md += `\n- Valor médio por venda: **${formatCurrency(s.avgTicket30)}**`;
        if (s.daysSinceLastSale !== null && s.daysSinceLastSale > 7) md += `\n\n⚠️ A última venda registada foi há **${s.daysSinceLastSale} dias** (${fmtDate(s.lastSaleDate)}). Se tem vendido, estes números estão abaixo da realidade.`;
        return md;
    }

    // ---------- production ----------
    if (has(q, "producao", "produzido", "fabric")) {
        const p = a.production;
        return `### 🏗️ Produção\n- Última produção registada: **${p.lastDate ? fmtDate(p.lastDate) : "nunca"}**${p.daysSince !== null ? ` (há ${p.daysSince} dias)` : ""}\n- Produzido nos últimos 30 dias: **${qty(p.last30Qty)}** unidades\n${p.daysSince !== null && p.daysSince > 14 ? "\n⚠️ O que foi fabricado e não registado não aparece no stock. Registe em **Produção → +**." : ""}`;
    }

    // ---------- dead stock ----------
    if (has(q, "parado", "encalhado", "sem vendas", "nao vende", "liquidar", "promoc")) {
        if (a.sales.daysSinceLastSale === null || a.sales.daysSinceLastSale > 30)
            return "Não dá para saber o que está parado: **não há vendas registadas** no último mês. Tudo parece parado porque as vendas não estão a entrar no sistema. Registe as vendas primeiro.";
        const d = a.stock.dead;
        return `### 🧊 Stock parado (90 dias sem vendas)\n**${formatCurrency(d.value)}** em ${d.count} produtos (${d.pctOfValue}% do valor em armazém).\n${list(d.examples)}\n\nIdeias: pacote com um produto campeão, desconto por volume, ou oferecer a construtoras.`;
    }

    // ---------- customers ----------
    if (has(q, "cliente")) {
        const c = a.customers;
        let md = `### 👥 Clientes\n- Registados: **${c.total}**`;
        if (c.missingContact) md += `\n- Sem telefone nem email: **${c.missingContact}**`;
        if (c.anonymousSalesPct !== null) md += `\n- Vendas sem nome de cliente (30 dias): **${c.anonymousSalesPct}%**`;
        if (c.inactive.length) md += `\n\n**Bons clientes que não voltam há +45 dias:**\n${list(c.inactive.map((x) => `${x.name}${x.phone ? ` · ${x.phone}` : ""} — ${formatCurrency(x.totalPurchases || 0)} em compras`), 5)}\n\n💡 Uma mensagem hoje pode trazer uma venda.`;
        return md;
    }

    // ---------- data quality ----------
    if (has(q, "dados", "qualidade", "o que falta", "completar", "preencher")) {
        return `### ✅ Qualidade dos dados: ${a.quality.score}%\n${a.quality.tasks.map((t) => `${t.done ? "✅" : "⬜"} **${t.label}** — ${t.detail}`).join("\n")}`;
    }

    // ---------- stock value / summary ----------
    if (has(q, "valor do stock", "valor em armazem", "quanto vale", "resumo do stock", "resumo de stock", "inventario", "armazem")) {
        return stockSummary(a);
    }

    // ---------- product lookup ----------
    const term = productTerm(q);
    if (term) {
        const found = searchProducts(data.products, term, 12);
        if (found.length) {
            const byName = new Map<string, Product[]>();
            found.forEach((p) => {
                const k = `${normalizeString(p.name)}|${p.unit || "un"}`;
                byName.set(k, [...(byName.get(k) || []), p]);
            });
            const blocks = Array.from(byName.values()).slice(0, 6).map((ps) => {
                const total = ps.reduce((t, p) => t + (p.stock || 0) - (p.reservedStock || 0), 0);
                const unit = ps[0].unit || "un";
                const perLoc = ps.length > 1 || data.locations.length > 1
                    ? "\n" + ps.map((p) => `  - ${locName(p.location)}: ${qty((p.stock || 0) - (p.reservedStock || 0))} ${unit}${p.reservedStock ? ` (+${qty(p.reservedStock)} reservado)` : ""}`).join("\n")
                    : "";
                const price = ps[0].price ? ` · ${formatCurrency(ps[0].price)}/${unit}` : " · ⚠️ sem preço";
                return `- **${ps[0].name}** — **${qty(total)} ${unit}** disponível${price}${perLoc}`;
            });
            return `### 📦 Stock\n${blocks.join("\n")}`;
        }
    }

    // ---------- fallback ----------
    return `Não percebi bem a pergunta. 🤔\n\n${help()}`;
}

function productTerm(q: string): string {
    const words = q.split(" ").filter((w) => w && !STOP.has(w));
    return words.join(" ");
}

function stockSummary(a: Analysis) {
    const s = a.stock;
    return `### 📦 Stock\n- **${s.productCount}** produtos · valor a preço de venda **${formatCurrency(s.valueAtPrice)}**${s.valueAtCost !== null ? ` · a custo ${formatCurrency(s.valueAtCost)}` : ""}\n- Esgotados: **${s.outOfStock.length}** · Críticos: **${s.critical.length}** · Baixos: **${s.low.length}**\n- Reservado para clientes: ${plural(s.pendingPickups.length, "venda", "vendas")} por levantar\n- Última contagem: **${s.lastCountDate ? fmtDate(s.lastCountDate) : "nunca feita"}**`;
}

function today(a: Analysis): string {
    const todo: string[] = [];
    a.alerts.filter((x) => x.severity === "critical").forEach((x) => todo.push(`🔴 ${x.title} → ${x.action?.label || ""}`));
    a.quality.tasks.filter((t) => !t.done).sort((x, y) => y.weight - x.weight).slice(0, 3).forEach((t) => todo.push(`⬜ ${t.label} — ${t.detail}`));
    a.alerts.filter((x) => x.severity === "warning").slice(0, 3).forEach((x) => todo.push(`🟠 ${x.title}`));
    if (!todo.length) return "🟢 Está tudo em dia. Bom trabalho! Registe as vendas e a produção ao longo do dia.";
    return `### 📋 Para hoje\n${todo.slice(0, 6).map((t, i) => `${i + 1}. ${t}`).join("\n")}`;
}

function help(): string {
    return `Pode perguntar, por exemplo:\n- **"O que devo fazer hoje?"**\n- **"Alertas críticos"**\n- **"Vendas deste mês"** / **"vendas hoje"**\n- **"Stock de bloco 15"** (qualquer produto)\n- **"O que vai esgotar?"**\n- **"Quem me deve dinheiro?"**\n- **"Encomendas atrasadas"** · **"Por levantar"**\n- **"Lucro"** · **"Mais vendidos"** · **"Stock parado"**\n- **"O que falta preencher?"**`;
}

function fmtDate(d: unknown): string {
    if (!d) return "—";
    const x = d instanceof Date ? d : new Date(d as string);
    return isNaN(x.getTime()) ? "—" : x.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}
