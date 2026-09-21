@AGENTS.md

## Exclusivo do Claude Code

- Rules por caminho vivem em `.claude/rules/*.md` (conteúdo canônico); as com frontmatter
  `paths:` entram quando um arquivo daquele glob é lido ou editado. O Devin CLI não importa
  `.claude/rules/`, então `.devin/rules/*.md` carrega apontadores com `trigger: glob` +
  `globs:` que mandam ler o arquivo canônico — medido: ativam na primeira escrita no
  domínio, não na leitura. Não duplique conteúdo entre os dois lados.
- Hooks em `.claude/settings.json` são Node (`node .claude/hooks/*.mjs`), porque a máquina
  não tem Python. Bancada: `node --test .claude/hooks/test_hooks.mjs`.
- O matcher dos hooks cobre os dois nomes de ferramenta (`Bash|exec`,
  `Edit|Write|MultiEdit|edit|write`) porque o mesmo arquivo é lido pelo Claude Code e pelo
  Devin CLI.
