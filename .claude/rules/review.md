# Review externo por lente (vale em toda sessão)

Todo diff é lido por um segundo modelo antes de a tarefa fechar:
`scripts/agentes/revisar_diff.sh --arquivos "<lista literal>" --id <id> --foco "<pergunta>"`.
Uma execução por lente, todas em paralelo, cada uma com `--id` e `--foco` próprios. Lente é
uma pergunta distinta, nunca a mesma pergunta N vezes.

A contagem sai do **risco do diff, não do tamanho**. Diff misto vale pela faixa mais alta:

| Risco | Neste projeto | Lentes |
|---|---|---|
| máxima | `pagamentos`, `matriculas` (valor, dataFim, cancelamento), `planos.valor`, migration destrutiva, import dos ~400 alunos | 10 a 20; o diff **corrigido** volta para rodada nova |
| alta | `auth`, guards, `usuarios` (role), `alunos` (CPF, nascimento), endpoint novo, `.claude/hooks`, `scripts/agentes` | 5 a 10 |
| média | `checkins`, `unidades`, migration aditiva, componente de listagem | 3 a 5 |
| baixa | texto, `README.md`, `memoria/`, config sem efeito em runtime | 1 a 2 |

Lentes disponíveis (escolha as que a pergunta do diff pede): correção do dinheiro; escopo de
unidade e controle de acesso; concorrência e idempotência; contrato `api`↔`web` (tipos do
front são redeclarados à mão); migration e dado existente; teste e prova; padrão da casa
(rules de `backend.md`/`frontend.md`); documento e contrato (`AGENTS.md`, rules, memória).

Regras que custaram caro:
- Recorte é **lista positiva de arquivos literais**, montada pelos identificadores novos que
  você criou, não pelo vocabulário do assunto.
- O veredito se lê no **envelope** (`scripts/agentes/saida/<id>/envelope.json`), nunca no
  returncode. Só `"status": "ok"` conta na matriz; qualquer outro fecha como "sem review
  externo" e o motivo.
- Depois do commit, `--arquivos` devolve diff vazio e o driver sai `sem-diff`; para revisar
  trabalho commitado use `--base <sha>^`.
- Lance com o mecanismo de background do harness (nunca `&` dentro do Bash) e confira o
  envelope antes de contar a lente. Enquanto as lentes rodam, continue trabalhando.
- O revisor revisa, você decide: achado só entra com prova; refutar com prova é resultado
  legítimo.
