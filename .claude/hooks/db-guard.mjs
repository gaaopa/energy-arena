#!/usr/bin/env node
// Hook PreToolUse (Bash|exec). Guard das ações irreversíveis deste projeto (levantadas
// em 2026-09-20 com o dono: não existe produção; o banco local vai receber os ~400 alunos;
// toda decisão de preço, estorno, papel e exclusão é do dono).
// Padrão: identificar a família, checar o alvo, negar com a mensagem que diz O CAMINHO
// CERTO. Bypass consciente e visível: PILOTO_DB_OVERRIDE=1 no próprio comando.
// Bloqueia com stderr + exit 2. Fora das famílias: silêncio. Bug interno: exit 0.
import { bloquear, ehPrincipal, executar, lerStdinJson } from './_lib.mjs';

export const OVERRIDE = 'PILOTO_DB_OVERRIDE=1';
const RE_OVERRIDE = /\bPILOTO_DB_OVERRIDE=1(?![\w.=-])/; // token inteiro; '=1x' e prefixos não contam
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'gym-postgres', 'host.docker.internal']);

// Só conta SQL/prisma-client quando o comando de fato executa algo (não quando lê/greppa).
// node/tsx sem -e também executam (node script.js), assim como psql -f e
// prisma db execute --file — o review externo achou esses três falsos negativos.
const RE_EXECUTOR =
  /\b(psql|pg_restore|dropdb|createdb|node|tsx|npx|docker(?:-|\s+)compose\s+exec|docker\s+exec)\b/i;
const TABELAS_EXCLUSAO = '(aluno|matricula|pagamento|checkin|check_in|usuario|plano|unidade)s?';
const TABELAS_DONO = '(plano|matricula|pagamento|usuario)s?';
// Qualificador de schema opcional: public."Tabela", public.Tabela, "Tabela", Tabela.
const SCHEMA = '(?:"?[a-z_][\\w]*"??\\.)??';

