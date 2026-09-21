---
paths:
  - ".claude/**"
  - ".devin/**"
  - "scripts/**"
globs:
  - ".claude/**"
  - ".devin/**"
  - "scripts/**"
trigger: glob
description: Armadilhas do próprio harness — hooks, settings, drivers
---

# Armadilhas do harness

- A máquina não tem Python (alias do Windows Store devolve "Python não foi encontrado" e
  `py` não existe): hook em `.py` falha aberto de propósito e ninguém percebe. Todos os
  hooks são `node` + `.mjs`; ao adicionar um, copie o padrão `executar(main)` de `_lib.mjs`.
- `tool_name` muda por CLI: Claude Code manda `Edit`/`Write`/`Bash`; Devin CLI manda
  `edit`/`write`/`exec`. Os matchers em `settings.json` cobrem os dois; regex nova de
  ferramenta precisa do par `(Nome|nome)`.
- `additionalContext` no Stop reabre o turno e vira laço: `entrega.mjs` usa só
  `systemMessage` no Stop e injeta o lembrete no `UserPromptSubmit` seguinte via marcador em
  `.claude/hooks/.state/`.
- Estado por sessão vive em `.claude/hooks/.state/` (gitignored), chaveado por `session_id`
  com `prompt_id` implícito via reset no UserPromptSubmit. Não use arquivo único global: duas
  sessões sobrescreveriam o turno uma da outra.
- Driver bash lê o próprio arquivo aos pedaços enquanto executa: `revisar_diff.sh` e
  `rodar.sh` se editam por arquivo temporário + `mv`, nunca no mesmo inode.
- Ferramenta ausente dentro de um hook sai 0 por design (lei 1), então um hook quebrado fica
  invisível na sessão: quem prova que ele funciona é `node --test .claude/hooks/test_hooks.mjs`,
  que confere o diagnóstico e pula em voz alta quando a ferramenta falta.
- Linha de base do typecheck (`typecheck-baseline.*.json`) só encolhe: se `tsc` falhar de
  verdade (timeout, config quebrada), o hook devolve "não consegui verificar" e o arquivo
  base não se atualiza — nunca grave baseline vazia por cima de erro de execução.
- `git show HEAD:<arquivo>` em path de worktree/nested repo resolve pela raiz daquele repo:
  os testes criam `git init` dentro de `.state/` de propósito para exercitar isso.
