---
name: guard-comando-invisivel
description: db-guard por regex não vê conteúdo de arquivo — comandos como `psql -f x.sql` e `node script.js` viraram família própria (script-invisivel)
metadata:
  type: project
---

O guard `db-guard.mjs` julga a **linha de comando**; um arquivo executado (`psql -f`,
`prisma db execute --file/--stdin`, `node|tsx script.js` com nome de banco) esconde o
conteúdo do que será executado. O review externo (lens-harness-1, 2026-09-21) achou esse
falso negativo.

**Por quê:** o humano aprova o comando que vê; SQL dentro de arquivo é invisível para o
guard e para quem aprova.

**Como aplicar:** esses formatos caem na família `script-invisivel` e são negados com o
caminho "SQL inline ou migration versionada". Não relaxe o padrão para deixar `-f` passar —
a família inteira existe porque o conteúdo não é auditável. Exceção já embutida:
`tsx prisma/seed.ts` é o caminho sancionado (`npm run db:seed`).

Relacionado: [[devin-cli-print-mode]] (a execução que achou isto).
