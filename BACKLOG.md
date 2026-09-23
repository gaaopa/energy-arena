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
- 2026-09-22 — **`checkins.relatorio()` agrega todo o histórico em memória**: `findMany` sem
  `take` e sem filtro de período (checkins.service.ts). Degrada conforme check-ins crescem;
  para ~400 alunos reais já pesa. Destrava com: período obrigatório no endpoint ou
  agregação em SQL (`groupBy`).
- 2026-09-22 — **Troca de plano não faz prorrata nem cobra diferença** (matriculas.
  trocarPlano): cancela cobranças pendentes da matrícula antiga e cobra só o ciclo novo.
  Aluno em atraso que troca de plano tem a pendência perdoada; aluno que pagou período
  não utilizado não recebe crédito. Semântica documentada na UI ("cobranças pendentes são
  canceladas"), mas é decisão de produto pendente. Destrava com: regra do dono sobre
  proporcional/crédito/dívida na troca.
- 2026-09-22 — **Primeira cobrança recorrente nunca bloqueia check-in**: `proximaRenovacao`
  nasce `dataInicio + período`, então quem nunca pagou a 1ª mensalidade entra até a
  renovação passar (achado tp-recorrencia; vale para create() e trocarPlano — modelo
  uniforme). Destrava com: regra do dono — bloquear desde a 1ª cobrança vencida mudaria
  a semântica de `proximaRenovacao`.
- 2026-09-22 — **Check-in FACIAL aparece como "QR Code" na ficha do aluno**
  (`AlunoDetailPage.tsx`): tipo local `metodo: 'MANUAL' | 'QR_CODE'` omite `FACIAL`
  (enum novo do módulo catracas) e o render usa ternário `MANUAL ? Manual : QR Code`.
  Achado do review `coluna-celular` — rótulo errado, não quebra. Destrava com: incluir
  `FACIAL` no tipo e trocar ternário por mapa de labels.
- 2026-09-22 — **Falha no upload de foto reporta erro errado** (`AlunoForm.tsx`): o
  PATCH/POST do aluno corre antes do POST `/foto` no mesmo `mutationFn`; se o upload
  falha, a tela diz "Erro ao salvar aluno" com o aluno já salvo e `['alunos']` não é
  invalidada (lista velha; reenvio cai no conflito de CPF). `fotoPreview` também vaza
  objectURL ao fechar sem sucesso. Destrava com: separar erro de upload do erro de
  salvar (ou invalidar no `onSettled`).
- 2026-09-22 — **Re-seed dessincroniza entrada/saída de check-in** (`api/prisma/seed.ts`):
  `update: { saiuEm }` recalcula a saída sobre `diasAtras(dia)` de hoje mas preserva o
  `criadoEm` do seed original — histórico com entrada velha e saída nova. Cosmético
  (só seed). Destrava com: incluir `criadoEm` no update ou `update: {}`.
- 2026-09-22 — **Backfill de consentimento não dispara sync de catraca**: a migration
  `20260922113000_consentimento_matriculados` marcou alunos já matriculados, mas quem
  só ganhou consentimento ali só chega ao terminal num gatilho futuro (edição do aluno,
  foto, nova matrícula). Mitigação manual: `POST /catracas/:id/sincronizar` uma vez por
  dispositivo (ou botão de sync na aba Catracas). Achado do review `consentimento-auto`.
- 2026-09-22 — **Cancelar matrícula não revoga consentimento nem remove do terminal**:
  `matriculas.cancelar` não toca em `consentimentoBiometriaEm` e `podeUsar`
  (`catracas.service.ts`) olha só `status do aluno + consentimento`, não a matrícula —
  aluno ATIVO sem matrícula segue com template facial no dispositivo. Decisão de
  produto/LGPD do dono: consentimento acompanha matrícula ou cadastro?
- 2026-09-22 — **Sem caminho de revogação de consentimento** (LGPD art. 8º §5º): o
  checkbox saiu do form e o DTO não aceita mais o campo — hoje só SQL direto revoga.
  Se o dono quiser trilha de revogação, precisa de endpoint/ação própria.
- 2026-09-22 — **`metodo: FACIAL` aceito via `POST /checkins` comum**
  (`checkin.dto.ts`): staff pode gravar check-in "facial" sem catraca nem consentimento
  — contamina auditoria de método. Destrava com: restringir FACIAL ao fluxo de webhook
  das catracas.
