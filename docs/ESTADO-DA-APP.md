# MajorStockX — estado da app

_Atualizado a 18/10/2026._

Gestão de stock, vendas e produção para pequenas e médias empresas em Moçambique: lojas, ferragens, mercearias, fábricas de blocos e armazéns.

- **Site:** https://stock.majorgroup.app
- **Código:** este repositório.
- **Tecnologia:** Next.js e React, Firebase (Auth + Firestore), alojado na Vercel.

---

## 1. O que a app faz

### Vender
- **Venda Rápida (`/pos`):**
  - escreve-se ou dita-se ("bloco 15 x 200") e o produto entra no carrinho;
  - leitor de código de barras pela câmara: cada artigo conta uma vez, há "Ler outra vez", "Confirmar (N)" fica em baixo e há lanterna;
  - leitores USB/Bluetooth funcionam como teclado;
  - desconto em MT ou %, IVA, documento, nota, data da venda (para registar vendas atrasadas), pago, dívida e levantamento;
  - tocar no total abre o carrinho.
- **Vender por toque (`/pos/catalogo`):** escolher produtos por imagem ou toque.
- **Ficha única da venda:** abre-se de qualquer página (Financeiro, Clientes, Relatórios…) e permite corrigir a venda, com registo do que mudou.
- **Documentos:** proformas, faturas, recibos e guias, com a marca da empresa, em PDF. 25 temas (Clássico, Moderno, Onda, Cartão, Moldura, Faixas, Estúdio, Canto, Bolhas, Vidro, Cartaz, Atelier, Executivo, Maré…), com miniaturas reais na escolha e a mesma aparência na pré-visualização do editor. Carimbo e data ao centro quando não há assinatura do cliente (opcional, desligada por defeito).
- **Carregamento:** ao recarregar, os quatro pilares passam pelo ecrã (carrinho, camião, portátil, armazém), cada um a entrar, parar e sair; só CSS.
- **Entrada da app:** animação de cerca de 5,5 s ao abrir (não volta nos 30 min seguintes, nem ao recarregar): Stock, Vendas, Gestão e Controlo, cada um com a sua cor, juntam-se no círculo do logótipo; "Major" e depois "StockX" aparecem numa onda, à frente e um pouco fora do círculo, e recuam para o lugar com um tremor no logótipo. Serve de ecrã de carregamento: se a app ainda não estiver pronta, o logótipo fica a "respirar" até estar (máx. 15 s). Toda a animação é CSS e vem no HTML: começa na primeira pintura e não salta cenas enquanto a app carrega por baixo. Um toque salta. Corre completa em todos os aparelhos.

### Stock e produtos
- **Produtos** (abas Stock | Catálogo | Movimentos | Perdas).
- **Catálogo:**
  - variações (cor, tamanho…), cada uma com stock, preço e código de barras próprios;
  - fotos e categorias; **foto de estúdio** (fundo branco feito no telemóvel, sem IA nem internet — escolhe-se a original ou a de fundo branco);
  - importação de listas;
  - "Quanto tem agora?" ao criar um produto.
- **Stock Rápido:**
  - entradas e saídas em lote;
  - um código desconhecido pode criar um produto novo ou ser associado a um existente;
  - localização habitual;
  - folha de entrada.
- **Várias localizações**, transferências (de vários produtos de uma vez), contagens e perdas. As localizações podem ser zonas do mesmo sítio (fábrica, pátio, mostruário) ou lojas noutros pontos.
- **Pontos:** cada localização pode pertencer a um ponto (ex.: Matola, Boane). O Painel mostra quanto vende e quanto tem cada ponto; um funcionário com ponto só vê e vende o stock desse ponto, e pode transferir para os outros. (Limite: é feito na app, não nas regras do Firestore.)
- **Envios com confirmação** (opcional, Configurações → Localizações → "Confirmar receção nas transferências"): o que se envia sai da origem e fica em trânsito até o destino confirmar a quantidade que chegou; as faltas ficam registadas com quem enviou e quem recebeu. Separadores Enviar / Por receber / Histórico em Produtos → Transferir; aviso no Painel de quem tem envios por receber; a gestão é avisada das diferenças.
- **Pesquisa do Inventário** pelo código de barras (ícone do leitor).

### Produção (fábricas)
- Produção com consumo de matéria-prima, receitas, custos, aviso de desperdício e de matéria-prima em falta, e cura do betão.

### Pessoas e dinheiro
- **Clientes e dívidas**, encomendas e calendário.
- **Financeiro:** entradas e despesas.
- **Relatórios:** Vendas | Financeiro. O Diagnóstico abre-se a partir do Painel.
- **Funcionários:** papéis Admin, Dono (vê tudo mas não altera) e Funcionário (com as permissões que lhe forem dadas por módulo).

### Ajuda ao utilizador
- Guias em cada página (botão **?**), "Primeiros passos" e uma venda de demonstração que não grava nada.
- Funciona sem internet: as vendas ficam no aparelho e seguem quando a ligação voltar.
- Teclado: botão "Fechar"; as páginas não abrem o teclado sozinhas no telemóvel.
- Notificações push, emails de alerta (stock crítico, vendas, fecho do dia) e recibos por email para os clientes.

