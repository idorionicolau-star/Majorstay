---
name: anti-overlap
description: Diretrizes mandatórias contra sobreposição de elementos, colisão de ícones em inputs, quebras defeituosas de texto e truncamentos em todas as telas do MajorStay. Use sempre que criar, editar ou revisar layouts, formulários, cartões, tabelas e cabeçalhos.
---

# MajorStay Anti-Overlap & Layout Collision Prevention Skill

Esta skill codifica as regras mandatórias de engenharia de layout no **MajorStay** para garantir **zero sobreposições, zero colisões visuais e fluidez responsiva absoluta** em qualquer dispositivo (telemóveis de 360px a 430px, tablets de 768px a 1024px e ecrãs desktop de 1080p a 4K).

---

## 1. A Matemática do Espaço Útil (The Sidebar Viewport Offset)

No MajorStay, a barra lateral (`Sidebar`) tem largura fixa de `w-64` (256px) para ecrãs `>= md` (768px). 

Isto significa que o espaço real disponível para a área de conteúdo (`<main>`) é:
* **Viewport 768px (`md`):** Espaço útil = `768px - 256px = 512px` (igual a um telemóvel na horizontal).
* **Viewport 1024px (`lg`):** Espaço útil = `1024px - 256px = 768px` (igual a um tablet).
* **Viewport 1280px (`xl`):** Espaço útil = `1280px - 256px = 1024px` (desktop médio).
* **Viewport 1536px (`2xl`):** Espaço útil = `1536px - 256px = 1280px` (desktop largo).

### ❌ Erro Comum:
Usar `md:grid-cols-4` ou `md:grid-cols-5`. No breakpoint `md` (768px), tentar enfiar 5 colunas em apenas 512px resulta em ~100px por coluna, provocando truncamentos inaceitáveis como `LIVR...`, `OCU...`, `EXCI...`.

### ✅ Regra Obrigatória:
* **5 Colunas (ex: KPIs do topo):** Usar `grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3`.
* **4 Colunas (ex: Grelha de quartos ou tiles):** Usar `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`.
* **Cabeçalhos com Título + 3 a 5 botões de ação:** Usar `flex flex-col lg:flex-row lg:items-center justify-between gap-4`. Nunca usar `sm:flex-row` nem `md:flex-row` para títulos compridos como *"Quadro de Quartos & Suítes"*, pois quebram em 4 linhas verticais.

---

## 2. Padrão Zero-Overlap em Barras de Pesquisa e Inputs com Ícone

### ❌ Erro Comum:
Ícone posicionado com `left-3 top-3` e o `<Input>` com `pl-9` ou `pl-8`. A letra inicial do texto informativo (ex: o **P** de *"Procurar..."* ou *"Pesquisar..."*) colide ou fica escondida debaixo da lupa.

### ✅ Regra Obrigatória:
1. O `<Input>` DEVE ter no mínimo `pl-10` (40px) ou `pl-11` (44px).
2. O ícone DEVE ter `left-3.5 top-1/2 -translate-y-1/2 pointer-events-none`.

```tsx
// Exemplo canónico
<div className="relative w-full sm:w-72">
  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#827568] pointer-events-none" />
  <Input
    placeholder="Pesquisar quarto ou hóspede..."
    className="pl-10 pr-4 h-10 text-xs rounded-xl border-[#E5DFD6] dark:border-[#382D26] bg-white dark:bg-[#1E1714] focus-visible:ring-[#BA5A1A]"
  />
</div>
```

---

## 3. Prevenção de Colisão em Containers Flex (Text vs Badge/Button)

### ❌ Erro Comum:
```tsx
// ERRADO: Sem min-w-0 e sem shrink-0, textos longos esmagam badges ou empurram botões para fora do ecrã
<div className="flex items-center justify-between">
  <span>{clientName}</span>
  <Badge>{status}</Badge>
</div>
```

### ✅ Regra Obrigatória:
1. Sempre atribuir `min-w-0 flex-1` ao container ou texto à esquerda.
2. Sempre atribuir `truncate` ao texto para cortar com reticências quando o nome for longo.
3. Sempre atribuir `shrink-0` ao badge, botão ou valor numérico à direita.
4. Sempre definir um `gap-2` ou `gap-3` explícito além do `justify-between`.

```tsx
// CORRETO
<div className="flex items-center justify-between gap-2 min-w-0">
  <span className="font-bold text-sm text-[#251D18] dark:text-[#F5EFEB] truncate min-w-0 flex-1">
    {stay.clientName || 'Hóspede Particular'}
  </span>
  <Badge className="shrink-0 text-xs font-bold whitespace-nowrap">
    {status}
  </Badge>
</div>
```

---

## 4. Pills de Filtro e Abas Sem Quebra Involuntária (No-Wrap)

### ❌ Erro Comum:
Rótulos como `Lounge & Bar (0)` ou `Quartos (2)` quebrando palavras isoladas em linhas verticais (`Bar` / `&` / `Bar` / `(0)`).

### ✅ Regra Obrigatória:
1. Todo o botão ou tab em formato pill DEVE ter `whitespace-nowrap shrink-0`.
2. O container que envolve a lista de filtros DEVE ter `overflow-x-auto no-scrollbar` para permitir deslizar com o dedo no telemóvel sem deformar as palavras.

```tsx
<div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0 shrink-0">
  <button className="whitespace-nowrap shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg ...">
    Lounge & Bar ({count})
  </button>
</div>
```

---

## 5. Proteção de Margem Inferior Móvel (Bottom Nav Clearance)

Nos dispositivos móveis, a barra de navegação inferior (`BottomNav`) tem altura fixa de `h-16` (64px) fixada com `fixed bottom-0`.

* Qualquer página com scroll ou formulários DEVE ter pelo menos `pb-24` (96px) ou `pb-28` (112px).
* Botões flutuantes ou barras fixas de confirmação DEVEM respeitar `bottom-16 md:bottom-0` para não sobrepor a navegação nativa do telemóvel.
