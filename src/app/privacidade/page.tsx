import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Política de Privacidade — MajorStockX" };

export default function PrivacidadePage() {
    return (
        <LegalPage title="Política de Privacidade" updated="13 de Outubro de 2026">
            <p>Esta política explica que dados a MajorStockX guarda, para quê, e quem os pode ver. Em resumo: os dados são da sua empresa, servem só para a aplicação funcionar, e não os vendemos.</p>

            <h2>1. Que dados guardamos</h2>
            <ul>
                <li><b>Da conta:</b> nome da empresa, nome e email dos utilizadores, e os dados da empresa que preencher (NUIT, telefone, endereço, logótipo).</li>
                <li><b>Do negócio:</b> produtos, preços, stock, vendas, encomendas, produção, despesas, documentos e clientes que registar (por exemplo, nome e telefone de um cliente).</li>
                <li><b>De pagamento da subscrição:</b> o plano, a data e a referência do pagamento. Os dados da sua carteira (M-Pesa, e-Mola) ficam com o provedor de pagamento, não connosco.</li>
                <li><b>Técnicos:</b> registos de erros e de acesso, para corrigir problemas e proteger as contas.</li>
            </ul>

            <h2>2. Para que usamos</h2>
            <ul>
                <li>Para a aplicação funcionar: mostrar o seu stock, registar vendas, emitir documentos, enviar avisos e relatórios que activar.</li>
                <li>Para dar suporte quando nos pede ajuda.</li>
                <li>Para lhe enviar <b>emails sobre a conta</b> (fim do teste ou da subscrição, pagamentos) e <b>dicas e lembretes de uso</b> (primeiros passos, contagem do stock em atraso, ajuda quando não usa a app há uns dias). Para isso registamos quando a app foi usada pela última vez. As dicas podem ser desligadas a qualquer momento (link no fim de cada email, ou Ajustes → Empresa); os avisos sobre a conta continuam a chegar enquanto ela existir.</li>
                <li>Para cobrar a subscrição e prevenir abusos.</li>
            </ul>
            <p>Não vendemos nem alugamos os seus dados, e não os usamos para publicidade de terceiros.</p>

            <h2>3. Quem pode ver</h2>
            <ul>
                <li>Os utilizadores da sua empresa, conforme as permissões que o administrador lhes der.</li>
                <li>A equipa da MajorStockX, só quando é preciso para suporte, segurança ou cobrança.</li>
                <li>Os serviços que alojam e fazem funcionar a aplicação (Google Firebase, Vercel), os de envio de emails e os provedores de pagamento — apenas o necessário para cada função.</li>
                <li>Autoridades, só quando a lei o exigir.</li>
            </ul>

            <h2>4. Onde e por quanto tempo</h2>
            <p>Os dados ficam em servidores dos serviços acima, que podem estar fora de Moçambique, com acesso protegido por senha e regras de segurança. Guardamo-los enquanto a conta existir; depois de um pedido de eliminação, apagamo-los num prazo razoável, excepto o que a lei obrigue a guardar.</p>

            <h2>5. No seu telemóvel</h2>
            <p>Para funcionar sem internet, a aplicação guarda no aparelho uma cópia dos dados e algumas preferências (por exemplo, o lote do Stock Rápido). Ao sair da conta num aparelho partilhado, essas cópias deixam de estar acessíveis pela conta.</p>

            <h2>6. Os seus direitos</h2>
            <ul>
                <li>Ver e exportar os dados da empresa (Ajustes → Segurança &amp; Dados).</li>
                <li>Corrigir dados errados.</li>
                <li>Pedir a eliminação da conta e dos dados, pelo suporte.</li>
            </ul>

            <h2>7. Alterações</h2>
            <p>Se mudarmos esta política, a data no topo é actualizada e as mudanças importantes são avisadas na aplicação.</p>
        </LegalPage>
    );
}
