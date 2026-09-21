---
paths:
  - "api/**/*.ts"
  - "api/prisma/**"
globs:
  - "api/**/*.ts"
  - "api/prisma/**"
trigger: glob
description: Armadilhas confirmadas do backend — uma linha por incidente
---

# Armadilhas do backend

- `dataFim` se calcula com `setMonth` no fuso do processo. O negócio opera em
  `America/Sao_Paulo` e a máquina pode rodar em UTC; data de fim de matrícula calculada em
  UTC fecha o mês um dia errado no fim do mês. Até existir fix central (backlog), data que
  vira regra de negócio deve declarar o fuso explicitamente.
- Cancelar matrícula deixa cobranças pendentes "fantasma" se o cancelamento das cobranças
  não for na mesma transação do update da matrícula. `matriculas.service.ts:125-146` faz os
  dois num `$transaction` só — replique esse padrão.
- Duas requisições `PATCH /pagamentos/:id/pagar` simultâneas com `find`+`update` baixariam
  duas vezes com métodos diferentes; a condição `status: PENDENTE` dentro do `update` + catch
  `P2025` é o que torna a baixa atômica. Nunca transição de status com `find` antes.
- `checkIn.findFirst` com janela de 5 min (`CHECKIN_DEDUPE_MS`) é deduplicação de duplo
  clique/reescaneio de QR, não bug: remover devolve check-in duplicado na recepção.
- O bcrypt dummy em `auth.service.ts` (`DUMMY_SENHA_HASH`) existe para igualar o tempo de
  resposta quando o usuário não existe; tirar ele reabre enumeração de e-mail por timing.
- O cookie do refresh é `path=/api/auth`: `clearCookie` ou `setCookie` em outro path deixa
  token velho preso no browser. Ao tocar cookies em `auth.controller.ts`, copie o `path`
  exato.
- `@Transform` de DTO não roda em chamada interna: o service renormaliza (`email.trim()` no
  login) porque confiar no decorator espalha e-mail com maiúscula/espaço no `findUnique` e
  quebra login.
- `usuario.findUnique({ where: { email } })` depende de e-mail único normalizado; cadastro
  com `ADMIN`/`RECEPCAO` também passa pelo service (`usuarios`), que é o único lugar que
  troca `role` — script direto no banco é decisão do dono, guardada pelo `db-guard`.
- Erro de env no boot vem do zod (`env.validation.ts`), não de runtime mais tarde: variável
  nova sem schema falha `npm run dev:api` com mensagem genérica, então declare lá primeiro.
