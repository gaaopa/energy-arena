# Memória (índice)

Uma linha por lição, com link e gancho. Conteúdo mora nos arquivos; aqui só aponta.

- [guard-comando-invisivel](licoes/guard-comando-invisivel.md) — regex de comando não vê dentro de arquivo: `psql -f`, `node script.js` viraram família própria no db-guard.
- [devin-cli-print-mode](licoes/devin-cli-print-mode.md) — `devin -p` + `--config` sem `shell.setup_complete` cai em wizard interativo e trava o driver em silêncio.
- [politica-de-modelos](licoes/politica-de-modelos.md) — o dono decidiu: swe-2-medium (mecânico) só com contrato fechado; dinheiro só passa por modelo forte.
- [prova-antes-de-claim](licoes/prova-antes-de-claim.md) — "o agente esquece, o arquivo não": preferência do dono por prova observável em vez de relato.
- [processos-filhos-de-sessao](licoes/processos-filhos-de-sessao.md) — `nohup`/`&` não desgruda filho de sessão no Windows: API caiu junto e login virou 502. Serviço durável nasce via Agendador (`scripts/servicos.ps1`).
- [orca-reabrir-sessoes](licoes/orca-reabrir-sessoes.md) — pane do Orca volta como cmd pelado após restart; reabrir = apagar `session_locks/<slug>.lock` morto + `orca terminal send` com `devin -r <slug>`.
- 2026-09-22 — **Plano recorrente**: `Matricula.dataFim` é nullable; recorrência vive em `Plano.recorrente` + `Matricula.proximaRenovacao` (= vencimento da cobrança mais recente, = próxima renovação). Baixa em `pagamentos.marcarPago` gera o ciclo seguinte dentro da mesma tx com lock advisory por matriculaId (pareado com `matriculas.cancelar`). Unicidade de ciclo: `@@unique([matriculaId, vencimento])`. Check-in bloqueia quando `proximaRenovacao < agora` (inadimplente). Toggle `recorrente` é barrado com matrícula ativa em `planos.update`.
