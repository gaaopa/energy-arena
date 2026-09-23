# Energy Arena — contrato de trabalho para agentes

Sistema de gestão de academia multi-unidade (2 unidades, ~400 alunos): cadastro de alunos
(CPF, nascimento), matrículas com plano e valor, cobranças e baixa de pagamento, check-in,
RBAC por unidade. Quem usa é a recepção e o dono. **Em conflito entre velocidade e
qualidade, qualidade vence: o código daqui decide quem entra na academia e quanto cada
aluno deve.** Um erro de matrícula ou de baixa cobra a pessoa errada; um erro de escopo de
unidade vaza CPF e histórico de pagamento de outra unidade.

Antes de agir, leia `memoria/MEMORY.md` (índice de lições que não estão no código).

## Como um pedido vira trabalho

### Pergunta é pergunta
Pedido de diagnóstico ou de possibilidade ("dá para...?", "por que...?") autoriza investigar
e responder, não escrever nem produzir efeito externo. O inverso também vale: ordem explícita
mantém a autorização nas fases dependentes; não peça o mesmo OK duas vezes.

### Níveis, declarados na primeira linha da resposta
O nível mede o tamanho do que se constrói, nunca o assunto (quase tudo aqui é sensível; o que
protege o sensível é a prova).

| Nível | O que se constrói | Verificação comprada |
|---|---|---|
| direto | poucos arquivos conhecidos, comportamento que já existe, reversível com `git checkout` | hooks de edição, o teste alvo, review externo sobre o diff |
| tarefa | um módulo ou contrato novo, migration aditiva, mais de um arquivo de teste | testes do módulo, `npm run typecheck` inteiro antes do commit, review externo, matriz de entrega |
| onda | vários módulos, migration destrutiva, escopo aberto | plano datado, lentes, verificação independente, review massivo, triagem |

O dono corrige com uma palavra ("direto", "tarefa", "onda"). Ações irreversíveis não são
nível, são protocolo, e valem em qualquer nível (ver "O que não muda").

### Regra de negócio sem fonte se pergunta; decisão técnica se decide
Antes de perguntar, procure no código, no `README.md` e em `memoria/`. Se houver mais de uma
leitura, apresente as duas com a sua recomendação. Perguntas independentes vão juntas numa
rodada; pergunta cuja resposta muda a próxima vai sozinha. Se ninguém puder responder agora,
entregue tudo que não depende da resposta e termine com a pergunta.

### Completude
O pedido inteiro é a entrega. Nada de MVP silencioso. Pedido com mais de um item fecha com
**matriz de entrega**: por item, o resultado observável, a prova (comando e saída, ou
`arquivo:linha`) e o bloqueador nomeado, se houver. Item sem prova fica pendente, não vira
concluído. Reduzir escopo é decisão do dono, não sua.

### Prova
Antes de afirmar progresso, confira cada afirmação contra um resultado de ferramenta desta
sessão. O que não foi verificado se diz como não verificado. Todo número traz universo,
unidade, corte e a consulta que o produziu. "Commitado" não é "em produção". Teste verde de
um lado (`api/`) não prova o contrato com a outra ponta (`web/`): os tipos do front são
declarados à mão (`web/src/pages/PagamentosPage.tsx` redeclara `Pagamento`), não gerados do
Prisma, então uma mudança de campo na API passa no `typecheck` dos dois lados e quebra em
runtime.

### Continuidade
Antes de trocar de fase ou compactar contexto, registre o ponto de retomada: decisões do dono
com as palavras dele, provas obtidas, pendências, autorização vigente. Débito que você adiar
entra em `BACKLOG.md` na mesma sessão, nunca só no chat.

## Como trabalhar

- Transforme a tarefa em critério observável antes de começar: bug vira reprodução que falha
  e depois passa; validação nova vira entrada inválida rejeitada. A suíte de testes da
  aplicação é `node:test` + `tsx` (decisão do dono, 2026-09-23): `npm test` roda
  `api/test/*.test.ts` contra o banco isolado `gymdb_test` (criado/migrado por
  `api/scripts/ensure-test-db.mjs`; nunca `gymdb`). Prova de comportamento fora da suíte é
  comando reproduzível com saída colada (`curl` contra a API local, script `tsx`, consulta
  ao banco local).
- Toque só no que o pedido exige. Sem abstração para uso único, sem flexibilidade não pedida,
  sem tratamento para cenário que não acontece. Código morto alheio se menciona, não se apaga.
- Verificação mínima antes de dizer "pronto": `npm run typecheck` (api + web, ~5 s, linha de
  base 0 erros em 2026-09-20) e a segunda porta sobre o que mudou:
  `scripts/verificadores/rodar.sh --diff HEAD`.
- Todo diff, em qualquer nível, passa por review externo antes de fechar
  (`scripts/agentes/revisar_diff.sh`; contagem de lentes em `.claude/rules/review.md`).

## O que não muda

