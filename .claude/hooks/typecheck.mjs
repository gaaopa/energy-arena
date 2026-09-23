#!/usr/bin/env node
// Hook PostToolUse (Edit|Write) e segunda porta (--arquivo <path>).
// Roda o tsc do workspace do arquivo editado (api/ ou web/) e separa dois vereditos:
//   BLOQUEIA (exit 2): nome/módulo indefinido ou erro de sintaxe NO ARQUIVO EDITADO.
//     É o NameError daqui: derruba o boot do Nest e o build do Vite.
//   AVISA (exit 0 + JSON): qualquer outro erro de tipo novo em relação à linha de base
//     do workspace. A linha de base é gravada em silêncio na primeira execução e só encolhe.
// Arquivo fora do include do tsconfig não é "verde": é "sem checagem", e o hook diz isso.
import fs from 'node:fs';
import path from 'node:path';
import {
  RAIZ, STATE_DIR, avisar, binLocal, bloquear, ehPrincipal, executar,
  gravarJson, lerJson, lerStdinJson, caminhoDaEdicao, normalizar, rodar,
} from './_lib.mjs';

const WORKSPACES = {
  api: { dir: 'api', args: ['--noEmit', '-p', 'tsconfig.json', '--pretty', 'false'], cobre: (rel) => rel.startsWith('src/') || rel === 'prisma/seed.ts' || rel.startsWith('test/') },
  web: { dir: 'web', args: ['-b', '--noEmit', '--pretty', 'false'], cobre: (rel) => rel.startsWith('src/') || rel === 'vite.config.ts' },
};
// Classe que quebra o boot: nome/namespace/módulo/export inexistente, ou sintaxe (TS1xxx).
const RE_BLOQUEIO = /^TS(1\d{3}|2304|2305|2307|2503|2552|2614|2693|2724)$/;
const RE_DIAG = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

export function workspaceDe(arquivo) {
  const abs = normalizar(arquivo);
  for (const [nome, ws] of Object.entries(WORKSPACES)) {
    const base = normalizar(path.join(RAIZ, ws.dir)) + '/';
    if (abs.startsWith(base)) return { nome, ws, rel: abs.slice(base.length) };
  }
  return null;
}

function parseTsc(saida, cwd) {
  const diags = [];
  for (const linha of saida.split(/\r?\n/)) {
    const m = RE_DIAG.exec(linha.trim());
    if (!m) continue;
    diags.push({
      arquivo: normalizar(path.resolve(cwd, m[1])),
      linha: Number(m[2]),
      codigo: m[4],
      mensagem: m[5].trim(),
    });
  }
  return diags;
}

const chaveBase = (d) => `${d.arquivo}\u0001${d.codigo}\u0001${d.mensagem}`;

export function analisar(arquivo, { rodar }) {
  const alvo = workspaceDe(arquivo);
  if (!alvo) return { fora: true };
  const tsc = binLocal('tsc');
  if (!tsc) return { ferramentaAusente: 'tsc (node_modules/.bin/tsc) não encontrado; rode npm install' };
  if (!alvo.ws.cobre(alvo.rel)) {
    return { semChecagem: `${alvo.rel} está fora do include de ${alvo.nome}/tsconfig: nenhum typecheck cobre este arquivo. Inclua-o no tsconfig ou mova-o.` };
  }
  const cwd = path.join(RAIZ, alvo.ws.dir);
  const r = rodar(tsc, alvo.ws.args, { cwd, timeout: 120_000 });
  if (r.erro) return { ferramentaAusente: `tsc falhou ao executar: ${r.erro.message}` };
  const atuais = parseTsc(r.stdout + '\n' + r.stderr, cwd);

  const arquivoBase = path.join(STATE_DIR, `typecheck-baseline.${alvo.nome}.json`);
  const base = lerJson(arquivoBase, null);
  if (base === null) {
    gravarJson(arquivoBase, atuais.map(chaveBase));
    return { alvo, primeiraExecucao: true, total: atuais.length, bloqueios: [], novos: [] };
  }
  // multiset: baseline só encolhe (interseção com o atual)
  const restante = new Map();
  for (const k of base) restante.set(k, (restante.get(k) || 0) + 1);
  const novos = [];
  const baseNova = [];
  for (const d of atuais) {
    const k = chaveBase(d);
    const n = restante.get(k) || 0;
    if (n > 0) {
      restante.set(k, n - 1);
      baseNova.push(k);
    } else novos.push(d);
  }
  if (baseNova.length !== base.length) gravarJson(arquivoBase, baseNova);

  const editado = normalizar(arquivo);
  const bloqueios = novos.filter((d) => d.arquivo === editado && RE_BLOQUEIO.test(d.codigo));
  const avisos = novos.filter((d) => !bloqueios.includes(d));
  return { alvo, bloqueios, novos: avisos };
}

function formatar(d) {
  return `${path.relative(RAIZ, d.arquivo).replace(/\\/g, '/')}:${d.linha} ${d.codigo} ${d.mensagem}`;
}

export function textoRelatorio(res, arquivo) {
  const nome = path.basename(arquivo);
  if (res.fora) return { texto: '', resumo: '' };
  if (res.ferramentaAusente) return { texto: `typecheck: ${res.ferramentaAusente}`, resumo: 'typecheck não rodou' };
  if (res.semChecagem) return { texto: `typecheck: ${res.semChecagem}`, resumo: `${nome} sem typecheck` };
  if (res.primeiraExecucao) return { texto: '', resumo: '' };
  const partes = [];
  if (res.bloqueios.length) {
    partes.push(`BLOQUEADO — nome/módulo indefinido ou sintaxe em ${nome} (derruba o boot). Corrija antes de seguir:`);
    partes.push(...res.bloqueios.map(formatar));
  }
  if (res.novos.length) {
    partes.push(`Erros de tipo novos em relação à linha de base do workspace ${res.alvo.nome} (${res.novos.length}):`);
    partes.push(...res.novos.map(formatar));
  }
  const resumo = res.bloqueios.length
    ? `${res.bloqueios.length} nome(s) indefinido(s) em ${nome}`
    : `${res.novos.length} erro(s) de tipo novo(s) após editar ${nome}`;
  return { texto: partes.join('\n'), resumo };
}

async function main() {
  const idx = process.argv.indexOf('--arquivo');
  if (idx !== -1) {
    const arquivo = path.resolve(process.argv[idx + 1] || '');
    const res = analisar(arquivo, { rodar });
    const { texto } = textoRelatorio(res, arquivo);
    if (texto) process.stdout.write(texto + '\n');
    if (res.ferramentaAusente || res.semChecagem) return 2;
    return res.bloqueios?.length || res.novos?.length ? 1 : 0;
  }
  const dados = lerStdinJson();
  const arquivo = caminhoDaEdicao(dados);
  if (!/\.(ts|tsx|mts|cts)$/.test(arquivo)) return 0;
  const res = analisar(path.resolve(arquivo), { rodar });
  const { texto, resumo } = textoRelatorio(res, arquivo);
  if (!texto) return 0;
  if (res.bloqueios?.length) return bloquear(texto);
  return avisar('PostToolUse', texto, resumo);
}

if (ehPrincipal(import.meta.url)) executar(main);
