---
paths:
  - "api/**/*.ts"
  - "api/**/*.prisma"
globs:
  - "api/**/*.ts"
  - "api/**/*.prisma"
trigger: glob
description: Molde do backend NestJS + Prisma deste projeto
---

# Molde do backend (api/)

Um módulo por agregado: `api/src/modules/<nome>/{controller,service,module,dto/}`.
Código fora deste molde reprova em review.

## Controller — copiável de `alunos.controller.ts`

- `@Controller('<nome>')` + **`@Roles(Role...)` na classe** (obrigatório fora de `auth/`;
  o hook `padroes-proibidos` bloqueia controller sem `@Roles` nem `@Public`). Rotas mais
  restritas estreitam com `@Roles` no método.
- `ParseUUIDPipe` em todo `@Param('id')` — o schema usa UUID e o seed gera UUIDs válidos
  justamente para passar por ele.
- `@CurrentUser() user: AuthUser` em todo handler que lê ou escreve dado com dono.

## Service — escopo de unidade, copiável de `pagamentos.service.ts` e `matriculas.service.ts`

- **Leitura**: `const unidadeId = user.unidadeId ?? query.unidadeId;` e `unidadeId` entra no
  `where`. ADMIN tem `unidadeId` nulo → vê tudo; RECEPCAO/INSTRUTOR ficam presos à unidade.
- **Escrita**: checar `user.unidadeId && entidade.unidadeId !== user.unidadeId`. Recurso de
  outra unidade (ou inexistente) responde **`NotFoundException`, nunca `Forbidden`** — 403
  confirma que o recurso existe (`pagamentos.service.ts:42-48`).
- **Transição de estado com dinheiro é atômica no WHERE**, não `find` + `update`:

```ts
return await this.prisma.pagamento.update({
  where: { id, status: StatusPagamento.PENDENTE },
  data: { status: StatusPagamento.PAGO, ... },
});
// catch P2025 -> BadRequestException('Somente pagamentos pendentes podem ser baixados')
```

- **Multi-escrita do mesmo agregado**: `prisma.$transaction` + advisory lock por aluno quando
  a invariante é "no máximo uma X ativa" (`matriculas.service.ts:75-85`,
  `pg_advisory_xact_lock(hashtext(alunoId))`).
- Erro esperado vira `BadRequestException`/`NotFoundException`; erro de Prisma que ainda é
  race vira o `catch` do `P2025` acima. `console.log` não existe em `api/src`.

## DTO — copiável de `aluno.dto.ts`/`pagamento.dto.ts`

- Classe (não interface) com `class-validator`: `@IsString`, `@IsUUID`, `@IsOptional`,
  `@IsEnum`, `@IsDateString`, `@Matches`. Campos `!:` (definite assignment, strict mode).
- `ValidationPipe` global tem `whitelist` + `forbidNonWhitelisted`: **campo sem decorator
  rejeita a requisição inteira com 400**, não é ignorado.
- Normalização que o service não deve depender: `@Transform` no DTO; o service renormaliza o
  essencial (`email.trim().toLowerCase()` em `auth.service.ts:35`).

## Config e dinheiro

- `process.env` só existe em `api/src/config/env.validation.ts` (zod, falha no boot); em todo
  o resto é `ConfigService.getOrThrow`.
- `valor` é `Prisma.Decimal`, nunca `Number`/`parseFloat` (o hook bloqueia).
- JWT/refresh: `AuthUser` sai do token; nunca confie em `role`/`unidadeId` que venham do
  cliente.

## Queries Prisma

- `include`/`select` explícito com os campos necessários (`{ select: { id, nome } }`) — não
  devolva `senhaHash`, `tokenHash` nem dado de outra unidade por acidente.
- Lista sempre tem `orderBy` e, se puder crescer, `take` (check-ins usam `take: 200`).
