---
name: responsive-harmony
description: Diretrizes de responsividade, proporção de aspeto (aspect ratio), espaçamento e consistência de layout para todos os ecrãs do MajorStay em desktop, tablet e telemóvel. Use sempre que criar ou editar páginas, grelhas, cabeçalhos, barras de pesquisa, cartões e botões para evitar sobreposição de elementos, quebras de linha defeituosas e cortes de texto.
---

# MajorStay Responsive Harmony & Fluid Layout Guide

Este guia estabelece os padrões de responsividade e harmonia visual do **MajorStay**, assegurando que os elementos nunca fiquem sobrepostos, cortados ou desalinhados independentemente do tamanho do ecrã (desde telemóveis de 360px até monitores ultrawide de 2560px).

---

## 1. Regra de Ouro da Barra de Pesquisa (Zero-Overlap Input)

**Problema Detectado:** Ícones de lupa (`Search`) colocados com `absolute left-3 top-2.5` enquanto o `<Input>` tinha apenas `pl-9` ou menos, fazendo a lupa sobrepor-se à primeira letra do texto placeholder ("Procurar...").

**Padrão Obrigatório:**
```tsx
// Correto: padding à esquerda de pelo menos pl-10 (40px) ou pl-11 (44px)
<div className="relative flex-1 min-w-[200px]">
  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#827568] pointer-events-none" />
  <Input
    placeholder="Pesquisar quarto ou hóspede..."
    className="pl-10 pr-4 h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-white dark:bg-[#1E1714]"
  />
</div>
```

---

## 2. Grelha de Indicadores e KPIs (Evitar Truncamento)

**Problema Detectado:** Grelha com `grid-cols-5` fixa em ecrãs com barra lateral de 256px aberta. Em ecrãs de 1024px a 1366px, sobrava apenas ~100px para cada cartão, provocando truncamentos como `LIVR...`, `OCU...`, `EXCI...`.

**Padrão Obrigatório:**
```tsx
// Grelha fluida adaptável ao espaço real disponível:
<div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
  {/* Cada KPI card com min-w-0 e flex items-center gap-2.5 */}
  <div className="min-w-0 p-3 sm:p-3.5 rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915]">
    ...
  </div>
</div>
```

---

## 3. Cabeçalhos de Página (Evitar Quebra de Título em Cascata)

**Problema Detectado:** Título `Quadro de Quartos & Suítes` quebrando em 4 linhas separadas porque os botões de ação ocupavam toda a largura disponível num flex container sem `flex-wrap` ou `flex-col md:flex-row`.

**Padrão Obrigatório:**
```tsx
<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
  <div className="min-w-0">
    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#251D18] dark:text-[#F5EFEB]">
      Quadro de Quartos & Suítes
    </h1>
    <p className="text-xs text-[#827568] dark:text-[#B0A294] mt-0.5">
      Gestão de estadias em tempo real, cobrança por hora ou pernoita e controlo de caixa.
    </p>
  </div>
  <div className="flex flex-wrap items-center gap-2 shrink-0">
    {/* Botões de ação com flex-wrap garantindo que nunca espremam o título */}
  </div>
</div>
```

---

## 4. Filtros e Abas (Pills com No-Wrap)

**Problema Detectado:** Rótulos de abas como `Bar / Loja (0)` quebrando em 3 linhas verticais dentro do pill.

**Padrão Obrigatório:**
```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
    <button className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 ...">
      Todos (2)
    </button>
  </div>
  <div className="w-full sm:w-72 shrink-0">
    {/* Search Input */}
  </div>
</div>
```

---

## 5. Cartão de Quarto e Informações de Hóspede

**Problema Detectado:** Cabeçalho do cartão quebrando "Quarto" e "1" em duas linhas, ou texto de tempo `Decorrido: 3h Restam 20h` colidindo.

**Padrão Obrigatório:**
- Título do quarto: `flex items-center justify-between gap-2` com `whitespace-nowrap font-bold text-base`.
- Badges: `flex flex-wrap items-center gap-1.5 shrink-0`.
- Bloco de Tempo Decorrido vs Restante: sempre estruturado em colunas dedicadas `grid grid-cols-2 gap-2 text-center` ou `flex justify-between items-center text-xs`.
