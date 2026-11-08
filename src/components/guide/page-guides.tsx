// Tutorial de cada página ("Como funciona esta página"): abre pelo botão "?" do topo. São explicações (não obrigam
// a gravar nada); os alvos são os `data-tour` de cada página. Cada um acaba na própria página, com os parabéns.
import type { ReactNode } from "react";
import type { Guide, GuideStep } from "./types";

/** O último balão de um guia: acaba onde a pessoa está, sem a levar para outra página. */
export const congrats = (body: ReactNode): GuideStep => ({
    title: "Parabéns! 🎉",
    body: <>{body} Se tiver dúvidas, toque outra vez no <b>?</b> lá em cima.</>,
});

const MENU_TIP = <>No telemóvel, o menu completo está em <b>Mais</b> (em baixo, à direita). Em cada página, o botão <b>?</b> no topo explica como ela funciona.</>;

const PAGES: Guide[] = [
    {
        id: "pagina-dashboard",
        path: "/dashboard",
        title: "Início",
        steps: [
            { title: "O seu painel", body: <>O que precisa de saber ao abrir a app: quanto vendeu hoje, o que tem para fazer e o que precisa de atenção.</> },
            { target: "dash-started", title: "Primeiros passos", body: <>Siga esta lista para pôr a empresa a funcionar. Cada passo tem um botão que o leva ao sítio certo. Desaparece quando estiver tudo feito.</> },
            { target: "dash-tiles", title: "Os números de hoje", body: <><b>Vendido hoje</b> e <b>este mês</b>; <b>por receber</b> (clientes que devem) e <b>por levantar</b> (vendas pagas com o material ainda reservado). Toque num número para ver a lista.</> },
            { target: "dash-shortcuts", title: "Atalhos do dia-a-dia", body: <><b>Vender</b>, dar <b>entrada</b> de mercadoria, fazer uma <b>contagem</b> e ver a <b>lista de carga</b> — a um toque.</> },
            { target: "dash-attention", title: "Atenção", body: <>Problemas a resolver, cada um com ligação directa: stock a acabar, reservas presas, dias sem vendas registadas. O <b>Diagnóstico</b> mostra tudo em detalhe.</> },
            { target: "dash-kpis", title: "Números e gráficos", body: <>Só para o dono e administradores: lucro, crescimento, ticket médio, gráfico das vendas e o que mais vende.</> },
            { title: "Perguntas rápidas", body: <>Na <b>lupa</b> 🔍 lá em cima procura produtos e também pode perguntar em português, por exemplo: <b>«quanto vendi esta semana?»</b> ou <b>«stock de pavê»</b>.</> },
            { title: "Para chegar a tudo", body: MENU_TIP },
        ],
    },
    {
        id: "pagina-vendas",
        path: "/sales",
        title: "Histórico de Vendas",
        steps: [
            { title: "Todas as vendas", body: <>Cada venda registada fica aqui, com a data, a hora, quem vendeu e o documento pronto a imprimir ou enviar.</> },
            { target: "sales-search", title: "Procurar", body: <>Escreva o nome do produto para ver só as vendas dele.</> },
            { target: "sales-date", title: "Um dia", body: <>Escolha uma data para ver só as vendas desse dia.</> },
            { target: "sales-filter", title: "Estado", body: <><b>Pago</b> = pago mas o cliente ainda não levou (o material está reservado). <b>Levantado</b> = já levou. Com vários locais, filtre também por local.</> },
            { target: "sales-view", title: "Lista ou cartões", body: <>No computador, escolha ver em lista ou em cartões.</> },
            { target: "sales-list", title: "As vendas", body: <>Cada venda mostra o valor, a data e a hora, o cliente e o estado.</> },
            { target: "sales-actions|sales-item", title: "O que pode fazer", body: <><b>Ver detalhes</b>, <b>editar</b>, <b>baixar o PDF</b>, <b>imprimir</b>, confirmar que o cliente <b>levantou</b> e <b>apagar</b> (o stock volta).</> },
            { target: "sales-add", title: "Nova venda", body: <>Abre a <b>Venda Rápida</b>. Para registar uma venda de outro dia, mude lá a <b>data da venda</b>; documento, desconto e IVA estão em <b>Mais opções</b>.</> },
        ],
    },
    {
        id: "pagina-carga",
        path: "/sales/carga",
        title: "Lista de Carga",
        steps: [
            { target: "carga-head", title: "O que falta carregar", body: <>As vendas pagas à espera de o cliente levar, em três grupos: <b>pode carregar agora</b>, <b>ainda a secar</b> e <b>falta produzir</b>. As mais antigas ficam com as peças prontas primeiro.</> },
            { title: "Quando o cliente leva", body: <>Toque em <b>Já carregou</b>: o stock sai e a reserva é libertada. A venda passa a <b>Levantado</b> no histórico.</> },
        ],
    },
    {
        id: "pagina-documentos",
        path: "/documents",
        title: "Documentos",
        steps: [
            { title: "Os seus documentos", body: <>Facturas, cotações, guias, recibos e outros, com o seu logótipo e dados — prontos a enviar ou imprimir.</> },
            { target: "docs-new", title: "Novo documento", body: <>Toque em <b>Novo</b> e escolha o tipo. O editor mostra a pré-visualização enquanto escreve.</> },
            { target: "docs-filters", title: "Procurar e filtrar", body: <>Procure por número ou cliente e filtre por tipo e por estado (rascunho, emitido…).</> },
            { target: "docs-list", title: "A lista", body: <>Toque num documento para o abrir, editar ou assinar. O botão de transferir faz o PDF.</> },
        ],
    },
    {
        id: "pagina-encomendas",
        path: "/orders",
        title: "Encomendas",
        steps: [
            { title: "Encomendas", body: <>Vendas para produzir ou entregar mais tarde. Uma encomenda <b>reserva o stock</b> para o cliente, para não ser vendido a outro.</> },
            { target: "orders-filters", title: "Procurar e filtrar", body: <>Procure por produto ou cliente e filtre por estado: <b>Pendente</b>, <b>Em produção</b> ou <b>Concluída</b>.</> },
            { target: "orders-card", title: "Cada encomenda", body: <>Mostra o cliente, o produto, a quantidade e a data prevista.</> },
            { target: "orders-progress", title: "Progresso", body: <>Quanto já foi produzido. Cada registo de produção soma aqui e gasta a matéria-prima da receita.</> },
            { target: "orders-actions", title: "Avançar", body: <><b>Iniciar produção</b> → registar o que foi produzido → <b>Concluir</b> → <b>Entregar</b> (o stock sai, a reserva é libertada e a venda fica fechada).</> },
            { target: "orders-add", title: "Nova encomenda", body: <>Toque no <b>+</b> para registar uma encomenda.</> },
            { target: "orders-print", title: "Relatório", body: <>Baixe em PDF ou imprima a lista de encomendas.</> },
        ],
    },
    {
        id: "pagina-inventario",
        path: "/inventory",
        title: "Inventário",
        steps: [
            { target: "products-tabs", title: "As abas de Produtos", body: <><b>Stock</b> (quanto tem de cada um), <b>Catálogo</b> (o que vende e a que preço), <b>Movimentos</b> (cada entrada e saída) e <b>Perdas</b> (o que as contagens encontraram a menos). Um produto novo cria-se uma vez e fica no Stock e no Catálogo.</> },
            { target: "inv-without-stock", title: "Ainda sem stock", body: <>Produtos que já estão no catálogo mas de que ainda não deu entrada. Toque para dar entrada no <b>Stock Rápido</b>.</> },
            { target: "inv-quick|inv-count", title: "O seu stock", body: <>Tudo o que tem, em cada local. Use o <b>Stock Rápido</b> para entradas e saídas, e a <b>Contagem</b> para acertar o stock (as diferenças aparecem nas Perdas).</> },
            { target: "inv-search|inv-filters", title: "Procurar e filtrar", body: <>Por nome ou código de barras; filtre por categoria, estado (baixo, crítico, esgotado), local e data, e escolha lista ou cartões.</> },
            { target: "inv-stock|inv-card|inv-list", title: "O número grande", body: <>É o que pode <b>vender agora</b>: o stock menos o reservado. Toque em «reservados» para ver de que vendas ou encomendas são.</> },
            { target: "inv-card-actions", title: "Ações", body: <><b>Contar</b> (acertar o stock deste produto), <b>editar</b>, ver o histórico e <b>apagar</b>.</> },
            { target: "inv-more", title: "Mais", body: <>O relatório em PDF ou impresso e a <b>folha de contagem em papel</b>.</> },
            { target: "inv-add", title: "Produto novo", body: <>Toque no <b>+</b> para criar um produto: nome, preço e, se já o tem, a quantidade.</> },
            { title: "Quer ver passo a passo?", body: <>Mostramos-lhe como dar entrada de stock no <b>Stock Rápido</b>, campo a campo.</>, cta: { label: "Ver passo a passo", guide: "stock-inicial" } },
        ],
    },
    {
        id: "pagina-historico",
        path: "/inventory/history",
        title: "Histórico de movimentos",
        steps: [
            { title: "Tudo o que mexeu no stock", body: <>Cada entrada, saída, venda, produção e acerto fica aqui, com <b>quem fez</b> e <b>quando</b>.</> },
            { target: "hist-filters", title: "Procurar", body: <>Por produto, utilizador ou motivo, e por dia.</> },
            { target: "hist-list", title: "Os movimentos", body: <>Cada cartão é um movimento: com <b>+</b> entrou, com <b>−</b> saiu.</> },
        ],
    },
    {
        id: "pagina-perdas",
        path: "/inventory/perdas",
        title: "Perdas e faltas",
        steps: [
            { title: "Onde se perde dinheiro", body: <>O que as contagens encontraram a menos e as saídas registadas como perda ou quebra — em dinheiro.</> },
            { target: "loss-period", title: "Período", body: <>Últimos 7, 30, 90 dias ou um ano.</> },
            { target: "loss-tiles", title: "Quanto se perdeu", body: <>Total perdido, faltas nas contagens, quebras declaradas e sobras (mercadoria que entrou sem ser registada).</> },
            { target: "loss-count", title: "Fazer contagens", body: <>Contagens regulares (uma vez por semana, por local) é o que mostra as faltas aqui.</> },
        ],
    },
    {
        id: "pagina-producao",
        path: "/production",
        title: "Produção",
        steps: [
            { title: "O que a fábrica produziu", body: <>Cada produção gasta a matéria-prima da receita e põe o produto no stock.</> },
            { target: "prod-filters", title: "Procurar", body: <>Filtre pelo nome do produto e escolha lista ou cartões.</> },
            { target: "prod-list", title: "Os registos", body: <>Quantidade, data, local e quem registou.</> },
            { target: "prod-add", title: "Registar produção", body: <>Toque no <b>+</b> para registar o que foi produzido hoje.</> },
            { target: "prod-print", title: "Relatório", body: <>Baixe em PDF ou imprima.</> },
        ],
    },
    {
        id: "pagina-materia-prima",
        path: "/raw-materials",
        title: "Matéria-Prima",
        steps: [
            { title: "Os seus insumos", body: <>O que gasta para produzir: cimento, areia, ferro, tinta…</> },
            { target: "rm-tabs", title: "Três partes", body: <><b>Insumos</b>: o stock de matéria-prima. <b>Receitas</b>: quanto de cada insumo leva cada produto. <b>Custos</b>: quanto custa produzir.</> },
            { target: "rm-register-production", title: "Registar produção", body: <>A produção regista-se na página <b>Produção</b>: com a receita, a matéria-prima desconta-se sozinha.</> },
            { target: "rm-add", title: "Novo insumo", body: <>Adicione cada matéria-prima com a unidade e o custo.</> },
            { title: "Porquê receitas?", body: <>Com a receita, cada produção desconta a matéria-prima sozinha e a app calcula o custo real de cada produto.</> },
        ],
    },
    {
        id: "pagina-catalogo",
        path: "/catalog",
        title: "Catálogo",
        steps: [
            { target: "products-tabs", title: "As abas de Produtos", body: <><b>Stock</b> (quanto tem de cada um), <b>Catálogo</b> (o que vende e a que preço), <b>Movimentos</b> (cada entrada e saída) e <b>Perdas</b> (o que as contagens encontraram a menos). Um produto novo cria-se uma vez e fica no Stock e no Catálogo.</> },
            { target: "catalog-tabs", title: "Três partes", body: <><b>Produtos</b>, <b>Categorias</b> e <b>Importar</b> (uma lista do Excel, de uma vez).</> },
            { target: "catalog-search", title: "Pesquisa", body: <>Encontra mesmo sem acentos e com erros de escrita. Também procura pela categoria e pelo código de barras.</> },
            { target: "catalog-filters", title: "Filtrar e ordenar", body: <>Por categoria; ordene por nome, preço ou margem.</> },
            { target: "catalog-row-open", title: "A ficha", body: <>Toque num produto para ver o preço, a margem, o stock em cada local, as últimas vendas e o histórico de preços.</> },
            { target: "catalog-select", title: "Vários de uma vez", body: <>Selecione vários produtos para <b>mudar a categoria</b>, <b>subir ou baixar o preço em %</b> ou <b>apagar</b>.</> },
            { target: "catalog-new", title: "Novo produto", body: <>Adicione um produto — com variações (cores, texturas…) se precisar. Se já o tem, diga quanto: entra logo no stock.</> },
            { target: "catalog-more", title: "Sincronizar", body: <>Traz para o catálogo os produtos que só existem no inventário.</> },
            { title: "Quer ver passo a passo?", body: <>Mostramos-lhe como adicionar e editar um produto, campo a campo.</>, cta: { label: "Ver passo a passo", guide: "catalogo" } },
        ],
    },
    {
        id: "pagina-clientes",
        path: "/customers",
        title: "Clientes",
        steps: [
            { title: "Os seus clientes", body: <>Contactos, quanto compraram e quando vieram pela última vez.</> },
            { target: "cust-add", title: "Novo cliente", body: <>Adicione com nome, telefone e NUIT. Dica: ao vender, basta escrever o nome — se for novo, a app cria-o sozinha.</> },
            { target: "cust-search", title: "Procurar", body: <>Por nome ou telefone.</> },
            { target: "cust-list", title: "A lista", body: <>Toque num cliente para ver as compras e o que deve, ou edite os dados.</> },
        ],
    },
    {
        id: "pagina-funcionarios",
        path: "/users",
        title: "Funcionários",
        steps: [
            { title: "A sua equipa", body: <>Quem usa a app na sua empresa e o que cada um pode fazer.</> },
            { target: "users-add", title: "Adicionar", body: <>Crie o acesso com email e senha e escolha, módulo a módulo, o que a pessoa pode <b>ver</b> e <b>fazer</b>.</> },
            { target: "users-list", title: "Gerir", body: <>Mude as permissões ou retire o acesso quando alguém sair.</> },
            { title: "Segurança", body: <>Os funcionários fazem <b>contagem cega</b> (não vêem o stock do sistema) e as mudanças de preço que fizerem numa venda ficam para o gestor confirmar.</> },
        ],
    },
    {
        id: "pagina-financeiro",
        path: "/finance",
        title: "Financeiro",
        steps: [
            { title: "O dinheiro", body: <>Entradas (vendas pagas) e saídas (despesas) — e quanto sobra.</> },
            { target: "reports-tabs", title: "Vendas e Financeiro", body: <>Os relatórios têm duas abas: <b>Vendas</b> (o que se vendeu, produto a produto) e <b>Financeiro</b> (o dinheiro que entrou e saiu, com as despesas).</> },
            { target: "fin-expense", title: "Registar despesa", body: <>Luz, salários, renda, transporte, combustível… Escolha a categoria e a data.</> },
            { target: "fin-period", title: "Período", body: <>Dia, semana, mês ou ano, a partir da data escolhida.</> },
            { target: "fin-kpis", title: "Resultado", body: <>Entradas, saídas e o que sobrou. Conta só o que foi <b>pago</b>; cotações e proformas não contam.</> },
            { target: "fin-tabs", title: "As listas", body: <>Veja uma a uma as entradas e as saídas do período.</> },
            { target: "finance-sale", title: "Abrir uma venda", body: <>Toque numa venda para ver tudo dela e <b>corrigir</b> (data, cliente, pagamento), imprimir ou marcar como levantada — sem sair daqui.</> },
            { target: "fin-print", title: "Relatório", body: <>Imprima ou baixe o relatório financeiro.</> },
        ],
    },
    {
        id: "pagina-relatorios",
        path: "/reports",
        title: "Relatórios",
        steps: [
            { target: "reports-tabs", title: "Vendas e Financeiro", body: <>Os relatórios têm duas abas: <b>Vendas</b> (o que se vendeu, produto a produto) e <b>Financeiro</b> (o dinheiro que entrou e saiu, com as despesas).</> },
            { target: "rep-period", title: "Período", body: <>Escolha dia, semana, mês ou ano, e a data.</> },
            { target: "rep-stats", title: "Resumo", body: <>Número de vendas, valor recebido e ticket médio do período.</> },
            { target: "rep-details", title: "Detalhe", body: <>As vendas do período, produto a produto.</> },
            { target: "rep-export", title: "Partilhar", body: <>Exporte em PDF ou partilhe directamente (WhatsApp, email…).</> },
        ],
    },
    {
        id: "pagina-diagnostico",
        path: "/diagnostico",
        title: "Diagnóstico",
        steps: [
            { target: "diag-headline", title: "Numa frase", body: <>O mais importante que a app encontrou no seu negócio.</> },
            { target: "diag-kpis", title: "Os números", body: <>Vendas do mês, últimos 30 dias, valor em stock e quanto tem por receber.</> },
            { target: "diag-quality", title: "Confiança dos números", body: <>O que falta registar para as análises serem fiáveis. Cada passo tem um botão para o fazer.</> },
            { target: "diag-alerts", title: "Alertas", body: <>Problemas com ligação directa para os resolver.</> },
            { target: "diag-details", title: "Em detalhe", body: <>Stock, vendas, clientes, encomendas e levantamentos.</> },
        ],
    },
    {
        id: "pagina-ajustes",
        path: "/settings",
        title: "Ajustes",
        steps: [
            { target: "set-tabs", title: "As secções", body: <><b>Perfil</b>, <b>Aparência</b>, <b>Empresa</b> (NUIT, logótipo, dados nos documentos), <b>Documentos</b> (numeração e aspeto), <b>Localizações</b>, <b>Categorias e unidades</b>, <b>Segurança e dados</b> (cópias de segurança, lixeira) e <b>Avançado</b>.</> },
            { title: "Comece pela Empresa", body: <>O NUIT, os contactos e o logótipo aparecem em todas as facturas e guias.</>, cta: { label: "Abrir Empresa", href: "/settings#company" } },
        ],
    },
    {
        id: "pagina-subscricao",
        path: "/billing",
        title: "Subscrição",
        steps: [
            { title: "O seu plano", body: <>Quanto tempo falta e o histórico de pagamentos.</> },
            { target: "bill-plans", title: "Escolha o plano", body: <>Mensal, trimestral ou anual — os mais longos ficam mais baratos por mês.</> },
            { target: "bill-method", title: "Como pagar", body: <><b>M-Pesa</b> ou <b>e-Mola</b>: envia para o nosso número e manda o comprovativo por WhatsApp; a conta fica activa em até 20 minutos em horário de funcionamento (segunda a sábado, 8h–18h). <b>Cartão</b>: activa na hora.</> },
            { target: "bill-pay", title: "Pagar", body: <>Mostra o número, o valor e a referência a usar. Pagar antes do fim não perde dias.</> },
        ],
    },
];

export const PAGE_GUIDES: Guide[] = PAGES.map((g) => ({
    ...g,
    steps: [...g.steps, congrats(<>Agora já sabe como funciona a página <b>{g.title}</b>.</>)],
}));
