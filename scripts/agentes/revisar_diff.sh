#!/usr/bin/env bash
# Driver do review externo por lente (Devin CLI, modelo próprio grátis).
#
#   revisar_diff.sh --id <id> --foco "<pergunta>" [--arquivos "a b c"] [--base <sha>]
#
#   --arquivos  lista positiva de arquivos literais (montada pelos identificadores
#               NOVOS que você criou, não pelo vocabulário do assunto). Omitir com
#               --base revisa o commit/range inteiro.
#   --base      diff contra <sha> em vez de HEAD (ex.: --base HEAD~1 para revisar
#               trabalho já commitado). Sem --arquivos, usa a lista do próprio diff.
#
# O veredito se lê em scripts/agentes/saida/<id>/envelope.json, NUNCA no returncode:
#   status "ok"       -> relatório com a seção-sentinela "## Conclusão" e >= MIN_BYTES
#   status "sem-diff" -> nada a revisar (diff vazio; NÃO é "revisado e limpo")
#   status "segredo"  -> recorte recusado pelo filtro de segredos
#   status "truncado" -> turno morreu no meio mesmo após retomada
#   status "erro"     -> driver/CLI falhou
#
# ESTE ARQUIVO ESTÁ VIVO quando alguém o executa: edite via arquivo temporário + mv.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 2
. "$(dirname "$0")/../segredos.sh"

ID=""; FOCO=""; BASE="HEAD"; ARQUIVOS_RAW=""
MODELO="${REVISOR_MODEL:-swe-2-max}"
MIN_BYTES=1000
SENTINELA='## Conclusão'
CONFIG="$(dirname "$0")/revisor.config.json"

while [ $# -gt 0 ]; do
  case "$1" in
    --id) ID="$2"; shift 2;;
    --foco) FOCO="$2"; shift 2;;
    --arquivos) ARQUIVOS_RAW="$2"; shift 2;;
    --base) BASE="$2"; shift 2;;
    --modelo) MODELO="$2"; shift 2;;
    *) echo "flag desconhecida: $1" >&2; exit 2;;
  esac
done
[ -n "$ID" ] && [ -n "$FOCO" ] || { echo "uso: revisar_diff.sh --id <id> --foco <pergunta> [--arquivos ...] [--base <sha>]" >&2; exit 2; }

OUT="scripts/agentes/saida/$ID"
envelope() { # envelope <status> <detalhe>
  mkdir -p "$OUT"
  printf '{"id":"%s","status":"%s","detalhe":"%s","modelo":"%s","quando":"%s"}\n' \
    "$ID" "$1" "$(printf '%s' "${2:-}" | tr '\n"' '  ')" "$MODELO" "$(date -u +%FT%TZ)" > "$OUT/envelope.json"
}

# Sobra de execução anterior mata a lente na largada, em silêncio: limpa tudo do id.
rm -rf "$OUT"; mkdir -p "$OUT"

# ---- recorte (lista positiva) ------------------------------------------------
LISTA=()
if [ -n "$ARQUIVOS_RAW" ]; then
  for f in $ARQUIVOS_RAW; do LISTA+=("$f"); done
else
  while IFS= read -r f; do LISTA+=("$f"); done < <(git diff --name-only --diff-filter=ACMR "$BASE" -- 2>/dev/null)
fi
if [ "${#LISTA[@]}" -eq 0 ]; then envelope "sem-diff" "seleção vazia"; exit 0; fi

# Filtro de segredo fail-closed: forte sempre; fraco só se não rastreado/ignorado.
RECUSADOS=(); LIMPOS=()
for f in "${LISTA[@]}"; do
  if protegido "$f"; then RECUSADOS+=("$f"); else LIMPOS+=("$f"); fi
done
if [ "${#RECUSADOS[@]}" -gt 0 ]; then
  envelope "segredo" "recusados: ${RECUSADOS[*]}"
  printf 'RECUSADO (filtro de segredo): %s\n' "${RECUSADOS[@]}" >&2
  exit 3
fi

