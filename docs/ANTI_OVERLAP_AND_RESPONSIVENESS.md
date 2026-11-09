# MajorStay — Manual de Anti-Sobreposição e Harmonia Responsiva

Este manual documenta as soluções arquiteturais e padrões de layout implementados no **MajorStay** para erradicar sobreposições de ícones, quebras anormais de texto e distorções visuais em qualquer tamanho de ecrã.

---

## 1. Problemas Resolvidos e Padrões Implementados

### 1.1 Sobreposição do Ícone de Lupa em Caixas de Pesquisa
* **Origem da Falha:** A lupa estava posicionada com `absolute left-3` e o `<Input>` configurado com `pl-9` (36px). Em várias fontes e renderizações, a primeira letra do texto placeholder ("Procurar..." ou "Pesquisar...") ficava debaixo do contorno da lupa.
* **Solução Padronizada:** Todos os campos de busca e inputs com ícones integrados foram atualizados para `pl-10` (40px) com o ícone centralizado com precisão matemática em `left-3.5 top-1/2 -translate-y-1/2 pointer-events-none`.

### 1.2 Quebra de Texto em Rótulos de Filtros e Pills
* **Origem da Falha:** Rótulos como `Bar / Loja (0)` ou `Lounge & Bar (0)` sofriam quebra de palavra por palavra verticalmente dentro dos botões quando a largura do ecrã diminuía.
* **Solução Padronizada:** Aplicação de `whitespace-nowrap shrink-0` em todos os botões de filtro e envolvimento da barra de abas em um container com `overflow-x-auto no-scrollbar`.

### 1.3 Desproporção da Sidebar de 256px com Grid Responsivo
* **Origem da Falha:** No breakpoint `md` (768px), o layout ativa a sidebar fixa de 256px (`w-64`), restando apenas **512px** para o conteúdo principal. Declarar `md:grid-cols-4` ou `md:grid-cols-5` causava o truncamento dos cartões para `LIVR...`, `OCU...`, `EXCI...`.
* **Solução Padronizada:** 
  * Indicadores de topo: `grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3` com `min-w-0`.
  * Grelha de quartos e cartões: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`.
  * Cabeçalho de página: `flex flex-col lg:flex-row lg:items-center justify-between gap-4`, preservando o título "Quadro de Quartos & Suítes" em uma só linha sem quebrar em 4 linhas separadas.

### 1.4 Colisão de Dados nos Cartões de Quarto
* **Origem da Falha:** Nomes como "Quarto 1" quebravam em duas linhas quando o badge de status e o menu de opções ocupavam espaço no topo; a contagem de tempo `Decorrido: 3h` e `Restam 20h` ficavam grudados sem espaço.
* **Solução Padronizada:** Atribuição de `min-w-0 flex-1` e `whitespace-nowrap` no título do quarto, e `flex items-center justify-between gap-2` com `truncate` no tempo decorrido e `shrink-0` no tempo restante.

---

## 2. Check-list de Engenharia para Novos Componentes

Ao criar ou modificar qualquer ecrã no MajorStay:
1. [ ] Nenhum `<Input>` com ícone à esquerda deve ter padding menor que `pl-10`.
2. [ ] Nenhum `flex items-center justify-between` pode omitir `min-w-0` no filho textual e `shrink-0` no filho de ação/badge.
3. [ ] Nenhum grid de 4 ou mais colunas pode ativar no breakpoint `md:`; use `lg:` para 4 colunas e `xl:` para 5 colunas.
4. [ ] Todos os botões do tipo pill em barras de filtro devem ter `whitespace-nowrap shrink-0`.
5. [ ] Páginas roláveis devem garantir `pb-24` para desimpedir a barra móvel inferior (`BottomNav`).
