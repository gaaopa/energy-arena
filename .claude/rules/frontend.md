---
paths:
  - "web/**/*.tsx"
  - "web/**/*.ts"
globs:
  - "web/**/*.tsx"
  - "web/**/*.ts"
trigger: glob
description: Molde do frontend React + TanStack Query deste projeto
---

# Molde do frontend (web/)

## Tipos e fetch

- Os tipos da API são **redeclarados à mão** em cada página (`PagamentosPage.tsx` declara
  `interface Pagamento`): mudança de contrato na API precisa ser portada manualmente. Ao
  tocar um DTO/serialização no `api/`, procure quem consome no `web/` na mesma tarefa.
- `valor` vem do Prisma `Decimal` e **serializa como string**: declare
  `valor: number | string` e converta com `Number(p.valor)` só na exibição
  (`PagamentosPage.tsx:20`).
- Todo fetch passa pelo `api` de `web/src/lib/api.ts` (Bearer + refresh automático);
  axios novo ou `fetch()` direto é fora do molde.
- `useQuery` com `queryKey` contendo **todos** os filtros (`['pagamentos', status,
  unidadeId]`); `useMutation` + `invalidateQueries` no `onSuccess`
  (`PagamentoBaixaModal.tsx:40-48`); erro de API exibe `err.response.data.message`
  (pode ser array — class-validator devolve lista).

## Constrangimentos do tsconfig do web (todos quebram o build)

- `verbatimModuleSyntax`: import de tipo exige `import type`.
- `noUnusedLocals`/`noUnusedParameters`: import ou parâmetro não usado falha `tsc -b`.
- `erasableSyntaxOnly`: **sem `enum`, `namespace` ou parâmetro-propriedade**; união de
  strings no lugar (`type MetodoPagamento = 'PIX' | ...`).
- Sem `paths` configurado: importe com caminho relativo (`../lib/api`).

## Apresentação

- Moeda com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`;
  data com `toLocaleDateString('pt-BR')`.
- Status com mapa label + mapa de badge (`STATUS_LABELS`/`STATUS_BADGE` em
  `PagamentosPage.tsx`).
- Tailwind utilitário nos componentes; tela cheia = `rounded-xl bg-white shadow-sm`.
- O Vite faz proxy de `/api` → `localhost:3000`; não invente `VITE_API_URL`.
