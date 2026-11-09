---
name: hospitality-design-system
description: Sistema e padrões visuais de design nude & terracota para hotelaria e gestão de quartos no MajorStay. Use sempre que criar, modificar ou refatorar componentes visuais, cartões de quarto, modais, dashboards e tabelas para garantir harmonia estética total (Alabaster, Marfim Nobre, Terracota e Nogueira).
---

# MajorStay Hospitality Design System & Layout Guide

Este guia codifica as diretrizes estéticas e arquitetura de layout do **MajorStay**, assegurando coerência visual perfeita entre todos os ecrãs (Painel de Quartos, Cartões de Hóspede, Modais operacionais, Dashboard Executivo, Bar & Consumos e Navegação).

---

## 1. Filosofia e Paleta de Cores (Warm Nude & Hospitality)

Nenhum componente deve usar tons genéricos frios (`slate-*`, `gray-*`, `zinc-*`, `blue-*` saturado) ou neons agressivos. A atmosfera do sistema reflete a sofisticação de hotéis boutique e lodges de alto padrão:

### 1.1 Cores Estruturais
| Papel | Nome | Hex Light | Hex Dark | Classe Tailwind recomendada |
| :--- | :--- | :--- | :--- | :--- |
| **Fundo de Página** | Warm Alabaster / Nogueira Noturna | `#FAF7F2` | `#1E1714` | `bg-[#FAF7F2] dark:bg-[#1E1714]` |
| **Superfície dos Cartões** | Marfim Nobre / Nogueira Profunda | `#FFFDF9` | `#201915` | `bg-[#FFFDF9] dark:bg-[#201915]` |
| **Containers Secundários** | Pergaminho / Madeira Nobre | `#F8F5EE` | `#261E1A` | `bg-[#F8F5EE] dark:bg-[#261E1A]` |
| **Micro-Bordas Nobres** | Areia Suave / Nogueira Borda | `#E5DFD6` | `#382D26` | `border-[#E5DFD6] dark:border-[#382D26]` |
| **Bordas Internas Sutis** | Areia Clara | `#EAE3D6` | `#332720` | `border-[#EAE3D6] dark:border-[#332720]` |

### 1.2 Cores de Acento & Marca
| Papel | Tom | Hex Light | Hex Dark | Uso |
| :--- | :--- | :--- | :--- | :--- |
| **Terracota Principal** | `#BA5A1A` | `#BA5A1A` | `#E88C4A` | Botões de ação, badges principais, estados ocupados |
| **Terracota Gradiente** | `from-[#BA5A1A] to-[#C86A2B]` | — | — | Botões primários (`+ Check-in`, `Salvar`, `Confirmar`) |
| **Ouro Champanhe** | `#DF9E42` | `#DF9E42` | `#E5B064` | Limpeza, estrelas, acentos secundários |
| **Verde Sálvia Hotelaria** | `#245D3B` | `#245D3B` | `#64C28D` | Quartos livres, faturação recebida, sucesso |
| **Carmim Nobre** | `#C53030` | `#C53030` | `#E56B6B` | Horas excedidas, cancelamentos, saídas pendentes |

---

## 2. Badges Semânticos de Estado de Quarto

Todos os cartões de quartos e tabelas devem seguir rigorosamente este mapeamento:

```tsx
// 1. Quarto Livre (Available)
badge: "bg-[#EDF6F0] dark:bg-[#1C3325] text-[#245D3B] dark:text-[#64C28D] border-[#CDE5D5] dark:border-[#2E543C]"
accentBar: "bg-gradient-to-r from-[#245D3B] to-[#488C64]"

// 2. Quarto Ocupado (Occupied)
badge: "bg-[#FAF0E6] dark:bg-[#34241B] text-[#BA5A1A] dark:text-[#E88C4A] border-[#F0D5C0] dark:border-[#523A2C]"
accentBar: "bg-gradient-to-r from-[#BA5A1A] to-[#C86A2B]"

// 3. Tempo Excedido / Overtime (Overdue)
badge: "bg-[#FDF0EE] dark:bg-[#3A1E1E] text-[#C53030] dark:text-[#E56B6B] border-[#FBD5D0] dark:border-[#602929]"
accentBar: "bg-gradient-to-r from-[#C53030] to-[#E55353]"

// 4. Em Limpeza (Cleaning)
badge: "bg-[#FAF4E6] dark:bg-[#362B1A] text-[#975A16] dark:text-[#E5B064] border-[#F6E0B5] dark:border-[#574426]"
accentBar: "bg-gradient-to-r from-[#DF9E42] to-[#E8B868]"

// 5. Em Manutenção (Maintenance)
badge: "bg-[#EFEBE4] dark:bg-[#2A2420] text-[#7A726C] dark:text-[#B0A69D] border-[#DDD6CC] dark:border-[#423932]"
accentBar: "bg-gradient-to-r from-[#7A726C] to-[#A69B93]"
```

---

## 3. Geometria de Cartões e Containers

- **Raio de Borda de Cartões:** Sempre `rounded-2xl`
- **Sombra Padrão:** `shadow-sm hover:shadow-md transition-all duration-200`
- **Botões Operacionais:** `rounded-xl h-9` ou `h-10`
- **Badges:** `rounded-full px-2.5 py-0.5 text-xs font-semibold`
- **Inputs & Selects:** `rounded-xl h-10 border-[#E5DFD6] dark:border-[#382D26] bg-white dark:bg-[#1E1714] focus-visible:ring-[#BA5A1A]`

---

## 4. Estrutura dos Modais (Dialogs)

Todos os diálogos operacionais de quartos (`check-in`, `check-out`, `extend-stay`, `room-consumption`, `room-form`) devem apresentar:

1. **Envelope do Diálogo:**
   `DialogContent className="rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] bg-[#FFFDF9] dark:bg-[#201915] text-[#251D18] dark:text-[#F5EFEB] shadow-xl"`
2. **Ícone de Cabeçalho em Box Acolhedor:**
   `w-10 h-10 rounded-xl bg-[#FAF0E6] dark:bg-[#34241B] border border-[#F0D5C0] dark:border-[#523A2C] flex items-center justify-center text-[#BA5A1A]`
3. **Resumo / Identificação:**
   `bg-[#F8F5EE] dark:bg-[#261E1A] rounded-2xl border border-[#E5DFD6] dark:border-[#382D26] p-3.5`
4. **Botão Primário de Conclusão:**
   `bg-gradient-to-r from-[#BA5A1A] to-[#C86A2B] hover:from-[#A44E16] hover:to-[#B55E22] text-white font-bold rounded-xl shadow-md shadow-[#BA5A1A]/20`

---

## 5. Regras Críticas de Conformidade

- **Nunca** utilizar `slate-50`, `slate-100`, `slate-200`, `slate-800` em cartões de quarto ou botões.
- **Nunca** misturar tons frios (azul elétrico, ciano, roxo) com o nude alabaster `#FAF7F2`.
- Moeda sempre formatada em Meticais (`MT`) com pontuação moçambicana.
- Datas no formato `dd/mm/aaaa` e horário `24h` (`14:30`).