---

## 2. Contas e entrada

- **Registo** com email e senha ou com o Google. Cada empresa nova começa com **14 dias de teste**.
- **Entrar:** com o Google ou com email e senha. Em Configurações → Perfil → **"Formas de entrar"** liga-se o Google ou cria-se uma senha, para não perder nenhuma das duas formas.
- O ecrã de entrada do Google mostra **stock.majorgroup.app**, com o nome e o logótipo da marca, porque o domínio de autenticação passa pelo nosso domínio.
- **Confirmação do email:** antes do **primeiro produto** de uma conta nova, o responsável confirma o email (há também uma faixa discreta no topo). Quem entra com o Google já tem o email confirmado. A venda nunca pede confirmação.

---

## 3. Planos e pagamentos

| | Básico | Pro | Business |
|---|---|---|---|
| Preço/mês | 300 MT | 1000 MT | 2000 MT |
| Utilizadores | 1 | até 5 | sem limite |
| Venda Rápida, Vender por toque, leitor, voz, stock, clientes e dívidas, despesas | ✓ | ✓ | ✓ |
| Variações, documentos, encomendas, relatórios completos | — | ✓ | ✓ |
| Produção e matérias-primas, várias localizações | — | — | ✓ |

- **Trimestral:** -10%. **Anual:** -15%. O Pro mantém os preços de sempre: 1000, 2700 e 10200 MT.
- **Contas que já pagavam antes dos planos** (sem nível) mantêm tudo ao preço do Pro ("O meu plano atual").
- **Em teste** tudo está aberto. As fábricas começam com o Business sugerido.
- **Fora do plano:** cadeado no menu e página "Passar para o …".
- **Onde o bloqueio é verificado:**
  - Firestore (produção, matérias-primas, encomendas);
  - servidor (limite de utilizadores);
  - só na app (variações, várias localizações, páginas).
- **Pagamento:**
  - M-Pesa e e-Mola por envio direto, confirmado à mão em Administração;
  - cartão pela ZumboPay;
  - EscalePay para afiliados (só com o email confirmado);
  - códigos de convite (só no Pro ou no plano antigo).
- **Administração** (`/admin/subscriptions`): estado, datas e **plano** de cada empresa, pagamentos manuais, afiliados e o botão **"Erros"**.
- Código: `src/lib/tiers.ts`, `src/lib/plans.ts`, `src/lib/billing-server.ts`.

---

## 4. Segurança

- **Regras do Firestore (`firestore.rules`)** — este ficheiro tem de ser publicado à mão na consola do Firebase:
  - **isolamento entre empresas:** cada permissão é verificada na empresa do próprio endereço (`can(companyId, …)`);
  - **registo:** o mapa de utilizador só pode ter a empresa que a pessoa está a criar (sem `superAdmin`), e a empresa nova só pode nascer em teste;
  - **campos que só o servidor grava:** estado, datas, pagamentos, plano, nível, código, afiliado, origem e dono;
  - **papéis:** o Dono só lê; só um gestor dá o papel de Admin; ninguém muda o próprio papel nem se apaga a si próprio;
  - **vendas:** depois de feitas, só o gestor as corrige ou apaga; o vendedor nunca baixa o valor pago.
- **Servidor:**
  - **emails:** só para endereços da empresa ou dos seus clientes, com o conteúdo sempre como texto e limite de 300 por dia por empresa;
  - **IA:** 200 pedidos por dia por empresa;
  - **crons:** recusam se faltar o `CRON_SECRET`;
  - **pagamentos:** webhooks com assinatura verificada, e o preço é sempre calculado no servidor.
- **Credenciais:** ficam só nas variáveis de ambiente da Vercel.

---

## 5. Operação

- **Resumo diário de erros** por email às 06:00 (Maputo), com as empresas que começaram o teste. Os detalhes estão em Administração → **Erros**, que mostra também o código à volta do erro e a versão.
- **Crons (Vercel):** fecho do dia (vários horários), cópia de segurança, lembretes e resumo de erros.
- **Variáveis importantes na Vercel:**
  - Firebase (`NEXT_PUBLIC_FIREBASE_*`, com `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=stock.majorgroup.app`);
  - `RESEND_API_KEY`, `CRON_SECRET`;
  - ZumboPay e EscalePay;
  - `GEMINI_API_KEY`.

---

## 6. Pendente / próximos passos

1. **Impressora térmica (kit mercearia):** escolher o modelo; depois fazer o talão de 58/80 mm e testar com o aparelho real.
2. **Parte fiscal:** confirmar com um contabilista se os talões e faturas precisam de software certificado pela Autoridade Tributária.
3. **Página de entrada** (para quem ainda não tem conta) com os 3 planos: falta decidir o domínio e juntar testemunhos reais.
4. **Caixa vs. unidade** (ex.: fardo de 24 latas com outro código): só se houver clientes que vendam das duas formas.
5. **Conferir na produção** o registo com o Google e o envio de recibos depois das últimas mudanças de segurança.