const FAMILIAS = [
  {
    // Produção vem antes de banco-descartado: `dropdb -h remoto` é as duas coisas,
    // e a notícia mais grave é o host que não deveria existir neste projeto.
    id: 'producao',
    testa: (c) => hostsNaoLocais(c).length > 0,
    msg: (c) => [
      `DATABASE_URL/host fora de localhost detectado (${hostsNaoLocais(c).join(', ')}). Não existe produção neste projeto (decisão do dono, 2026-09-20); qualquer banco remoto é tratado como produção.`,
      'Caminho certo: pare e pergunte ao dono o que é esse banco. Quando produção existir, o único caminho será um script de deploy versionado, e este guard passará a apontar para ele.',
      `Bypass consciente, só com OK do dono neste turno: ${OVERRIDE} na frente do comando.`,
    ],
  },
  {
    id: 'banco-descartado',
    testa: (c) =>
      /\bprisma\s+migrate\s+reset\b/i.test(c) ||
      (/\bprisma\s+db\s+push\b/i.test(c) && /--(accept-data-loss|force-reset)\b/.test(c)) ||
      (/\bdocker(?:-|\s+)compose\b[^|;&]*\bdown\b/i.test(c) && /(\s-v\b|\s--volumes\b|\s-[a-z]*v[a-z]*\b)/.test(c)) ||
      /\bdocker\s+volume\s+(rm|prune)\b/i.test(c) ||
      (/\bdocker\s+system\s+prune\b/i.test(c) && /--volumes\b/.test(c)) ||
      /\bdropdb\b/i.test(c) ||
      (/\bpg_restore\b/i.test(c) && /--clean\b/.test(c)),
    msg: [
      'Apaga o volume pgdata (banco local inteiro; é onde os ~400 alunos vão morar após a migração de CSV).',
      'Caminho certo: 1) backup: docker compose exec postgres pg_dump -U gym gymdb > backup-$(date +%F).sql;',
      `2) com o backup feito e de propósito, repita o comando com ${OVERRIDE} na frente (fica na trilha de aprovação).`,
    ],
  },
  {
    id: 'decisao-do-dono',
    testa: (c) =>
      RE_EXECUTOR.test(c) &&
      (new RegExp(`\\bdrop\\s+(table|database|schema)\\b|\\btruncate\\s+(?:only\\s+)?${SCHEMA}"?${TABELAS_EXCLUSAO}"?(?=[\\s;'")]|$)|\\bdelete\\s+from\\s+(?:only\\s+)?${SCHEMA}"?${TABELAS_EXCLUSAO}"?(?=[\\s;'")]|$)`, 'i').test(c) ||
        new RegExp(`\\bupdate\\s+(?:only\\s+)?${SCHEMA}"?${TABELAS_DONO}"?\\s+(?:as\\s+\\w+\\s+)?set\\b|\\binsert\\s+into\\s+${SCHEMA}"?${TABELAS_EXCLUSAO}"?(?=[\\s;'")]|$)`, 'i').test(c) ||
        /\.(plano|matricula|pagamento|usuario)\.(update|updateMany|upsert|create|createMany)\(/.test(c) ||
        /\.(aluno|matricula|pagamento|checkIn|usuario|plano|unidade)\.(delete|deleteMany)\(/.test(c)),
    msg: [
      'Escrita direta no banco em tabela que decide política do dono (preço/valor, estorno/cancelamento, papel/admin, exclusão de aluno/matrícula/pagamento/check-in). Não é ajuste técnico, é decisão dele (2026-09-20: "todos").',
      'Caminho certo: use o fluxo da API (PATCH /api/pagamentos/:id/pagar, PATCH /api/matriculas/:id/cancelar, POST /api/usuarios) ou peça OK explícito do dono NESTE turno e',
      `repita com ${OVERRIDE} na frente do comando, que fica na trilha de aprovação.`,
    ],
  },
  {
    // SQL/script invisível: o que se aprova é a linha de comando; um arquivo esconde
    // o conteúdo. -f/--file/--stdin e script solto com cheiro de banco são essa classe.
    // Vem DEPOIS de decisao-do-dono: heredoc `<<SQL ... SQL` mostra o SQL na linha e
    // merece a mensagem específica; -f/--file escondem o conteúdo de verdade.
    id: 'script-invisivel',
    testa: (c) =>
      /\bpsql\b[^|;&]*?(?:\s-f\s|\s--file\s|\s<<?\s*\S)/i.test(c) ||
      /\bprisma\s+db\s+execute\b[^|;&]*?--(stdin|file)\b/i.test(c) ||
      (/\b(?:node|tsx|npx\s+tsx)\s+(?!-)\S+\.(?:js|mjs|cjs|ts)\b/i.test(c) &&
        !/\bprisma[/\\]seed\.ts\b/i.test(c) && // tsx prisma/seed.ts é o caminho sancionado (npm run db:seed)
        /\b(prisma|database_url|postgres|psql|seeds?|alunos?|matriculas?|pagamentos?|usuarios?|planos?)\b/i.test(c)),
    msg: [
      'Comando executa SQL/script cujo conteúdo não está na linha — invisível para este guard e para quem aprova.',
      'Caminho certo: escreva o SQL no comando ou em migration versionada (npm run db:migrate gera em api/prisma/migrations/),',
      'ou peça OK explícito do dono e repita com PILOTO_DB_OVERRIDE=1 na frente.',
    ],
  },
];

export function hostsNaoLocais(comando) {
  const hosts = new Set();
  for (const m of comando.matchAll(/postgres(?:ql)?:\/\/(?:[^@\s/]*@)?(\[[^\]]+\]|[^:/\s?"']+)/gi)) hosts.add(m[1]);
  for (const m of comando.matchAll(/\b(?:psql|pg_dump|pg_restore|dropdb|createdb)\b[^|;&\n]*?(?:\s-h\s*|\s--host[=\s])([^\s"']+)/gi)) hosts.add(m[1]);
  // conninfo keyword e variável de ambiente: host=..., PGHOST=...
  for (const m of comando.matchAll(/(?:^|\s|['"])(?:PGHOST|host)=([^\s"';]+)/gi)) hosts.add(m[1]);
  return [...hosts].filter((h) => !HOSTS_LOCAIS.has(h.toLowerCase()));
}

export function avaliar(comando) {
  // Comando chega cru (ex.: -c \"DELETE FROM \\\"Aluno\\\"\"): normaliza aspas
  // escapadas para que os padrões vejam o SQL real, não a casca de quoting.
  const c = String(comando || '').replace(/\\(["'])/g, '$1');
  if (!c.trim()) return null;
  if (RE_OVERRIDE.test(c)) return { bypass: true };
  for (const f of FAMILIAS) {
    if (f.testa(c)) {
      const linhas = typeof f.msg === 'function' ? f.msg(c) : f.msg;
      return { familia: f.id, texto: [`BLOQUEADO [${f.id}]`, ...linhas].join('\n') };
    }
  }
  return null;
}

async function main() {
  const idx = process.argv.indexOf('--comando');
  const comando = idx !== -1 ? process.argv.slice(idx + 1).join(' ') : String(lerStdinJson().tool_input?.command || '');
  const r = avaliar(comando);
  if (!r || r.bypass) return 0;
  return bloquear(r.texto);
}

if (ehPrincipal(import.meta.url)) executar(main);
