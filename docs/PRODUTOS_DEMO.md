# Catálogo de 30 Produtos de Demonstração — MajorStockX

> **Objetivo:** Catálogo de dados de demonstração (Demo / Modo Convidado) calibrado para o mercado de Moçambique (PMEs: Ferragens, Construção, Eletricidade, Canalização e Mercearia/Armazém).
> **Moeda:** Meticais (MT / MZN).
> **Propósito no Funil de Vendas:** Permitir ao utilizador convidado testar imediatamente o `/pos` (Venda Rápida), alertas visuais de stock, cálculo de margens de lucro e emissão de guias/faturas em PDF com dados realistas.

---

## 1. Resumo por Categoria e Cenários de Stock

Os 30 produtos cobrem 6 áreas comerciais estratégicas e incluem 3 estados de inventário para exibir os alertas do sistema em tempo real:
- **Stock Saudável / Normal:** 20 produtos
- **Alerta de Stock Baixo:** 6 produtos (ativam aviso amarelo no dashboard)
- **Alerta Crítico / Ruptura Iminente:** 4 produtos (ativam aviso vermelho e notificações)

---

## 2. Tabela Detalhada dos 30 Produtos

| # | ID / Código | Produto | Categoria | Unidade | Custo (MT) | Venda (MT) | Margem | Stock Atual | Mín. | Crítico | Localização | Estado |
|---|---|---|---|:---:|---:|---:|---:|---:|---:|---:|---|:---:|
| **1** | `DEMO-CIM-01` | Cimento Portland 32.5N Limak 50kg | Materiais de Construção | saco | 480,00 | 580,00 | 20.8% | 150 | 30 | 10 | Armazém Principal | Normal |
| **2** | `DEMO-BLO-02` | Bloco de Betão 15 cm (Vibropensado) | Materiais de Construção | un | 28,00 | 42,00 | 50.0% | 850 | 200 | 50 | Pátio de Produção | Normal |
| **3** | `DEMO-VAR-03` | Varão de Aço Nervurado 10 mm (12m) | Materiais de Construção | barra | 390,00 | 490,00 | 25.6% | **4** | 20 | 5 | Setor Metais | 🔴 **Crítico** |
| **4** | `DEMO-VAR-04` | Varão de Aço Nervurado 12 mm (12m) | Materiais de Construção | barra | 560,00 | 690,00 | 23.2% | 45 | 15 | 5 | Setor Metais | Normal |
| **5** | `DEMO-ARE-05` | Areia Grossa de Rio Lavada | Materiais de Construção | m³ | 1.800,00 | 2.500,00 | 38.9% | 25 | 10 | 3 | Pátio Aberto | Normal |
| **6** | `DEMO-BRI-06` | Brita 1 para Betão | Materiais de Construção | m³ | 2.100,00 | 2.850,00 | 35.7% | **8** | 10 | 3 | Pátio Aberto | 🟡 **Baixo** |
| **7** | `DEMO-CHA-07` | Chapa de Zinco Ondulada IBR 0.40mm x 6m | Coberturas | un | 620,00 | 780,00 | 25.8% | 90 | 25 | 10 | Armazém B | Normal |
| **8** | `DEMO-PRE-08` | Prego de Cabeça Redonda 3" | Ferragens | kg | 85,00 | 130,00 | 52.9% | 120 | 30 | 10 | Prateleira F1 | Normal |
| **9** | `DEMO-ARA-09` | Arame Queimado Recozido 1.2mm | Ferragens | kg | 90,00 | 140,00 | 55.6% | **7** | 20 | 5 | Prateleira F1 | 🟡 **Baixo** |
| **10** | `DEMO-FEC-10` | Fechadura de Embutir com Puxador Cromado | Ferragens | un | 650,00 | 950,00 | 46.2% | 18 | 8 | 3 | Vitrine Loja | Normal |
| **11** | `DEMO-MAR-11` | Martelo de Carpinteiro 500g Cabo Fibra | Ferramentas | un | 320,00 | 480,00 | 50.0% | 14 | 5 | 2 | Painel Ferramentas | Normal |
| **12** | `DEMO-DIS-12` | Disco de Corte para Metal 115mm (4.5") | Consumíveis | un | 45,00 | 80,00 | 77.8% | **3** | 25 | 5 | Gaveta Balcão | 🔴 **Crítico** |
| **13** | `DEMO-FIT-13` | Fita Métrica 5m com Bloqueador | Ferramentas | un | 140,00 | 220,00 | 57.1% | 22 | 8 | 2 | Painel Ferramentas | Normal |
| **14** | `DEMO-TUB-14` | Tubo PVC Esgoto 110mm x 6m | Canalização | barra | 520,00 | 690,00 | 32.7% | 35 | 10 | 4 | Corredor Tubagens | Normal |
| **15** | `DEMO-TUB-15` | Tubo PPR Soldável Água Quente/Fria 25mm x 4m | Canalização | barra | 280,00 | 390,00 | 39.3% | **6** | 15 | 5 | Corredor Tubagens | 🟡 **Baixo** |
| **16** | `DEMO-TOR-16` | Torneira de Passagem Esfera 3/4" Latão | Canalização | un | 210,00 | 320,00 | 52.4% | 28 | 10 | 3 | Gaveteiro Hidráulica | Normal |
| **17** | `DEMO-JOE-17` | Joelho PVC 90° Esgoto 110mm | Canalização | un | 55,00 | 95,00 | 72.7% | 65 | 20 | 5 | Caixa Plástica H2 | Normal |
| **18** | `DEMO-CAB-18` | Cabo Elétrico Unipolar Flexível 2.5mm² (Rolo 100m) | Eletricidade | rolo | 1.850,00 | 2.450,00 | 32.4% | 16 | 6 | 2 | Armazém Fechado | Normal |
| **19** | `DEMO-DIS-19` | Disjuntor Bipolar DIN 20A Curva C | Eletricidade | un | 240,00 | 380,00 | 58.3% | 24 | 10 | 3 | Painel Elétrico | Normal |
| **20** | `DEMO-LAM-20` | Lâmpada LED Bulbo 9W E27 Luz Branca 6500K | Eletricidade | un | 60,00 | 110,00 | 83.3% | 140 | 30 | 10 | Prateleira E2 | Normal |
| **21** | `DEMO-TOM-21` | Tomada Dupla de Embutir 2P+T 16A | Eletricidade | un | 95,00 | 160,00 | 68.4% | **2** | 15 | 4 | Prateleira E2 | 🔴 **Crítico** |
| **22** | `DEMO-TIN-22` | Tinta Acrílica Fosca Branca Exterior 20 L | Tintas & Acabamento | balde | 3.800,00 | 4.950,00 | 30.3% | **9** | 15 | 4 | Setor Tintas | 🟡 **Baixo** |
| **23** | `DEMO-VER-23` | Verniz Poliuretano Marítimo Brilhante 5 L | Tintas & Acabamento | lata | 1.250,00 | 1.750,00 | 40.0% | 15 | 5 | 2 | Setor Tintas | Normal |
| **24** | `DEMO-ROL-24` | Rolo de Pintura Anti-Gota 23cm c/ Garfo | Acessórios Pintura | un | 180,00 | 280,00 | 55.6% | 30 | 10 | 3 | Prateleira T1 | Normal |
| **25** | `DEMO-COL-25` | Cola de Madeira PVA Extra Forte 1 kg | Adesivos & Químicos | un | 190,00 | 290,00 | 52.6% | 20 | 6 | 2 | Prateleira T2 | Normal |
| **26** | `DEMO-ARR-26` | Arroz Vaporizado 25 kg (Grão Longo) | Mercearia Grossista | saco | 1.150,00 | 1.350,00 | 17.4% | 75 | 20 | 5 | Palete Alimentar 1 | Normal |
| **27** | `DEMO-OLE-27` | Óleo Alimentar Vegetal 5 L | Mercearia Grossista | garrafão | 490,00 | 590,00 | 20.4% | **12** | 20 | 5 | Palete Alimentar 2 | 🟡 **Baixo** |
| **28** | `DEMO-ACU-28` | Açúcar Castanho Nacional 50 kg | Mercearia Grossista | saco | 2.450,00 | 2.850,00 | 16.3% | 40 | 10 | 3 | Palete Alimentar 1 | Normal |
| **29** | `DEMO-AGU-29` | Água Mineral Natural 500 ml (Fardo c/ 24) | Bebidas | fardo | 280,00 | 380,00 | 35.7% | 50 | 15 | 5 | Depósito Bebidas | Normal |
| **30** | `DEMO-SAB-30` | Sabão em Barra Azul 1 kg (Caixa c/ 20) | Higiene & Limpeza | caixa | 680,00 | 850,00 | 25.0% | **1** | 10 | 3 | Prateleira Limpeza | 🔴 **Crítico** |

---

## 3. Especificação JSON Pronta para Injeção

Este formato é diretamente compatível com o modelo de dados `Product` de [`src/lib/types.ts`](file:///c:/Users/DELL/Digital%20projects/EA/Majordocs/src/lib/types.ts) e [`src/lib/demo-data.ts`](file:///c:/Users/DELL/Digital%20projects/EA/Majordocs/src/lib/demo-data.ts):

```json
[
  {
    "id": "demo-cim-01",
    "instanceId": "demo-cim-01",
    "name": "Cimento Portland 32.5N Limak 50kg",
    "category": "Materiais de Construção",
    "unit": "saco",
    "cost": 480,
    "price": 580,
    "stock": 150,
    "reservedStock": 0,
    "lowStockThreshold": 30,
    "criticalStockThreshold": 10,
    "location": "Armazém Principal",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-blo-02",
    "instanceId": "demo-blo-02",
    "name": "Bloco de Betão 15 cm",
    "category": "Materiais de Construção",
    "unit": "un",
    "cost": 28,
    "price": 42,
    "stock": 850,
    "reservedStock": 0,
    "lowStockThreshold": 200,
    "criticalStockThreshold": 50,
    "location": "Pátio de Produção",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-var-03",
    "instanceId": "demo-var-03",
    "name": "Varão de Aço 10 mm (12m)",
    "category": "Materiais de Construção",
    "unit": "barra",
    "cost": 390,
    "price": 490,
    "stock": 4,
    "reservedStock": 0,
    "lowStockThreshold": 20,
    "criticalStockThreshold": 5,
    "location": "Setor Metais",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-var-04",
    "instanceId": "demo-var-04",
    "name": "Varão de Aço 12 mm (12m)",
    "category": "Materiais de Construção",
    "unit": "barra",
    "cost": 560,
    "price": 690,
    "stock": 45,
    "reservedStock": 0,
    "lowStockThreshold": 15,
    "criticalStockThreshold": 5,
    "location": "Setor Metais",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-are-05",
    "instanceId": "demo-are-05",
    "name": "Areia Grossa de Rio",
    "category": "Materiais de Construção",
    "unit": "m³",
    "cost": 1800,
    "price": 2500,
    "stock": 25,
    "reservedStock": 0,
    "lowStockThreshold": 10,
    "criticalStockThreshold": 3,
    "location": "Pátio Aberto",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-bri-06",
    "instanceId": "demo-bri-06",
    "name": "Brita 1 para Betão",
    "category": "Materiais de Construção",
    "unit": "m³",
    "cost": 2100,
    "price": 2850,
    "stock": 8,
    "reservedStock": 0,
    "lowStockThreshold": 10,
    "criticalStockThreshold": 3,
    "location": "Pátio Aberto",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-cha-07",
    "instanceId": "demo-cha-07",
    "name": "Chapa de Zinco IBR 0.40mm x 6m",
    "category": "Coberturas",
    "unit": "un",
    "cost": 620,
    "price": 780,
    "stock": 90,
    "reservedStock": 0,
    "lowStockThreshold": 25,
    "criticalStockThreshold": 10,
    "location": "Armazém B",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-pre-08",
    "instanceId": "demo-pre-08",
    "name": "Prego de Cabeça Redonda 3\"",
    "category": "Ferragens",
    "unit": "kg",
    "cost": 85,
    "price": 130,
    "stock": 120,
    "reservedStock": 0,
    "lowStockThreshold": 30,
    "criticalStockThreshold": 10,
    "location": "Prateleira F1",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-ara-09",
    "instanceId": "demo-ara-09",
    "name": "Arame Queimado Recozido 1.2mm",
    "category": "Ferragens",
    "unit": "kg",
    "cost": 90,
    "price": 140,
    "stock": 7,
    "reservedStock": 0,
    "lowStockThreshold": 20,
    "criticalStockThreshold": 5,
    "location": "Prateleira F1",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-fec-10",
    "instanceId": "demo-fec-10",
    "name": "Fechadura de Embutir c/ Puxador",
    "category": "Ferragens",
    "unit": "un",
    "cost": 650,
    "price": 950,
    "stock": 18,
    "reservedStock": 0,
    "lowStockThreshold": 8,
    "criticalStockThreshold": 3,
    "location": "Vitrine Loja",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-mar-11",
    "instanceId": "demo-mar-11",
    "name": "Martelo de Carpinteiro 500g",
    "category": "Ferramentas",
    "unit": "un",
    "cost": 320,
    "price": 480,
    "stock": 14,
    "reservedStock": 0,
    "lowStockThreshold": 5,
    "criticalStockThreshold": 2,
    "location": "Painel Ferramentas",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-dis-12",
    "instanceId": "demo-dis-12",
    "name": "Disco de Corte Metal 115mm",
    "category": "Consumíveis",
    "unit": "un",
    "cost": 45,
    "price": 80,
    "stock": 3,
    "reservedStock": 0,
    "lowStockThreshold": 25,
    "criticalStockThreshold": 5,
    "location": "Gaveta Balcão",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-fit-13",
    "instanceId": "demo-fit-13",
    "name": "Fita Métrica 5m",
    "category": "Ferramentas",
    "unit": "un",
    "cost": 140,
    "price": 220,
    "stock": 22,
    "reservedStock": 0,
    "lowStockThreshold": 8,
    "criticalStockThreshold": 2,
    "location": "Painel Ferramentas",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-tub-14",
    "instanceId": "demo-tub-14",
    "name": "Tubo PVC Esgoto 110mm x 6m",
    "category": "Canalização",
    "unit": "barra",
    "cost": 520,
    "price": 690,
    "stock": 35,
    "reservedStock": 0,
    "lowStockThreshold": 10,
    "criticalStockThreshold": 4,
    "location": "Corredor Tubagens",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-tub-15",
    "instanceId": "demo-tub-15",
    "name": "Tubo PPR Soldável 25mm x 4m",
    "category": "Canalização",
    "unit": "barra",
    "cost": 280,
    "price": 390,
    "stock": 6,
    "reservedStock": 0,
    "lowStockThreshold": 15,
    "criticalStockThreshold": 5,
    "location": "Corredor Tubagens",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-tor-16",
    "instanceId": "demo-tor-16",
    "name": "Torneira de Esfera 3/4\"",
    "category": "Canalização",
    "unit": "un",
    "cost": 210,
    "price": 320,
    "stock": 28,
    "reservedStock": 0,
    "lowStockThreshold": 10,
    "criticalStockThreshold": 3,
    "location": "Gaveteiro Hidráulica",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-joe-17",
    "instanceId": "demo-joe-17",
    "name": "Joelho PVC 90° 110mm",
    "category": "Canalização",
    "unit": "un",
    "cost": 55,
    "price": 95,
    "stock": 65,
    "reservedStock": 0,
    "lowStockThreshold": 20,
    "criticalStockThreshold": 5,
    "location": "Caixa Plástica H2",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-cab-18",
    "instanceId": "demo-cab-18",
    "name": "Cabo Elétrico Flexível 2.5mm² (100m)",
    "category": "Eletricidade",
    "unit": "rolo",
    "cost": 1850,
    "price": 2450,
    "stock": 16,
    "reservedStock": 0,
    "lowStockThreshold": 6,
    "criticalStockThreshold": 2,
    "location": "Armazém Fechado",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-dis-19",
    "instanceId": "demo-dis-19",
    "name": "Disjuntor Bipolar DIN 20A",
    "category": "Eletricidade",
    "unit": "un",
    "cost": 240,
    "price": 380,
    "stock": 24,
    "reservedStock": 0,
    "lowStockThreshold": 10,
    "criticalStockThreshold": 3,
    "location": "Painel Elétrico",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-lam-20",
    "instanceId": "demo-lam-20",
    "name": "Lâmpada LED 9W E27 6500K",
    "category": "Eletricidade",
    "unit": "un",
    "cost": 60,
    "price": 110,
    "stock": 140,
    "reservedStock": 0,
    "lowStockThreshold": 30,
    "criticalStockThreshold": 10,
    "location": "Prateleira E2",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-tom-21",
    "instanceId": "demo-tom-21",
    "name": "Tomada Dupla de Embutir 2P+T",
    "category": "Eletricidade",
    "unit": "un",
    "cost": 95,
    "price": 160,
    "stock": 2,
    "reservedStock": 0,
    "lowStockThreshold": 15,
    "criticalStockThreshold": 4,
    "location": "Prateleira E2",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-tin-22",
    "instanceId": "demo-tin-22",
    "name": "Tinta Acrílica Branca 20 L",
    "category": "Tintas & Acabamento",
    "unit": "balde",
    "cost": 3800,
    "price": 4950,
    "stock": 9,
    "reservedStock": 0,
    "lowStockThreshold": 15,
    "criticalStockThreshold": 4,
    "location": "Setor Tintas",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-ver-23",
    "instanceId": "demo-ver-23",
    "name": "Verniz Marítimo 5 L",
    "category": "Tintas & Acabamento",
    "unit": "lata",
    "cost": 1250,
    "price": 1750,
    "stock": 15,
    "reservedStock": 0,
    "lowStockThreshold": 5,
    "criticalStockThreshold": 2,
    "location": "Setor Tintas",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-rol-24",
    "instanceId": "demo-rol-24",
    "name": "Rolo de Pintura Anti-Gota 23cm",
    "category": "Acessórios Pintura",
    "unit": "un",
    "cost": 180,
    "price": 280,
    "stock": 30,
    "reservedStock": 0,
    "lowStockThreshold": 10,
    "criticalStockThreshold": 3,
    "location": "Prateleira T1",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-col-25",
    "instanceId": "demo-col-25",
    "name": "Cola de Madeira PVA 1 kg",
    "category": "Adesivos & Químicos",
    "unit": "un",
    "cost": 190,
    "price": 290,
    "stock": 20,
    "reservedStock": 0,
    "lowStockThreshold": 6,
    "criticalStockThreshold": 2,
    "location": "Prateleira T2",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-arr-26",
    "instanceId": "demo-arr-26",
    "name": "Arroz Vaporizado 25 kg",
    "category": "Mercearia Grossista",
    "unit": "saco",
    "cost": 1150,
    "price": 1350,
    "stock": 75,
    "reservedStock": 0,
    "lowStockThreshold": 20,
    "criticalStockThreshold": 5,
    "location": "Palete Alimentar 1",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-ole-27",
    "instanceId": "demo-ole-27",
    "name": "Óleo Vegetal 5 L",
    "category": "Mercearia Grossista",
    "unit": "garrafão",
    "cost": 490,
    "price": 590,
    "stock": 12,
    "reservedStock": 0,
    "lowStockThreshold": 20,
    "criticalStockThreshold": 5,
    "location": "Palete Alimentar 2",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-acu-28",
    "instanceId": "demo-acu-28",
    "name": "Açúcar Castanho 50 kg",
    "category": "Mercearia Grossista",
    "unit": "saco",
    "cost": 2450,
    "price": 2850,
    "stock": 40,
    "reservedStock": 0,
    "lowStockThreshold": 10,
    "criticalStockThreshold": 3,
    "location": "Palete Alimentar 1",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-agu-29",
    "instanceId": "demo-agu-29",
    "name": "Água Mineral 500 ml (Fardo c/ 24)",
    "category": "Bebidas",
    "unit": "fardo",
    "cost": 280,
    "price": 380,
    "stock": 50,
    "reservedStock": 0,
    "lowStockThreshold": 15,
    "criticalStockThreshold": 5,
    "location": "Depósito Bebidas",
    "lastUpdated": "2026-11-06T12:00:00Z"
  },
  {
    "id": "demo-sab-30",
    "instanceId": "demo-sab-30",
    "name": "Sabão Azul 1 kg (Caixa c/ 20)",
    "category": "Higiene & Limpeza",
    "unit": "caixa",
    "cost": 680,
    "price": 850,
    "stock": 1,
    "reservedStock": 0,
    "lowStockThreshold": 10,
    "criticalStockThreshold": 3,
    "location": "Prateleira Limpeza",
    "lastUpdated": "2026-11-06T12:00:00Z"
  }
]
```

---

## 4. Instruções de Fidelidade ao Ficheiro

1. **Intocabilidade do Código:** Nenhum outro ficheiro da aplicação (`.tsx`, `.ts`, `.mjs`, `.json`) foi modificado.
2. **Compatibilidade Direta:** Quando for solicitada a ativação deste catálogo no código (ex.: em [`src/lib/demo-data.ts`](file:///c:/Users/DELL/Digital%20projects/EA/Majordocs/src/lib/demo-data.ts)), estes mesmos 30 registos devem ser usados sem qualquer desvio de campos, preços ou nomes.
3. **Casos de Teste Prontos:**
   - **Venda Rápida por Voz:** Dizer *"Cimento Limak x 10"* ou *"Arroz 25kg x 2"* testa o algoritmo de correspondência com nomes autênticos.
   - **Alerta no Painel:** Os itens com IDs `demo-var-03`, `demo-dis-12`, `demo-tom-21` e `demo-sab-30` acionam de imediato o banner de stock crítico no dashboard.
