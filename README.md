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
npm run db:up               # sobe o postgres via Docker; nesta máquina o Postgres já é o
                            # serviço nativo postgresql-x64-16 — pule este passo se Running
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

Para os servidores sobreviverem a sessão de agente/terminal que cai (processo filho
morre junto), eles nascem do Agendador de Tarefas:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\servicos.ps1 instalar   # registra a tarefa (logon + auto-cura a cada 5 min)
powershell -ExecutionPolicy Bypass -File scripts\servicos.ps1 subir      # dispara a tarefa agora (sem tarefa,
                                                                       # sobe filho da sessão — morre com ela)
powershell -ExecutionPolicy Bypass -File scripts\servicos.ps1 status     # portas, PIDs e processo-pai
powershell -ExecutionPolicy Bypass -File scripts\servicos.ps1 parar      # para os dois
```

A API sobe de `api/dist/main.js` — rode `npm run build` antes (e após mudar código).
A web sobe com `--host` (LAN). Logs em `logs/` (gitignored).

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
- CI para a suíte existente (`npm test`: node:test + tsx, `api/test/` contra `gymdb_test`)
