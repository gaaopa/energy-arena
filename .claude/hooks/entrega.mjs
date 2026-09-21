#!/usr/bin/env node
// Cobra a matriz de entrega. Um script, quatro eventos:
//   PostToolUse (edit/write/exec): anota o que o turno editou e se rodou verificação.
//   Stop: turno com 3+ arquivos distintos e resposta sem prova -> grava marcador +
//         systemMessage (nunca additionalContext no Stop: reabre o turno, vira laço).
//   UserPromptSubmit: se há marcador, injeta additionalContext e apaga; zera o turno.
// Avisa, não bloqueia: é lembrete de gesto, e gesto bloqueado vira teatro.
import fs from 'node:fs';
import path from 'node:path';
import { STATE_DIR, ehPrincipal, executar, gravarJson, lerJson, lerStdinJson, caminhoDaEdicao, normalizar } from './_lib.mjs';

const MIN_ARQUIVOS = 3;
const RE_EDICAO = /^(Edit|Write|MultiEdit|NotebookEdit|edit|write|apply_patch|notebook_edit)$/;
const RE_EXEC = /^(Bash|exec)$/;
const RE_VERIFICACAO =
  /\b(tsc|typecheck|node --test|npm (run )?(test|typecheck|build|lint)|oxlint|vitest|jest|rodar\.sh|revisar_diff\.sh|curl\b)/;

const LEMBRETE = [
  'Matriz de entrega pendente: o turno anterior editou 3 ou mais arquivos e a resposta final não trouxe prova.',
  'Antes de seguir, feche o turno anterior com uma matriz: por item, resultado observável, prova (comando e saída, ou arquivo:linha) e bloqueador, se houver.',
  'Item sem prova fica pendente, não vira concluído (AGENTS.md, "Completude" e "Prova").',
].join(' ');

function arquivosDeEstado(sid) {
  const seguro = String(sid || 'sem-sessao').replace(/[^\w.-]/g, '_');
  return {
    turno: path.join(STATE_DIR, `turno-${seguro}.json`),
    marcador: path.join(STATE_DIR, `entrega-${seguro}.pendente`),
  };
}

export function temProva(texto) {
  if (!texto) return false;
  const linhasTabela = texto.split('\n').filter((l) => /^\s*\|.+\|\s*$/.test(l)).length;
  if (linhasTabela >= 2) return true;
  if (/[\w./\\-]+\.(?:ts|tsx|mjs|cjs|js|json|md|sql|prisma|sh|ya?ml)(?::\d+|#L\d+)/.test(texto)) return true;
  if (/\b(exit code|rc)\s*[:=]?\s*\d/i.test(texto)) return true;
  const blocos = texto.match(/```[\s\S]*?```/g) || [];
  return blocos.some((b) => {
    const ls = b.split('\n').slice(1, -1);
    // prompt de shell real: `$ cmd`, `> cmd` (sql/psql) e `PS C:\...>` (PowerShell)
    return ls.length >= 2 && /^\s*(\$|>|PS\b[^>]*>)\s?\S/.test(ls[0]);
  });
}

// Última resposta do assistente no transcript JSONL do Claude Code (o Devin CLI não
// entrega transcript no Stop; nesse caso vale o proxy "rodou verificação").
export function ultimaRespostaDoTranscript(caminho) {
  if (!caminho || !fs.existsSync(caminho)) return null;
  let buffer = [];
  for (const linha of fs.readFileSync(caminho, 'utf8').split('\n')) {
    if (!linha.trim()) continue;
    let ev;
    try {
      ev = JSON.parse(linha);
    } catch {
      continue;
    }
    const conteudo = ev?.message?.content;
    if (ev.type === 'user') {
      const ehToolResult = Array.isArray(conteudo) && conteudo.every((c) => c?.type === 'tool_result');
      if (!ehToolResult) buffer = [];
    } else if (ev.type === 'assistant' && Array.isArray(conteudo)) {
      for (const c of conteudo) if (c?.type === 'text' && c.text) buffer.push(c.text);
    }
  }
  // Transcript existe mas sem texto do assistente = null: cai no proxy de verificação
  // (antes disto, transcript vazio silenciava o proxy e disparava falso marcador).
  return buffer.join('\n') || null;
}

export function processar(dados, agora = Date.now()) {
  const evento = dados.hook_event_name || '';
  const { turno, marcador } = arquivosDeEstado(dados.session_id);
  const estado = lerJson(turno, { edicoes: [], verificacao: false, inicio: agora });

  if (evento === 'UserPromptSubmit') {
    gravarJson(turno, { edicoes: [], verificacao: false, inicio: agora });
    if (fs.existsSync(marcador)) {
      fs.rmSync(marcador, { force: true });
      return { rc: 0, saida: { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: LEMBRETE } } };
    }
    return { rc: 0 };
  }

  if (evento === 'PostToolUse') {
    const tool = dados.tool_name || '';
    if (RE_EDICAO.test(tool)) {
      const arq = normalizar(caminhoDaEdicao(dados));
      if (arq && !estado.edicoes.includes(arq)) estado.edicoes.push(arq);
      gravarJson(turno, estado);
    } else if (RE_EXEC.test(tool)) {
      const cmd = String(dados.tool_input?.command || '');
      if (RE_VERIFICACAO.test(cmd) && !estado.verificacao) {
        estado.verificacao = true;
        gravarJson(turno, estado);
      }
    }
    return { rc: 0 };
  }

  if (evento === 'Stop') {
    if (dados.stop_hook_active) return { rc: 0 };
    if (estado.edicoes.length < MIN_ARQUIVOS) return { rc: 0 };
    const resposta = ultimaRespostaDoTranscript(dados.transcript_path);
    const provou = resposta !== null ? temProva(resposta) : estado.verificacao;
    if (provou) return { rc: 0 };
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(marcador, new Date(agora).toISOString());
    const n = estado.edicoes.length;
    return {
      rc: 0,
      saida: {
        systemMessage: `Entrega sem prova: ${n} arquivos editados neste turno e a resposta final não tem matriz, comando com saída nem arquivo:linha. O lembrete será injetado no próximo prompt.`,
      },
    };
  }

  return { rc: 0 };
}

if (ehPrincipal(import.meta.url)) {
  executar(() => {
    const dados = lerStdinJson();
    const { rc, saida } = processar(dados);
    if (saida) process.stdout.write(JSON.stringify(saida) + '\n');
    return rc;
  });
}
