# MajorStay — Manual do Sistema de Design Hotelaria Nude

Este documento estabelece as diretrizes de design, layout e harmonia visual do **MajorStay** (`stay.majorgroup.app`).

---

## 1. Visão Geral da Linguagem Visual

O MajorStay adota uma estética calorosa e nobre inspirada em lodges e hotéis boutique. Substitui a frieza dos tons de cinza/azul corporativos por uma paleta orgânica acolhedora baseada em:
- **Alabastro Quente (`#FAF7F2`)**: Fundo principal imersivo e repousante.
- **Marfim Nobre (`#FFFDF9`)**: Superfície dos cartões e modais.
- **Pergaminho Nobre (`#F8F5EE`)**: Superfícies internas e blocos de dados.
- **Micro-Bordas Areia Nobre (`#E5DFD6`)**: Separações orgânicas sem agressividade visual.
- **Terracota Artesanal (`#BA5A1A`)**: Cor de destaque de marca, botões de ação e estados ativos.
- **Ouro Champanhe (`#DF9E42`)**: Destaques de limpeza, estrelas e acabamentos finos.
- **Verde Sálvia Hotelaria (`#245D3B`)**: Indicador de quartos livres e confirmações.
- **Carmim Nobre (`#C53030`)**: Alertas de overtime / tempo excedido.

---

## 2. Componentes Harmonizados

### 2.1 Painel de Quartos (`src/app/rooms/page.tsx`)
- Indicadores de estado (KPIs) desenhados com cartões marfim com micro-bordas areia, badges com ícones suaves e contadores elegantes.
- Abas de filtragem tipo pill com transição suave e contadores numéricos estilizados.
- Barra de pesquisa integrada harmonizada com o tema.

### 2.2 Cartão do Quarto (`src/components/rooms/room-card.tsx`)
- Barra superior sutil com gradiente condicional do status do quarto.
- Número/Nome do quarto com tipografia nobre.
- Badge do estado com paleta semântica sálvia, terracota, carmim, ouro champanhe ou taupe.
- Caixa do hóspede em pergaminho quente com barra de progresso temporal suave.
- Botões de ação rápida harmonizados (`+ Bar`, `+1h`, `Saída`, `Fazer Check-in`).

### 2.3 Diálogos Operacionais (`src/components/rooms/*-dialog.tsx`)
- `check-in-dialog.tsx`: Seleção de permanência em pills elegantes, tarifas nítidas e botão de check-in em gradiente terracota.
- `check-out-dialog.tsx`: Extrato discriminado em pergaminho nobre com subtotal de horas e consumos do bar.
- `extend-stay-dialog.tsx`: Comparativo claro de hora de saída anterior vs nova saída em tons quentes.
- `room-consumption-dialog.tsx`: Lançamento rápido de itens de frigobar e bar integrado com gestão de comanda.
- `room-form-dialog.tsx`: Cadastro e edição de quartos com inputs arredondados e bordas nobres.

### 2.4 Dashboard Executivo (`src/components/dashboard/hospitality-dashboard.tsx`)
- Métricas com ícones acolhedores em fundos quentes.
- Cartões de estadias em curso com contagem decrescente visual.
- Gráficos semanais em gradientes de terracota e sálvia.

---

## 3. Conformidade e Regras para Desenvolvedores
1. Não utilize classes frias (`slate-100`, `gray-100`, `zinc-100`, `blue-500`) em componentes de quartos.
2. Formato de moeda sempre em Meticais (`MT`).
3. Mantenha os cantos arredondados sempre em `rounded-2xl` para cartões e `rounded-xl` para botões e inputs.
