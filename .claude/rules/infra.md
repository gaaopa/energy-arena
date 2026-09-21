---
paths:
  - "docker-compose.yml"
  - "api/prisma/**"
  - "api/.env*"
  - "**/package.json"
globs:
  - "docker-compose.yml"
  - "api/prisma/**"
  - "api/.env*"
  - "**/package.json"
trigger: glob
description: Banco local, migrations, env e scripts npm deste projeto
---

# Molde de infra local

- Postgres 16 via `docker-compose.yml` (container `gym-postgres`, volume `pgdata`, porta
  5432, senha dev `gym/gym`). `npm run db:up` / `db:down` / `db:migrate` / `db:seed`.
  **Docker não está no PATH do Git Bash desta máquina** — rode os comandos `docker compose`
  no PowerShell/cmd do Windows ou confirme `docker --version` antes.
- Migration: sempre `prisma migrate dev` (gera SQL versionado em `api/prisma/migrations/`).
  `db push` sem migration é só para rascunho local e mesmo assim pede flag explícita.
  `migrate reset`, `db push --accept-data-loss` e `compose down -v` são guardados pelo
  `db-guard.mjs` (bypass `PILOTO_DB_OVERRIDE=1`).
- `.env` real fica em `api/.env` (gitignored) e espelha `api/.env.example` sem valores reais.
  Toda variável nova entra no `envSchema` de `api/src/config/env.validation.ts` ou o boot
  falha — com mensagem clara, por isso o schema é o ponto único.
- Dependências: workspaces npm na raiz (`npm install` na raiz, `--workspace` para um pacote).
  Versão nova precisa ter ≥7 dias de publicada; `allowScripts` na raiz controla postinstalls.
- Seed é idempotente por `upsert` com IDs fixos em UUID válido (`prisma/seed.ts`), porque
  `ParseUUIDPipe` valida os IDs nos controllers.
