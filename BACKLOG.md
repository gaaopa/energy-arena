# Backlog (débitos adiados com data)

Um escritor por vez neste arquivo (lei transversal). Cada entrada: data, o que falta, por
que foi adiado, e o que a destrava.

- 2026-09-20 — **Fuso horário do negócio (America/Sao_Paulo) não é declarado no código.**
  `matriculas.service.ts` (`dataFim` via `setMonth`), `PagamentosPage.tsx` (resumo "pago no
  mês" com `getMonth`) e `checkins` dependem do fuso do processo, que em servidor será UTC.
  Adiado: exige decisão de implementação (lib de fuso vs. normalização manual) e nenhum
  incidente ainda. Destrava com: escolha do dono sobre a abordagem.
- 2026-09-20 — **Sem suíte de testes da aplicação** (README lista "Testes (vitest/jest) e
  CI" como próximo passo). Até lá, prova de comportamento é comando reproduzível. Destrava
  com: escolha do runner pelo dono.
- 2026-09-20 — **Sem linter de estilo/CI**: oxlint cobre só classe-bug via hook/rodar.sh;
  formatação e estilo não têm ferramenta. Decisão pendente do dono.
- 2026-09-20 — **Produção não existe** (decisão do dono): o guard `db-guard.mjs` trata
  qualquer `DATABASE_URL` não-localhost como produção. Quando o deploy nascer, criar o
  script canônico e atualizar a mensagem do guard para apontar para ele.
- 2026-09-20 — **`api/.env` real não pode entrar em review externo**: o filtro de segredos
  recusa. Se um diff precisar de contexto de env, o revisor lê `api/.env.example` (sem
  valores) — registre no prompt da lente.
