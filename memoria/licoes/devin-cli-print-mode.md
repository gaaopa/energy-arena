---
name: devin-cli-print-mode
description: `devin -p` com `--config <arquivo>` cai no wizard interativo se o config não tiver `shell.setup_complete: true`; e prompt grande vai por caminho de arquivo, não argv
metadata:
  type: project
---

`--config <PATH>` substitui o config do usuário **inteiro**. Um config sem
`"shell": {"setup_complete": true}` faz o CLI achar que é primeiro uso e abrir o wizard
"Connect GitHub" — em modo print isso trava em silêncio (rc 0, saída de tela ANSI, sem
review). Medido duas vezes em 2026-09-21 nesta máquina.

**Por quê:** o wizard é disparado pelo config ausente, não por flag; `-p` e `--prompt-file`
não o desarmam.

**Como aplicar:** todo config de revisor/driver headless começa com
`"shell": {"setup_complete": true}` (ver `scripts/agentes/revisor.config.json`). E o prompt
vai inline curto com o diff **por caminho** (`-- "..."` + o arquivo de diff no workspace),
porque argv do Windows tem teto ~32KB e `--prompt-file` sem prompt posicional também cai no
interativo.
