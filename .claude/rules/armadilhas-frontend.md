---
paths:
  - "web/**/*.tsx"
  - "web/**/*.ts"
globs:
  - "web/**/*.tsx"
  - "web/**/*.ts"
trigger: glob
description: Armadilhas confirmadas do frontend — uma linha por incidente
---

# Armadilhas do frontend

- `useQuery` sem filtro na `queryKey` serve lista velha: trocar filtro sem mudar a key devolve
  o cache da consulta anterior. Toda página lista tem `queryKey: ['<nome>', ...filtros]`.
- 401 em `/auth/login`, `/auth/refresh` e `/auth/logout` **não** é token expirado: o
  interceptor de `lib/api.ts` tem `NO_REFRESH_URLS` porque retentar refresh nesses casos
  vira loop de re-login. Endpoint de auth novo entra nessa lista, não no fluxo de retry.
- `err.response.data.message` do NestJS pode ser `string[]` (class-validator agrega erros):
  renderizar o objeto cru quebra a tela; junte com `msg.join(', ')` como em
  `PagamentoBaixaModal.tsx`.
- `Number(p.valor)` fora da exibição esconde a string Decimal: usar `+p.valor` ou comparar
  `valor` cru como número compila e falha em runtime quando a API manda `"149.90"`.
- `tsc -b` do web falha por `noUnusedLocals`/`verbatimModuleSyntax` **depois** de `vite dev`
  parecer ok: o Vite transpila sem checar tipos. `npm run typecheck` é a prova, não a tela.
- `verbatimModuleSyntax` + `erasableSyntaxOnly` impedem `enum` e `namespace`: enum do Prisma
  se redeclara como união de strings (`type StatusPagamento = 'PENDENTE' | ...`), como em
  `PagamentosPage.tsx` — e precisa ser atualizado quando o enum do `schema.prisma` mudar.
- `window.location.href = '/login'` no interceptor é o único redirect "hard" da app;
  navegação interna usa `<Link>`/`useNavigate`, senão o access token em memória se perde.
