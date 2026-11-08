import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Termos de Uso — MajorStockX" };

export default function TermosPage() {
    return (
        <LegalPage title="Termos de Uso" updated="13 de Outubro de 2026">
            <p>Estes termos explicam as regras de uso da MajorStockX, uma aplicação para registar vendas, stock e documentos da sua empresa. Ao criar uma conta ou usar a aplicação, aceita estes termos.</p>

            <h2>1. A sua conta</h2>
            <ul>
                <li>A conta é da empresa registada. Quem a cria é o administrador e responde pelo uso que os funcionários fazem dela.</li>
                <li>Guarde a sua senha em segredo. Tudo o que for feito com a sua conta é da sua responsabilidade.</li>
                <li>Os dados que regista (produtos, preços, vendas, clientes) devem ser verdadeiros e de uso lícito.</li>
            </ul>

            <h2>2. Teste gratuito e pagamento</h2>
            <ul>
                <li>Uma empresa nova tem um período de teste gratuito. Depois, para continuar a registar, é preciso uma subscrição (mensal, trimestral ou anual).</li>
                <li>O pagamento é feito antes de cada período, pelos meios indicados na aplicação (por exemplo M-Pesa) ou através de parceiros (por exemplo EscalePay).</li>
                <li>Sem subscrição activa, a conta fica em modo de leitura: os seus dados continuam guardados e pode consultá-los, mas não registar novos movimentos.</li>
                <li>Os preços podem mudar; uma mudança nunca afecta um período já pago.</li>
                <li>Pagamentos já feitos não são devolvidos, salvo em caso de cobrança errada.</li>
            </ul>

            <h2>3. Os seus dados</h2>
            <ul>
                <li>Os dados que regista são seus. Pode exportá-los em Ajustes → Segurança &amp; Dados.</li>
                <li>Tratamos os dados conforme a nossa <a className="text-primary underline" href="/privacidade">Política de Privacidade</a>.</li>
                <li>Ao criar a conta, aceita receber emails sobre ela (fim do teste ou da subscrição, pagamentos) e dicas e lembretes de uso. As dicas podem ser desligadas a qualquer momento, no link de cada email ou em Ajustes → Empresa.</li>
            </ul>

            <h2>4. Documentos e obrigações fiscais</h2>
            <p>A aplicação ajuda a emitir facturas, recibos, guias e outros documentos. A empresa continua responsável por confirmar que os seus documentos e declarações cumprem as obrigações fiscais aplicáveis, se necessário com o seu contabilista.</p>

            <h2>5. Funcionamento do serviço</h2>
            <ul>
                <li>Fazemos o possível para que a aplicação funcione sempre e sem erros, mas podem acontecer falhas ou interrupções (por exemplo, de internet ou dos serviços onde a aplicação está alojada).</li>
                <li>Pode haver actualizações que mudam ou melhoram funcionalidades.</li>
                <li>Não respondemos por perdas indirectas resultantes do uso ou da impossibilidade de uso da aplicação. A nossa responsabilidade limita-se ao valor pago nos últimos 3 meses.</li>
            </ul>

            <h2>6. Uso proibido</h2>
            <p>Não é permitido usar a aplicação para actividades ilegais, tentar aceder a dados de outras empresas, copiar ou revender o serviço, ou prejudicar o seu funcionamento. Nesses casos a conta pode ser suspensa.</p>

            <h2>7. Fim da conta</h2>
            <p>Pode deixar de usar a aplicação quando quiser. Pode pedir a eliminação dos dados da empresa pelo suporte; antes, recomendamos exportá-los.</p>

            <h2>8. Alterações e lei aplicável</h2>
            <p>Podemos actualizar estes termos; a data no topo mostra a versão em vigor e as mudanças importantes são avisadas na aplicação. Aplica-se a lei da República de Moçambique.</p>
        </LegalPage>
    );
}