# ---- material ----------------------------------------------------------------
DIFF="$OUT/diff.patch"
{
  echo "# Recorte: ${LIMPOS[*]}"
  echo "# Base: $BASE"
  git diff "$BASE" -- "${LIMPOS[@]}"
  # Untracked não aparece em git diff: entra como conteúdo completo rotulado.
  for f in "${LIMPOS[@]}"; do
    if ! git ls-files --error-unmatch -- "$f" >/dev/null 2>&1 && [ -f "$f" ]; then
      echo; echo "=== ARQUIVO NOVO (não rastreado): $f ==="; cat -- "$f"
    fi
  done
} > "$DIFF" 2>&1
if [ "$(wc -c < "$DIFF")" -lt 200 ]; then envelope "sem-diff" "diff vazio (${#LISTA[@]} arquivos)"; exit 0; fi

PROMPT="$OUT/prompt.md"
# Prompt curto, inline: o material vai por CAMINHO (o revisor tem read liberado), porque
# (a) --prompt-file com -p sem prompt posicional cai no modo interativo e trava, medido
# nesta máquina; (b) argv do Windows tem teto ~32KB e um diff grande não cabe na linha.
cat > "$PROMPT" <<EOF
Você é um revisor de código SOMENTE LEITURA. Não há shell, não há edição, não há rede —
todas as ferramentas de escrita/execução estão bloqueadas. Se precisar de contexto, use a
ferramenta read para abrir os arquivos listados no recorte (workspace: C:\\piloto). Não
tente rodar git, npm ou qualquer comando — as tentativas serão negadas e encerram seu turno.

LENTE (responda só isto): $FOCO

O diff completo do recorte está em: ${DIFF}. Leia-o primeiro com a ferramenta read.

Regras do relatório (em português):
- Cada achado precisa de prova: arquivo:linha + trecho + por que é defeito, não estilo.
- Diga explicitamente o que você verificou e o que ficou sem verificar.
- O relatório termina, obrigatoriamente, com uma seção intitulada exatamente "$SENTINELA"
  contendo: veredito ("limpo" ou "achados"), a lista de achados em uma linha cada e a
  cobertura ("li os arquivos X, Y na íntegra" ou o que faltou ler).
EOF

# ---- execução ----------------------------------------------------------------
LOG="$OUT/log.txt"
EXPORT="$OUT/export.json"
REL="$OUT/relatorio.md"
INICIO=$(date +%s)

devin -p --model "$MODELO" --config "$CONFIG" --respect-workspace-trust false \
  --export "$EXPORT" -- "$(cat "$PROMPT")" > "$LOG" 2>&1
RC1=$?

# Turno que morre no meio se retoma na mesma sessão (o CLI guarda).
SID=""
if [ -f "$EXPORT" ]; then
  SID=$(node -e 'try{const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(j.session_id||j.sessionId||"")}catch{console.log("")}' "$EXPORT" 2>/dev/null)
fi
BYTES=$(wc -c < "$LOG" 2>/dev/null || echo 0)
if { [ "$RC1" -ne 0 ] || [ "$BYTES" -lt "$MIN_BYTES" ] || ! grep -qF "$SENTINELA" "$LOG"; } && [ -n "$SID" ]; then
  devin -p -r "$SID" --model "$MODELO" --config "$CONFIG" --respect-workspace-trust false \
    -- "Sua saída anterior foi interrompida. Entregue o relatório completo agora, terminando com a seção \"$SENTINELA\"." >> "$LOG" 2>&1
fi
FIM=$(date +%s)

cp "$LOG" "$REL"
BYTES=$(wc -c < "$LOG" 2>/dev/null || echo 0)
if grep -qF "$SENTINELA" "$LOG" && [ "$BYTES" -ge "$MIN_BYTES" ]; then
  STATUS="ok"
elif [ "$BYTES" -lt "$MIN_BYTES" ]; then
  STATUS="truncado"
else
  STATUS="erro"
fi
node -e 'const fs=require("fs");const e={id:process.argv[1],status:process.argv[2],bytes:+process.argv[3],duracao_s:+process.argv[4],rc_devin:+process.argv[5],session:process.argv[6]||null,modelo:process.argv[7],quando:new Date().toISOString()};fs.writeFileSync(process.argv[8],JSON.stringify(e,null,2)+"\n")' \
  "$ID" "$STATUS" "$BYTES" "$((FIM-INICIO))" "${RC1:-99}" "${SID:-}" "$MODELO" "$OUT/envelope.json"

echo "revisar_diff.sh: $ID -> $STATUS (${BYTES}B, ${FIM}-${INICIO}s) envelope em $OUT/envelope.json" >&2
[ "$STATUS" = "ok" ] && exit 0 || exit 1
