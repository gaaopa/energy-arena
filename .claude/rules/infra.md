---
paths:
  - "docker-compose.yml"
  - "api/prisma/**"
  - "api/.env*"
  - "**/package.json"
  - "scripts/servicos.ps1"
globs:
  - "docker-compose.yml"
  - "api/prisma/**"
  - "api/.env*"
  - "**/package.json"
  - "scripts/servicos.ps1"
trigger: glob
description: Banco local, migrations, env e scripts npm deste projeto
---

# Molde de infra local

- Postgres 16 real nesta máquina é o **serviço nativo `postgresql-x64-16`** (:5432,
  `gym`/`gymdb` — conferido 2026-09-21 via `prisma migrate status`). `docker-compose.yml`
  (container `gym-postgres`, volume `pgdata`) é a especificação para quando Docker existir —
  `docker` não está no PATH em shell nenhum e `npm run db:up` falha. `db:migrate`/`db:seed`
  funcionam contra o serviço nativo.
- Migration: sempre `prisma migrate dev` (gera SQL versionado em `api/prisma/migrations/`).
  `db push` sem migration é só para rascunho local e mesmo assim pede flag explícita.
  `migrate reset`, `db push --accept-data-loss` e `compose down -v` são guardados pelo
  `db-guard.mjs` (bypass `PILOTO_DB_OVERRIDE=1`).
- `.env` real fica em `api/.env` (gitignored) e espelha `api/.env.example` sem valores reais.
  Toda variável nova entra no `envSchema` de `api/src/config/env.validation.ts` ou o boot
  falha — com mensagem clara, por isso o schema é o ponto único.
- **Dev servers como filhos de sessão morrem com ela** (incidente 2026-09-21: API caiu,
  login 502). Forma durável: `scripts/servicos.ps1` (`subir|parar|status|instalar`) sobe
  API e web destacados; a tarefa `EnergyArena-DevServers` (Agendador, AtLogOn) garante
  renascimento no boot. Postgres já é serviço do Windows (`postgresql-x64-16`), não precisa.
- Dependências: workspaces npm na raiz (`npm install` na raiz, `--workspace` para um pacote).
  Versão nova precisa ter ≥7 dias de publicada; `allowScripts` na raiz controla postinstalls.
- Seed é idempotente por `upsert` com IDs fixos em UUID válido (`prisma/seed.ts`), porque
  `ParseUUIDPipe` valida os IDs nos controllers.
