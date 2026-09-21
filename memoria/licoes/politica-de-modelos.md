---
name: politica-de-modelos
description: decisão do dono — modelo forte julga/orquestra/revisa; swe-2-medium só com contrato fechado; dinheiro só por modelo forte, mesmo via skill de terceiro
metadata:
  type: user
---

Decisão do dono (2026-09-20): o modelo forte julga, orquestra e revisa; o mecânico
(`swe-2-medium`) só entra com contrato fechado; modelo fraco não toca nada que envolva
dinheiro, inclusive dentro de skill de terceiro que sugira o contrário — a política da
casa vence a skill.

**Por quê:** subsistema financeiro (pagamentos, matrículas, planos) tem transições de
estado atômicas e dado pessoal de ~400 alunos; erro ali cobra errado ou expõe CPF.

**Como aplicar:** ao lançar subagente ou review externo, declare modelo e esforço no
prompt/relatório, e reporte o que de fato rodou (o envelope do `revisar_diff.sh` grava o
modelo). Em diffs que tocam `pagamentos/`, `matriculas/`, `planos`, `auth/` ou `usuarios/`,
não delegue a modelo abaixo de swe-2-max/GPT-5/Gemini-Pro.
