#!/usr/bin/env node
// Hook PostToolUse (Edit|Write) e segunda porta (--arquivo <path>).
// Linter de classe-bug (oxlint, categoria correctness; sem estilo, sem formatação) e uma
// regra que muda tudo: reporta APENAS o que a edição introduziu. Roda no arquivo editado e
// na versão dele no HEAD (git show HEAD:<arquivo>) e mostra só a diferença, pela chave
// (código, mensagem, linha sem comentário, escopo). Arquivo novo: tudo é da edição.
// Nunca autofix. Avisa, não bloqueia.
import fs from 'node:fs';
import path from 'node:path';
import {
  RAIZ, achadosNovos, avisar, binLocal, conteudoNoHead, ehPrincipal, executar,
  lerStdinJson, caminhoDaEdicao, normalizar, rodar, tmpArquivoComExtensao,
} from './_lib.mjs';

const RE_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const RE_IGNORAR = /\/(node_modules|dist|build|\.vite)\//;
// no-unused-vars é de higiene, não de bug, e gera ruído a cada função criada antes do uso;
// o tsconfig do web já falha por noUnusedLocals.
const ARGS_OXLINT = ['--format', 'json', '-A', 'no-unused-vars'];

export function emEscopo(arquivo) {
  const n = normalizar(arquivo);
  return RE_EXT.test(n) && !RE_IGNORAR.test(n) && n.startsWith(normalizar(RAIZ) + '/');
}

function oxlint(bin, caminho) {
  const r = rodar(bin, [...ARGS_OXLINT, caminho]);
  if (r.erro) throw new Error(`oxlint falhou: ${r.erro.message}`);
  let json;
  try {
    json = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  } catch {
    throw new Error(`oxlint devolveu saída não-JSON (rc ${r.rc}): ${(r.stderr || r.stdout).slice(0, 300)}`);
  }
  return (json.diagnostics || []).map((d) => ({
    codigo: d.code || '?',
    mensagem: String(d.message || '').trim(),
    linha: d.labels?.[0]?.span?.line || 1,
    ajuda: d.help || '',
  }));
}

export function analisar(arquivo) {
  if (!emEscopo(arquivo) || !fs.existsSync(arquivo)) return { fora: true };
  const bin = binLocal('oxlint');
  if (!bin) return { ferramentaAusente: 'oxlint (node_modules/.bin/oxlint) não encontrado; rode npm install' };
  let atuais;
  try {
    atuais = oxlint(bin, arquivo);
  } catch (e) {
    return { ferramentaAusente: e.message };
  }
  const linhasAtuais = fs.readFileSync(arquivo, 'utf8').split('\n');
  const head = conteudoNoHead(arquivo);
  if (head === null) return { novos: atuais, linhas: linhasAtuais, arquivoNovo: true };
  const tmp = tmpArquivoComExtensao(head, path.extname(arquivo));
  let anteriores;
  try {
    anteriores = oxlint(bin, tmp.caminho);
  } catch (e) {
    return { ferramentaAusente: e.message };
  } finally {
    tmp.limpar();
  }
  return { novos: achadosNovos(atuais, linhasAtuais, anteriores, head.split('\n')), linhas: linhasAtuais, anteriores: anteriores.length };
}

export function textoRelatorio(res, arquivo) {
  const rel = path.relative(RAIZ, arquivo).replace(/\\/g, '/');
  if (res.fora) return { texto: '', resumo: '' };
  if (res.ferramentaAusente) return { texto: `lint-bug: ${res.ferramentaAusente}`, resumo: 'lint-bug não rodou' };
  if (!res.novos.length) return { texto: '', resumo: '' };
  const cab = res.arquivoNovo
    ? `Achados de classe-bug em ${rel} (arquivo novo: tudo é desta edição):`
    : `Achados de classe-bug que ESTA edição introduziu em ${rel} (o HEAD tinha ${res.anteriores}; esses não são seus):`;
  const linhas = res.novos.map((a) => `${rel}:${a.linha} ${a.codigo} ${a.mensagem}${a.ajuda ? ` — ${a.ajuda}` : ''}`);
  return { texto: [cab, ...linhas, 'Sem autofix: julgue cada um.'].join('\n'), resumo: `${res.novos.length} achado(s) novo(s) em ${path.basename(arquivo)}` };
}

async function main() {
  const idx = process.argv.indexOf('--arquivo');
  if (idx !== -1) {
    const arquivo = path.resolve(process.argv[idx + 1] || '');
    const res = analisar(arquivo);
    const { texto } = textoRelatorio(res, arquivo);
    if (texto) process.stdout.write(texto + '\n');
    if (res.ferramentaAusente) return 2;
    return res.novos?.length ? 1 : 0;
  }
  const dados = lerStdinJson();
  const arquivo = caminhoDaEdicao(dados);
  if (!arquivo) return 0;
  const res = analisar(path.resolve(arquivo));
  const { texto, resumo } = textoRelatorio(res, path.resolve(arquivo));
  return texto ? avisar('PostToolUse', texto, resumo) : 0;
}

if (ehPrincipal(import.meta.url)) executar(main);
