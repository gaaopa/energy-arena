# Lista única de nomes de segredo, usada por TODAS as portas (rodar.sh e
# revisar_diff.sh). Duas listas divergentes é como a porta dos fundos nasce.
# Compare em minúsculas contra o caminho relativo e o basename.
#   FORTES: extensão/nome que só existe para guardar segredo -> recusado sempre,
#           versionado ou não.
#   FRACOS: nome que costuma ser código -> recusado só se não rastreado ou
#           ignorado pelo git (erro do check-ignore conta como ignorado).
SEGREDOS_FORTES=(
  .env .env.* .*.env *.pem *.key *.pfx *.p12 *.keystore *.ppk
  id_rsa id_dsa id_ecdsa id_ed25519 devin-tokens.sh
)
SEGREDOS_FRACOS=(
  *credentials* *secret* *token* *password* *.envrc *-tokens.*
)

# segredo_forte <path> -> 0 se bate na lista forte
segredo_forte() {
  local p="${1,,}"
  local b="${p##*/}"
  local g
  for g in "${SEGREDOS_FORTES[@]}"; do
    [[ "$b" == ${g,,} || "$p" == */${g,,} || "$p" == ${g,,} ]] && return 0
  done
  return 1
}

# segredo_fraco <path> -> 0 se bate na lista fraca
segredo_fraco() {
  local p="${1,,}"
  local b="${p##*/}"
  local g
  for g in "${SEGREDOS_FRACOS[@]}"; do
    [[ "$b" == ${g,,} || "$p" == */${g,,} ]] && return 0
  done
  return 1
}

# protegido <path> -> 0 se deve ficar fora de recorte/verificação
# (forte sempre; fraco só se não rastreado ou ignorado — erro do check-ignore = ignorado)
protegido() {
  local p="$1"
  segredo_forte "$p" && return 0
  segredo_fraco "$p" || return 1
  git ls-files --error-unmatch -- "$p" >/dev/null 2>&1 || return 0
  git check-ignore -q -- "$p" && return 0
  local rc=$?
  [ "$rc" -ne 0 ] && [ "$rc" -ne 1 ] && return 0   # erro no check-ignore = ignorado
  return 1
}