- **Decisão do dono exige OK humano explícito no turno, mesmo com autorização anterior**
  (decisão do dono, 2026-09-20: "todos"): alterar preço de `Plano` ou `valor` de `Matricula`
  fora do fluxo da API; mudar `Pagamento` para `ESTORNADO`/`CANCELADO` por script ou SQL;
  criar/promover `Usuario` ADMIN ou trocar `role` por script; `DELETE`/`TRUNCATE` em `Aluno`,
  `Matricula`, `Pagamento`, `CheckIn`. O guard `.claude/hooks/db-guard.mjs` bloqueia o que
  um regex alcança; o resto é disciplina sua.
- **Não existe produção** (decisão do dono, 2026-09-20). Qualquer `DATABASE_URL` cujo host não
  seja `localhost`/`127.0.0.1` é tratada como produção e bloqueada pelo guard. Quando produção
  nascer, o caminho de deploy será um script único e o guard passará a apontar para ele.
- **Banco local não é descartável sem OK**: `prisma migrate reset`, `prisma db push
  --accept-data-loss` e `docker compose down -v` apagam o volume `pgdata` (onde os ~400
  alunos vão morar após a migração de CSV). Bypass consciente: `PILOTO_DB_OVERRIDE=1` no
  próprio comando, que fica na trilha de aprovação.
- **Todo controller fora de `auth` tem `@Roles(...)` na classe** e o escopo de unidade é feito
  no service com `user.unidadeId ?? query.unidadeId` (leitura) e comparação explícita
  (escrita). Recurso de outra unidade responde `NotFoundException`, não 403
  (`api/src/modules/pagamentos/pagamentos.service.ts:42-48`), para não confirmar existência.
- **Variável de ambiente só entra pelo `validateEnv` + `ConfigService`**
  (`api/src/config/env.validation.ts`). `process.env` direto em `api/src/` é proibido.
- **Dinheiro é `Decimal` do Prisma na API.** `parseFloat`/`Number()` sobre `valor` em
  `api/src/` é proibido; no front, `Number(p.valor)` só para exibir.
- **Política de modelos**: o modelo forte julga, orquestra e revisa; modelo de execução
  mecânica só entra com contrato fechado; modelo fraco não entra em papel nenhum quando há
  dinheiro envolvido, inclusive dentro de skill de terceiro que sugira o contrário. Declare
  modelo e esforço ao lançar subagente ou revisor e reporte o que de fato rodou.
- **Checkout de uma sessão só** (decisão do dono, 2026-09-20). Se isso mudar: commit por lista
  positiva (`git commit -o <arquivos>`), isolamento por `git worktree`, nunca `git stash`.

## Convenções

- Commit: uma linha em português no imperativo dizendo o porquê, corpo opcional. Exemplo do
  repositório: `Estado inicial antes do harness`.
- API: um módulo por agregado (`api/src/modules/<nome>/{controller,service,module,dto/}`);
  `ParseUUIDPipe` em todo `:id`; `ValidationPipe` global com `whitelist` +
  `forbidNonWhitelisted`, então campo novo no DTO precisa de decorator ou a requisição inteira
  é rejeitada.
- Transição de estado com dinheiro é atômica no `WHERE` (`update({ where: { id, status:
  PENDENTE } })` + tratamento de `P2025`), não com `find` seguido de `update`
  (`pagamentos.service.ts:54-75`).
- Fuso: o negócio opera em `America/Sao_Paulo`; o processo Node roda no fuso da máquina
  (hoje Windows local; em servidor será UTC). `setMonth`/`getMonth`/`setHours(0,0,0,0)` em
  `matriculas.service.ts` e `PagamentosPage.tsx` dependem desse fuso. Não há fix ainda
  (`BACKLOG.md`); toda data nova que vira regra de negócio deve declarar o fuso.
- Front: `api` de `web/src/lib/api.ts` (refresh automático de token), TanStack Query com
  `queryKey` contendo todos os filtros, formulário como componente em `web/src/components/`.
- Windows: o checkout está em NTFS com `core.autocrlf` ligado (aviso "LF will be replaced by
  CRLF" no commit inicial). Não há Python na máquina; scripts do harness são Node ou bash
  (Git Bash).

## Leis transversais

- **`exit 0` mente.** Vale para CLI de agente, para hook, para estouro de contexto. Valide
  tamanho e conteúdo da saída, nunca o returncode.
- **Número que bate não é prova.** Dois números iguais podem vir do mesmo erro nas duas pontas.
  Prova é o caminho que produziu o número.
- **Relato de agente sobre banco ou ambiente não fecha sem conferência independente.**
- **Ausência de arquivo de estado não prova morte de processo.** Prova de vida é o `mtime` da
  saída ou a lista de processos pelo padrão real da linha de comando. Relançamento cego
  duplica trabalho; matar por padrão amplo mata o processo de outra sessão.
- **Um escritor por arquivo compartilhado** (`BACKLOG.md`, `memoria/MEMORY.md`).
- **Ler e transformar antes de escrever.** Abrir para escrita trunca antes de ler: leia para
  variável, transforme, e só então escreva. Scripts que estão em execução (driver bash) se
  editam por arquivo temporário + `mv`, nunca no mesmo inode.
- **Review que não rodou não vira review.** Envelope diferente de `ok` fecha a matriz com
  "sem review externo" e o motivo. Tentativa não conta.
