# Energy Arena — Sistema de Gestão

Sistema de gestão para academia multi-unidade (2 unidades, ~400 alunos).

## Stack

- **api/** — NestJS 12 + Prisma 6 + PostgreSQL 16 (JWT access + refresh token rotativo, RBAC, helmet, throttler, validação de env com zod)
- **web/** — React 19 + Vite 8 + Tailwind 4 + react-router 7 + TanStack Query
- **docker-compose.yml** — PostgreSQL local

## Pré-requisitos

- Node.js >= 20
- Docker (para o PostgreSQL local) ou um Postgres acessível

## Setup

```bash
npm install                 # instala todos os workspaces
cp api/.env.example api/.env  # ajuste os segredos JWT (no cmd.exe do Windows: `copy api\.env.example api\.env`)
npm run db:up               # sobe o postgres
npm run db:migrate          # cria as tabelas
npm run db:seed             # dados iniciais (unidades, admin, planos)
```

Admin seed: `admin@academia.com` / `Admin@12345` (defina `SEED_ADMIN_SENHA` no .env para outra senha).

## Rodando

```bash
npm run dev:api   # API em http://localhost:3000 (docs: /docs)
npm run dev:web   # Web em http://localhost:5173
```

O Vite faz proxy de `/api` → `localhost:3000`, então cookies e CORS funcionam sem configuração extra em dev.

## Verificação

```bash
npm run build       # build api + web
npm run typecheck   # tsc nos dois projetos
```

## Papéis (RBAC)

| Role | Escopo |
|------|--------|
| ADMIN | tudo, todas as unidades |
| RECEPCAO | alunos/matrículas/pagamentos/check-ins da sua unidade |
| INSTRUTOR | check-ins + leitura operacional (alunos/unidades/planos) |
| ALUNO | reservado para área do aluno (futuro) — sem acesso à API de gestão |

`unidadeId` nulo no usuário = acesso a todas as unidades.

## Decisões de segurança

- Access token JWT (15 min) no `Authorization: Bearer`; refresh token opaco (64 bytes) em cookie `httpOnly` com rotação — hash SHA-256 no banco
- Senhas com bcrypt (12 rounds); segredo JWT (`JWT_ACCESS_SECRET`) exige mínimo 32 chars (validado no boot)
- Rate limit global (120 req/min) + limites menores em `/auth/login` e `/auth/refresh`
- `ValidationPipe` com `whitelist` + `forbidNonWhitelisted` em todas as rotas

## Próximos passos

- Integração de cobrança recorrente (Asaas: Pix/boleto/cartão)
- Check-in por QR code (app do aluno)
- Agendamento de aulas coletivas
- Migração dos ~400 clientes (import CSV → endpoint ou script)
- Testes (vitest/jest) e CI
