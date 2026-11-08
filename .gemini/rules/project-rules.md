# Regras de Desenvolvimento do Projeto

Usar em qualquer tarefa de código neste projeto (criar, alterar, corrigir, fazer deploy).

## Idioma Obrigatório
Responder sempre em português de Moçambique.

---

## 1. Antes de Mexer
- Lê os ficheiros relevantes e o código à volta antes de alterar. Não assumas como o código funciona, confirma.
- Para qualquer tarefa com mais de uma alteração, diz primeiro o plano em poucas linhas e aguarda resposta se houver dúvida real sobre o que o utilizador quer.
- Não adiciones funções, ecrãs ou dependências que não foram pedidas. Se achares que falta algo, pergunta antes.
- Nunca apagues ficheiros nem código sem perguntar. Nunca toques em `.env*`, chaves ou credenciais, e nunca as escrevas no repositório.
- Faz a alteração mínima que resolve o problema. Não reformates nem reorganizes código que não faz parte da tarefa.

---

## 2. Verificação Obrigatória (Nunca dizer "feito" sem isto)
Depois de cada alteração de código, por esta ordem:
1. `npx tsc --noEmit` tem de passar sem erros.
2. Os testes (`npm test` ou o comando do projeto) têm de passar. Se alteraste lógica, escreve ou atualiza testes.
3. O linter do projeto sem erros (`npm run lint`).
4. `npm run build` tem de passar localmente — é a prova de que o Vercel vai passar. Se o build não puder correr (ex.: sem rede), diz claramente que não conseguiu, porquê, e o que verificaste no lugar.
5. Para alterações de interface: abre a app, usa o fluxo alterado e relata o que viste.
- Mostra o resultado real dos comandos (resumo do que passou e falhou). Não escrever "deve funcionar" nem "provavelmente está bem".

---

## 3. O que Causa Erros de Build no Vercel (Evitar Sempre)
- Erros de TypeScript: não usar `any`, `@ts-ignore` nem `as unknown as` para os calar. Corrige o tipo.
- Nunca ativar `ignoreBuildErrors` nem `ignoreDuringBuilds` para o build passar.
- Importar código do servidor (`firebase-admin`, segredos) num componente de cliente.
- Usar `window`, `localStorage` ou `document` durante a renderização no servidor. Usar `useEffect` ou verificar `typeof window`.
- Usar hooks do Next (`useSearchParams`, etc.) sem `Suspense` onde o Next exige.
- Variáveis de ambiente novas: se criares uma, acrescenta o nome ao `.env.example` e avisa para colocar no Vercel. Nunca assumir que ela existe.
- Imports com maiúsculas/minúsculas diferentes do nome do ficheiro (funciona no Windows, falha no Linux do Vercel).
- Dependências instaladas mas não guardadas no `package.json` ou no lockfile. Depois de instalar, confirmar que `npm ci` funciona.
- Rotas de API que dependem de dados em tempo real: `export const dynamic = 'force-dynamic'`.

---

## 4. Segurança e Dados
- Nunca confies em dados que vêm do cliente. Valida no servidor.
- Alterações nas regras do Firestore têm de vir com teste e com explicação do que passa a ser permitido ou bloqueado.
- Nada de escrever em disco em produção. Nada de segredos em código ou logs.

---

## 5. Honestidade no Relatório Final
Quando terminares, diz em poucas linhas:
- O que mudaste e porquê;
- O que verificaste e o resultado;
- O que NÃO conseguiste verificar;
- O que ainda pode estar errado ou ficou por fazer. Se cometeste um erro, diz qual foi e corrige. Não esconder problemas nem exagerar o feito.

---

## 6. Estilo
- Respostas curtas e diretas, sem entusiasmo exagerado nem listas enormes.
- Código simples e legível, no estilo que o projeto já usa. Segue os padrões existentes.
- Visual sóbrio: uma cor principal e neutros, sem gradientes nem animações chamativas, botões grandes e texto legível em telemóvel.
