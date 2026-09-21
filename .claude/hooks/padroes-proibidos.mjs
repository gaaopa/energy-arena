#!/usr/bin/env node
// Hook PostToolUse (Edit|Write) e segunda porta (--arquivo <path>).
// Guard de padrão proibido do domínio: regras fechadas que um regex pega. Cada regra
// existe porque o código da casa já decide de outro jeito (AGENTS.md, "O que não muda").
// Ocorrência nova (não existia no HEAD) BLOQUEIA (exit 2); pré-existente só avisa, para
// que editar um arquivo com dívida antiga não trave a edição.
import fs from 'node:fs';
import path from 'node:path';
import {
  RAIZ, avisar, bloquear, conteudoNoHead, ehPrincipal, executar, lerStdinJson,
  caminhoDaEdicao, normalizar, semComentario,
} from './_lib.mjs';

const REGRAS = [
  {
    id: 'process-env',
    vale: (rel) => rel.startsWith('api/src/') && rel.endsWith('.ts') && rel !== 'api/src/config/env.validation.ts',
    re: /\bprocess\.env\b/,
    msg: 'process.env direto em api/src. Variável de ambiente só entra por api/src/config/env.validation.ts (zod) e sai pelo ConfigService (config.getOrThrow). Fix: declare a variável no envSchema e injete ConfigService.',
  },
  {
    id: 'dinheiro-float',
    vale: (rel) => rel.startsWith('api/src/') && rel.endsWith('.ts'),
    re: /\b(parseFloat|Number)\(\s*[\w.?!]*valor\b/i,
    msg: 'valor monetário convertido para float na API. Plano.valor, Matricula.valor e Pagamento.valor são Decimal(10,2) do Prisma; some e compare com Prisma.Decimal (new Prisma.Decimal(x).plus(y)), nunca com Number/parseFloat.',
  },
  {
    id: 'segredo-hardcoded',
    vale: (rel) => /^(api|web)\/src\//.test(rel),
    re: /\b(JWT_ACCESS_SECRET|DATABASE_URL|SEED_ADMIN_SENHA)\b\s*[:=]\s*['"`][^'"`]{4,}/,
    msg: 'segredo com valor literal no código. Vai para api/.env (gitignored) e api/.env.example (sem valor real); o código lê via ConfigService.',
  },
  {
    id: 'controller-sem-roles',
    porArquivo: true,
    vale: (rel) => /^api\/src\/modules\/(?!auth\/).+\.controller\.ts$/.test(rel),
    testa: (conteudo) => /@Controller\(/.test(conteudo) && !/@Roles\(/.test(conteudo) && !/@Public\(\)/.test(conteudo),
    msg: 'controller fora de auth/ sem @Roles(...) na classe nem @Public(). O RolesGuard libera rota sem @Roles para qualquer usuário autenticado, inclusive INSTRUTOR e ALUNO. Fix: @Roles(Role.ADMIN, Role.RECEPCAO) logo abaixo de @Controller, como em pagamentos.controller.ts.',
  },
];

function ocorrencias(conteudo, rel) {
  const linhas = conteudo.split('\n');
  const achados = [];
  for (const regra of REGRAS) {
    if (!regra.vale(rel)) continue;
    if (regra.porArquivo) {
      if (regra.testa(conteudo)) achados.push({ regra, linha: 1, texto: '<arquivo>' });
      continue;
    }
    linhas.forEach((l, i) => {
      const limpa = semComentario(l);
      if (limpa && regra.re.test(limpa)) achados.push({ regra, linha: i + 1, texto: limpa });
    });
  }
  return achados;
}

export function analisar(arquivo) {
  const abs = path.resolve(arquivo);
  const rel = path.relative(RAIZ, abs).replace(/\\/g, '/');
  if (rel.startsWith('..') || !fs.existsSync(abs) || !REGRAS.some((r) => r.vale(rel))) return { fora: true };
  const atuais = ocorrencias(fs.readFileSync(abs, 'utf8'), rel);
  if (!atuais.length) return { novos: [], antigos: [] };
  const head = conteudoNoHead(abs);
  const antigosChaves = new Set(head === null ? [] : ocorrencias(head, rel).map((a) => `${a.regra.id}\u0001${a.texto}`));
  const novos = [];
  const antigos = [];
  for (const a of atuais) (antigosChaves.has(`${a.regra.id}\u0001${a.texto}`) ? antigos : novos).push(a);
  return { novos, antigos, rel };
}

export function textoRelatorio(res) {
  if (res.fora) return { texto: '', resumo: '' };
  const fmt = (a) => `${res.rel}:${a.linha} [${a.regra.id}] ${a.regra.msg}`;
  const partes = [];
  if (res.novos.length) partes.push('BLOQUEADO — padrão proibido introduzido nesta edição:', ...res.novos.map(fmt));
  if (res.antigos.length) partes.push(`Pré-existente no HEAD (não é seu, mas está aqui): ${res.antigos.length}`, ...res.antigos.map(fmt));
  return { texto: partes.join('\n'), resumo: `${res.novos.length} padrão(ões) proibido(s) novo(s)` };
}

async function main() {
  const idx = process.argv.indexOf('--arquivo');
  if (idx !== -1) {
    const res = analisar(process.argv[idx + 1] || '');
    const { texto } = textoRelatorio(res);
    if (texto) process.stdout.write(texto + '\n');
    return res.novos?.length ? 1 : 0;
  }
  const arquivo = caminhoDaEdicao(lerStdinJson());
  if (!arquivo) return 0;
  const res = analisar(arquivo);
  const { texto, resumo } = textoRelatorio(res);
  if (!texto) return 0;
  return res.novos.length ? bloquear(texto) : avisar('PostToolUse', texto, resumo);
}

if (ehPrincipal(import.meta.url)) executar(main);
