import { useState, useEffect } from 'react';

type PlaceholderType = 'category' | 'product' | 'email' | 'address' | 'person' | 'phone' | 'money' | 'company' | 'generic';

const EXAMPLES: Record<PlaceholderType, string[]> = {
    category: [
        "Ex: Equipamento de Escritório",
        "Ex: Serviços de Consultoria",
        "Ex: Matérias-Primas",
        "Ex: Veículos da Frota",
        "Ex: Hardware e Software",
        "Ex: Mobiliário Corporativo",
        "Ex: Consumíveis de Limpeza",
        "Ex: Material Elétrico",
        "Ex: Fardamento",
        "Ex: Ferramentas de Precisão"
    ],
    product: [
        "Ex: MacBook Pro M3",
        "Ex: Secretária Ergonómica",
        "Ex: Cimento Portland 42.5N",
        "Ex: Licença Software ERP",
        "Ex: Toyota Hilux 4x4",
        "Ex: Projetor 4K",
        "Ex: Servidor Rack Dell",
        "Ex: Cadeira Executiva",
        "Ex: Kit Ferramentas Bosch",
        "Ex: Monitor UltraWide 34\""
    ],
    email: [
        "Ex: gestao@empresa.com",
        "Ex: financeiro@corporacao.mz",
        "Ex: compras@grupo.co.mz",
        "Ex: admin@logistica.net",
        "Ex: suporte@tech.io",
        "Ex: diretor@holding.com",
        "Ex: rh@talentos.org",
        "Ex: vendas@global.biz",
        "Ex: info@parceiros.pt",
        "Ex: contabilidade@fiscal.mz"
    ],
    address: [
        "Ex: Av. Julius Nyerere, 123, Maputo",
        "Ex: Rua dos Desportistas, Edifício JAT, Andar 5",
        "Ex: Bairro da Polana Cimento A, Av. 24 de Julho",
        "Ex: Zona Industrial da Matola, Talhão 45",
        "Ex: Av. Vladimir Lenin, Prédio 33, Beira",
        "Ex: Estrada Nacional Nº 1, Km 15, Zimpeto",
        "Ex: Av. Marginal, Condomíniomares, Bloco B",
        "Ex: Rua da Mesquita, Nampula",
        "Ex: Av. Samora Machel, Xai-Xai",
        "Ex: Parque Industrial de Beluluane"
    ],
    person: [
        "Ex: Carlos Mucavel",
        "Ex: Sofia Manhiça",
        "Ex: João Macuácua",
        "Ex: Ana Paula Santos",
        "Ex: Fernando Tivane",
        "Ex: Beatriz Costa",
        "Ex: Paulo Mabunda",
        "Ex: Luísa Diogo",
        "Ex: Ricardo Mondlane",
        "Ex: Helena Cossa"
    ],
    phone: [
        "Ex: +258 84 123 4567",
        "Ex: +258 82 987 6543",
        "Ex: +258 87 555 1234",
        "Ex: +258 86 000 1111",
        "Ex: +258 21 400 500"
    ],
    money: [
        "Ex: 15.000,00",
        "Ex: 2.500,00",
        "Ex: 125.000,00",
        "Ex: 500,00",
        "Ex: 45.900,00"
    ],
    company: [
        "Ex: Constroi Moz Lda",
        "Ex: Global Tech Solutions",
        "Ex: Logística Integrada SA",
        "Ex: Grupo Empresarial Maputo",
        "Ex: Inovação & Design",
        "Ex: Consultores Associados",
        "Ex: Holdings de Moçambique",
        "Ex: Exportações do Índico",
        "Ex: Serviços Mineiros do Norte",
        "Ex: Agro-Indústria do Centro"
    ],
    generic: [
        "Ex: Digite aqui...",
        "Ex: Valor do campo...",
        "Ex: Informação necessária...",
        "Ex: Preencha este dado..."
    ]
};

export function useDynamicPlaceholder(type: PlaceholderType = 'generic', shouldUpdate: boolean = true) {
    const [placeholder, setPlaceholder] = useState("");

    useEffect(() => {
        if (shouldUpdate) {
            const list = EXAMPLES[type] || EXAMPLES.generic;
            const random = list[Math.floor(Math.random() * list.length)];
            setPlaceholder(random);
        }
    }, [type, shouldUpdate]);

    return placeholder;
}
