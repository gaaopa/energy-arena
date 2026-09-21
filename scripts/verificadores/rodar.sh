#!/usr/bin/env bash
# Segunda porta: roda os MESMOS verificadores dos hooks, com o mesmo veredito,
# sobre uma seleção — para código escrito por agente que não passa por hook.
#
#   scripts/verificadores/rodar.sh --diff main...HEAD
#   scripts/verificadores/rodar.sh caminho/a.ts caminho/b.tsx
#
# Códigos de saída:
#   0 limpo (e ao menos um verificador rodou)
#   1 achado novo
#   2 ferramenta ausente ou seleção vazia
# O rc 2 vence o rc 1: "não consegui verificar" é notícia mais grave que "achei".
# Nunca verde por omissão.
#
# ESTE ARQUIVO ESTÁ VIVO quando alguém o executa: edite via arquivo temporário + mv,
# nunca no mesmo inode (ver .claude/rules/armadilhas-harness.md).
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 2
. "$(dirname "$0")/../segredos.sh"

HOOKS=.claude/hooks
ARQUIVOS=()

if [ "${1:-}" = "--diff" ]; then
  BASE="${2:?uso: rodar.sh --diff <ref> [ref] | rodar.sh <arquivo>...}"
  if [ $# -ge 3 ]; then REF="$3"; else REF="HEAD"; fi
  while IFS= read -r f; do ARQUIVOS+=("$f"); done < <(git diff --name-only --diff-filter=ACMR "$BASE" "$REF" --)
  if [ "$REF" = "HEAD" ] && [ $# -eq 2 ]; then
    # Diff contra o worktree: código de outro agente chega como untracked.
    while IFS= read -r f; do ARQUIVOS+=("$f"); done < <(git ls-files --others --exclude-standard --)
  fi
else
  ARQUIVOS=("$@")
fi

if [ "${#ARQUIVOS[@]}" -eq 0 ]; then
  echo "rodar.sh: seleção vazia — nada a verificar (rc 2, nunca verde por omissão)" >&2
  exit 2
fi

rodou=0
achou=0
semverificar=0

despacha() {
  local f="$1"
  [ -f "$f" ] || { echo "-- $f: não existe no worktree"; return; }
  if protegido "$f"; then
    echo "-- $f: nome de segredo, não se verifica por aqui (lista única em scripts/segredos.sh)" >&2
    return
  fi
  case "$f" in
    api/src/*|web/src/*|web/vite.config.ts|api/prisma/seed.ts)
      case "$f" in *.ts|*.tsx) ;; *) return ;; esac
      rodou=1
      node "$HOOKS/typecheck.mjs" --arquivo "$f"
      case $? in 1) achou=1;; 2) semverificar=1;; esac
      node "$HOOKS/lint-bug.mjs" --arquivo "$f"
      case $? in 1) achou=1;; 2) semverificar=1;; esac
      node "$HOOKS/padroes-proibidos.mjs" --arquivo "$f"
      case $? in 1) achou=1;; 2) semverificar=1;; esac
      ;;
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
      # fora de api/web (ex.: scripts, .claude/hooks): lint-bug + padroes
      rodou=1
      node "$HOOKS/lint-bug.mjs" --arquivo "$f"
      case $? in 1) achou=1;; 2) semverificar=1;; esac
      node "$HOOKS/padroes-proibidos.mjs" --arquivo "$f"
      case $? in 1) achou=1;; 2) semverificar=1;; esac
      ;;
    *)
      ;;
  esac
}

for f in "${ARQUIVOS[@]}"; do despacha "$f"; done

if [ "$rodou" -eq 0 ]; then
  echo "rodar.sh: nenhum verificador aplicável à seleção (rc 2, nunca verde por omissão)" >&2
  exit 2
fi
if [ "$semverificar" -eq 1 ]; then
  echo "rodar.sh: ao menos um verificador não rodou (ferramenta ausente/fora de escopo)" >&2
  exit 2
fi
[ "$achou" -eq 1 ] && exit 1
exit 0
