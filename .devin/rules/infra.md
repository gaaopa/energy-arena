---
description: Banco local, migrations, env e scripts npm
trigger: glob
globs:
  - "docker-compose.yml"
  - "api/prisma/**"
  - "api/.env*"
  - "**/package.json"
---
Antes de editar arquivos de infra (docker-compose, prisma, .env, package.json), leia .claude/rules/infra.md.
