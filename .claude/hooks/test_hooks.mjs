// Bancada dos hooks. Roda em segundos, sem container e sem rede:
//   node --test .claude/hooks/test_hooks.mjs
// Cada caso alimenta o hook por stdin com JSON sintético e confere o DIAGNÓSTICO,
// não só o código de saída. Ferramenta ausente => caso pulado em voz alta, nunca verde.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { HOOKS_DIR, RAIZ, STATE_DIR, binLocal } from './_lib.mjs';

const HOOK = (nome) => path.join(HOOKS_DIR, nome);

function rodarHook(nome, entrada, opts = {}) {
  const r = spawnSync(process.execPath, [HOOK(nome), ...(opts.args || [])], {
    input: typeof entrada === 'string' ? entrada : JSON.stringify(entrada),
    encoding: 'utf8',
    cwd: opts.cwd || RAIZ,
    env: { ...process.env, ...opts.env },
    timeout: 60_000,
  });
  let json = null;
  try {
    json = JSON.parse(r.stdout.trim().split('\n').pop());
  } catch {}
  return { rc: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

function sessaoNova() {
  return `bancada-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function limparSessao(sid) {
  for (const f of fs.existsSync(STATE_DIR) ? fs.readdirSync(STATE_DIR) : []) {
    if (f.includes(sid)) fs.rmSync(path.join(STATE_DIR, f), { force: true });
  }
}

function pular(t, motivo) {
  process.stderr.write(`\n[BANCADA] CASO PULADO: ${t.name} -> ${motivo}\n`);
  t.skip(motivo);
}

// ---------------------------------------------------------------- entrega.mjs

test('entrega: 3 arquivos sem prova -> marcador + systemMessage; próximo prompt injeta e apaga', () => {
  const sid = sessaoNova();
  try {
    rodarHook('entrega.mjs', { hook_event_name: 'UserPromptSubmit', session_id: sid, prompt: 'faz aí' });
    for (const f of ['api/src/a.ts', 'api/src/b.ts', 'web/src/c.tsx']) {
      const r = rodarHook('entrega.mjs', {
        hook_event_name: 'PostToolUse',
        session_id: sid,
        tool_name: 'Edit',
        tool_input: { file_path: path.join(RAIZ, f) },
      });
      assert.equal(r.rc, 0);
    }
    const stop = rodarHook('entrega.mjs', { hook_event_name: 'Stop', session_id: sid, stop_hook_active: false });
    assert.equal(stop.rc, 0);
    assert.ok(stop.json?.systemMessage, `esperava systemMessage, veio: ${stop.stdout}`);
    assert.match(stop.json.systemMessage, /3 arquivos editados/);
    assert.equal(stop.json.hookSpecificOutput, undefined, 'Stop nunca devolve additionalContext (reabre o turno)');

    const prox = rodarHook('entrega.mjs', { hook_event_name: 'UserPromptSubmit', session_id: sid, prompt: 'continua' });
    assert.equal(prox.rc, 0);
    assert.equal(prox.json?.hookSpecificOutput?.hookEventName, 'UserPromptSubmit');
    assert.match(prox.json.hookSpecificOutput.additionalContext, /Matriz de entrega pendente/);

    const depois = rodarHook('entrega.mjs', { hook_event_name: 'UserPromptSubmit', session_id: sid, prompt: 'de novo' });
    assert.equal(depois.json, null, 'marcador deve ter sido apagado após injetar uma vez');
  } finally {
    limparSessao(sid);
  }
});

test('entrega: 2 arquivos não dispara; verificação rodada no turno conta como prova (sem transcript)', () => {
  const sid = sessaoNova();
  try {
    rodarHook('entrega.mjs', { hook_event_name: 'UserPromptSubmit', session_id: sid });
    for (const f of ['api/src/a.ts', 'api/src/b.ts']) {
      rodarHook('entrega.mjs', { hook_event_name: 'PostToolUse', session_id: sid, tool_name: 'edit', tool_input: { file_path: f } });
    }
    assert.equal(rodarHook('entrega.mjs', { hook_event_name: 'Stop', session_id: sid }).json, null);

    rodarHook('entrega.mjs', { hook_event_name: 'PostToolUse', session_id: sid, tool_name: 'write', tool_input: { file_path: 'api/src/c.ts' } });
    rodarHook('entrega.mjs', { hook_event_name: 'PostToolUse', session_id: sid, tool_name: 'exec', tool_input: { command: 'npm run typecheck' } });
    assert.equal(rodarHook('entrega.mjs', { hook_event_name: 'Stop', session_id: sid }).json, null, 'typecheck rodado = prova por proxy');
  } finally {
    limparSessao(sid);
  }
});

test('entrega: com transcript, a prova é lida da última resposta (tabela conta; prosa não)', () => {
  const sid = sessaoNova();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-'));
  try {
    rodarHook('entrega.mjs', { hook_event_name: 'UserPromptSubmit', session_id: sid });
    for (const f of ['x.ts', 'y.ts', 'z.ts']) {
      rodarHook('entrega.mjs', { hook_event_name: 'PostToolUse', session_id: sid, tool_name: 'Write', tool_input: { file_path: `api/src/${f}` } });
    }
    const linha = (type, content) => JSON.stringify({ type, message: { role: type, content } });
    const semProva = path.join(dir, 'sem.jsonl');
    fs.writeFileSync(
      semProva,
      [linha('user', 'pedido'), linha('assistant', [{ type: 'text', text: 'Pronto, terminei tudo e está funcionando.' }])].join('\n'),
    );
    const r1 = rodarHook('entrega.mjs', { hook_event_name: 'Stop', session_id: sid, transcript_path: semProva });
    assert.ok(r1.json?.systemMessage, 'prosa sem prova deve disparar');
    limparSessao(sid);

    rodarHook('entrega.mjs', { hook_event_name: 'UserPromptSubmit', session_id: sid });
    for (const f of ['x.ts', 'y.ts', 'z.ts']) {
      rodarHook('entrega.mjs', { hook_event_name: 'PostToolUse', session_id: sid, tool_name: 'Write', tool_input: { file_path: `api/src/${f}` } });
    }
    const comProva = path.join(dir, 'com.jsonl');
    fs.writeFileSync(
      comProva,
      [
        linha('user', 'pedido'),
        linha('assistant', [{ type: 'text', text: 'rascunho' }]),
        linha('user', [{ type: 'tool_result', content: 'ok' }]),
        linha('assistant', [{ type: 'text', text: '| item | prova |\n|---|---|\n| a | api/src/x.ts:12 |' }]),
      ].join('\n'),
    );
    const r2 = rodarHook('entrega.mjs', { hook_event_name: 'Stop', session_id: sid, transcript_path: comProva });
    assert.equal(r2.json, null, 'matriz na resposta final = prova');
  } finally {
    limparSessao(sid);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('entrega: stdin inválido não trava nada (lei 1)', () => {
  const r = rodarHook('entrega.mjs', '{isso não é json');
  assert.equal(r.rc, 0);
});

// ---------------------------------------------------------------- lint-bug.mjs

function repoTemporario() {
  // Dentro de RAIZ (o hook só olha arquivos do projeto) e dentro de .state (gitignored).
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const dir = fs.mkdtempSync(path.join(STATE_DIR, 'repo-'));
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')} falhou: ${r.stderr}`);
    return r.stdout;
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'bancada@local');
  git('config', 'user.name', 'bancada');
  git('config', 'core.autocrlf', 'false');
  return { dir, git, limpar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const DEFEITO_ANTIGO = 'export function calc(a: number) {\n  if (a == NaN) { return 1; }\n  return a;\n}\n';
// O defeito antigo MUDA DE LUGAR (reindentado, dentro de um bloco novo) e ganha comentário;
// só o `debugger` é desta edição.
const DEFEITO_NOVO = 'export function calc(a: number) {\n  {\n      if (a == NaN) { return 1; } // ainda o mesmo\n  }\n  debugger;\n  return a;\n}\n';

test('lint-bug: arquivo com dívida antiga + defeito novo -> reporta SÓ o novo (chave com escopo, não linha crua)', (t) => {
  if (!binLocal('oxlint')) return pular(t, 'oxlint ausente em node_modules/.bin (npm install)');
  const repo = repoTemporario();
  try {
    const arq = path.join(repo.dir, 'x.ts');
    fs.writeFileSync(arq, DEFEITO_ANTIGO);
    repo.git('add', 'x.ts');
    repo.git('commit', '-q', '-m', 'divida antiga');
    fs.writeFileSync(arq, DEFEITO_NOVO);
    const r = rodarHook('lint-bug.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: arq } });
    assert.equal(r.rc, 0, 'lint-bug avisa, não bloqueia');
    const ctx = r.json?.hookSpecificOutput?.additionalContext || '';
    assert.match(ctx, /no-debugger/, `esperava o defeito novo; veio: ${r.stdout}`);
    assert.doesNotMatch(ctx, /use-isnan/, 'o defeito antigo (que só mudou de lugar) não pode aparecer');
    assert.match(ctx, /o HEAD tinha 1/);
    assert.match(r.json.systemMessage, /1 achado\(s\) novo\(s\)/);
  } finally {
    repo.limpar();
  }
});

test('lint-bug: arquivo novo (sem HEAD) -> tudo é da edição; arquivo limpo -> silêncio', (t) => {
  if (!binLocal('oxlint')) return pular(t, 'oxlint ausente em node_modules/.bin (npm install)');
  const repo = repoTemporario();
  try {
    const arq = path.join(repo.dir, 'novo.ts');
    fs.writeFileSync(arq, DEFEITO_ANTIGO);
    const r = rodarHook('lint-bug.mjs', { tool_input: { file_path: arq } });
    assert.match(r.json?.hookSpecificOutput?.additionalContext || '', /arquivo novo.*\n.*use-isnan/);
    fs.writeFileSync(arq, 'export const ok = 1;\n');
    assert.equal(rodarHook('lint-bug.mjs', { tool_input: { file_path: arq } }).json, null);
  } finally {
    repo.limpar();
  }
});

test('lint-bug --arquivo: rc 1 com achado, rc 0 limpo', (t) => {
  if (!binLocal('oxlint')) return pular(t, 'oxlint ausente em node_modules/.bin (npm install)');
  const repo = repoTemporario();
  try {
    const arq = path.join(repo.dir, 'p.ts');
    fs.writeFileSync(arq, DEFEITO_ANTIGO);
    const r = rodarHook('lint-bug.mjs', '', { args: ['--arquivo', arq] });
    assert.equal(r.rc, 1);
    assert.match(r.stdout, /use-isnan/);
    fs.writeFileSync(arq, 'export const ok = 1;\n');
    assert.equal(rodarHook('lint-bug.mjs', '', { args: ['--arquivo', arq] }).rc, 0);
  } finally {
    repo.limpar();
  }
});

// ---------------------------------------------------------------- typecheck.mjs

test('typecheck: nome indefinido no arquivo editado bloqueia (exit 2) e nomeia o TS2304; erro de tipo só avisa', (t) => {
  if (!binLocal('tsc')) return pular(t, 'tsc ausente em node_modules/.bin (npm install)');
  const dir = path.join(RAIZ, 'api', 'src', '__bancada__');
  const arq = path.join(dir, 'x.ts');
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(arq, 'export const ok = 1;\n');
    assert.equal(rodarHook('typecheck.mjs', { tool_input: { file_path: arq } }).rc, 0, 'arquivo limpo (e semeia a linha de base se for a primeira execução)');

    fs.writeFileSync(arq, 'export const v = funcaoQueNaoExiste(1);\n');
    const r = rodarHook('typecheck.mjs', { tool_input: { file_path: arq } });
    assert.equal(r.rc, 2, `esperava bloqueio; stdout=${r.stdout} stderr=${r.stderr}`);
    assert.match(r.stderr, /BLOQUEADO/);
    assert.match(r.stderr, /__bancada__\/x\.ts:1 TS2304 Cannot find name 'funcaoQueNaoExiste'/);

    fs.writeFileSync(arq, "export const n: number = 'texto';\n");
    const r2 = rodarHook('typecheck.mjs', { tool_input: { file_path: arq } });
    assert.equal(r2.rc, 0, 'erro de tipo comum avisa, não bloqueia');
    assert.match(r2.json?.hookSpecificOutput?.additionalContext || '', /TS2322/);
    assert.match(r2.json.systemMessage, /1 erro\(s\) de tipo novo\(s\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('typecheck: arquivo fora do include do tsconfig não é verde, é "sem checagem" (rc 2 na segunda porta)', (t) => {
  if (!binLocal('tsc')) return pular(t, 'tsc ausente em node_modules/.bin (npm install)');
  const arq = path.join(RAIZ, 'api', '__fora__.ts');
  fs.writeFileSync(arq, 'export const v = funcaoQueNaoExiste(1);\n');
  try {
    const r = rodarHook('typecheck.mjs', '', { args: ['--arquivo', arq] });
    assert.equal(r.rc, 2);
    assert.match(r.stdout, /fora do include/);
    const h = rodarHook('typecheck.mjs', { tool_input: { file_path: arq } });
    assert.equal(h.rc, 0);
    assert.match(h.json?.systemMessage || '', /sem typecheck/);
  } finally {
    fs.rmSync(arq, { force: true });
  }
});

// ---------------------------------------------------------------- padroes-proibidos.mjs

test('padroes-proibidos: controller sem @Roles e process.env novos bloqueiam com o caminho certo', () => {
  const dir = path.join(RAIZ, 'api', 'src', 'modules', '__bancada__');
  fs.mkdirSync(dir, { recursive: true });
  try {
    const ctrl = path.join(dir, 'coisa.controller.ts');
    fs.writeFileSync(ctrl, "import { Controller, Get } from '@nestjs/common';\n@Controller('coisa')\nexport class CoisaController { @Get() f() { return 1; } }\n");
    const r = rodarHook('padroes-proibidos.mjs', { tool_input: { file_path: ctrl } });
    assert.equal(r.rc, 2);
    assert.match(r.stderr, /controller-sem-roles/);
    assert.match(r.stderr, /RolesGuard libera rota sem @Roles/);
    assert.match(r.stderr, /pagamentos\.controller\.ts/, 'a mensagem aponta o exemplo a copiar');

    fs.writeFileSync(ctrl, "import { Controller } from '@nestjs/common';\n@Controller('coisa')\n@Roles(Role.ADMIN)\nexport class CoisaController {}\n");
    assert.equal(rodarHook('padroes-proibidos.mjs', { tool_input: { file_path: ctrl } }).rc, 0);

    const svc = path.join(dir, 'coisa.service.ts');
    fs.writeFileSync(svc, "// process.env em comentário não conta\nconst porta = process.env.PORT;\nconst total = parseFloat(dto.valor);\nexport { porta, total };\n");
    const r2 = rodarHook('padroes-proibidos.mjs', { tool_input: { file_path: svc } });
    assert.equal(r2.rc, 2);
    assert.match(r2.stderr, /coisa\.service\.ts:2 \[process-env\].*env\.validation\.ts/);
    assert.match(r2.stderr, /coisa\.service\.ts:3 \[dinheiro-float\].*Prisma\.Decimal/);
    assert.doesNotMatch(r2.stderr, /:1 \[process-env\]/, 'linha só de comentário não é ocorrência');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('padroes-proibidos: env.validation.ts é a exceção; arquivos reais do repositório passam limpos', () => {
  for (const rel of ['api/src/config/env.validation.ts', 'api/src/modules/pagamentos/pagamentos.controller.ts', 'api/src/modules/auth/auth.controller.ts']) {
    const r = rodarHook('padroes-proibidos.mjs', '', { args: ['--arquivo', path.join(RAIZ, rel)] });
    assert.equal(r.rc, 0, `${rel}: ${r.stdout}`);
  }
});

// ---------------------------------------------------------------- db-guard.mjs

const guard = (command) => rodarHook('db-guard.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });

test('db-guard: uma variante real de cada família é negada com o caminho certo', () => {
  const casos = [
    ['npx prisma migrate reset --force', 'banco-descartado', /pg_dump/],
    ['cd api && npx prisma db push --accept-data-loss', 'banco-descartado', /backup/],
    ['docker compose down -v', 'banco-descartado', /pgdata/],
    ['docker volume rm piloto_pgdata', 'banco-descartado', /PILOTO_DB_OVERRIDE=1/],
    ['DATABASE_URL=postgresql://gym:senha@db.prod.exemplo.com:5432/gymdb npx prisma migrate deploy', 'producao', /db\.prod\.exemplo\.com/],
    ['psql -h 10.0.0.7 -U gym gymdb -c "select 1"', 'producao', /Não existe produção/],
    ['psql postgresql://gym:gym@localhost:5432/gymdb -c \'UPDATE "Pagamento" SET status=\'ESTORNADO\' WHERE id=\'x\'\'', 'decisao-do-dono', /pagamentos\/:id\/pagar/],
    ['psql -U gym gymdb -c \'DELETE FROM "Aluno" WHERE cpf=\'123\'\'', 'decisao-do-dono', /decisão dele/],
    ['docker compose exec postgres psql -U gym gymdb -c "TRUNCATE \\"CheckIn\\""', 'decisao-do-dono', /OK explícito do dono/],
    ['npx prisma db execute --stdin <<SQL\nupdate plano set valor = 199.90;\nSQL', 'decisao-do-dono', /preço\/valor/],
    ["node -e \"const {PrismaClient}=require('@prisma/client');new PrismaClient().usuario.update({where:{email:'x'},data:{role:'ADMIN'}})\"", 'decisao-do-dono', /papel\/admin/],
    // brechas achadas pelo review externo (lens-harness-1), uma por achado:
    ['docker compose -f docker-compose.yml down -v', 'banco-descartado', /pgdata/],
    ['docker-compose --profile x down --volumes', 'banco-descartado', /pgdata/],
    ['docker system prune --volumes', 'banco-descartado', /pgdata/],
    ['dropdb -h db.exemplo.com gymdb', 'producao', /db\.exemplo\.com/],
    ['PGHOST=db.exemplo.com psql -U gym gymdb -c "select 1"', 'producao', /db\.exemplo\.com/],
    ['psql "host=db.exemplo.com dbname=gymdb" -c "select 1"', 'producao', /Não existe produção/],
    ['psql -c \'DELETE FROM ONLY "Aluno"\'', 'decisao-do-dono', /decisão dele/],
    ['psql -c \'DELETE FROM public."Aluno"\'', 'decisao-do-dono', /decisão dele/],
    ['psql -c "UPDATE public.planos AS p SET valor=0"', 'decisao-do-dono', /preço\/valor/],
    ['psql -c \'INSERT INTO "Plano" (nome) VALUES (\'x\')\'', 'decisao-do-dono', /decisão dele/],
    ['pg_restore --clean -d gymdb dump.dump', 'banco-descartado', /pgdata/],
    ['psql -f migration.sql', 'script-invisivel', /não está na linha/],
    ['psql gymdb < dump.sql', 'script-invisivel', /migration versionada/],
    ['npx prisma db execute --file script.sql --schema prisma/schema.prisma', 'script-invisivel', /não está na linha/],
    ['node seed-admin.js', 'script-invisivel', /não está na linha/],
    ['npx tsx fix-pagamentos.ts', 'script-invisivel', /não está na linha/],
    // bypass por substring não conta: '=1x' e '_PREFIX=1' não são o token exato
    ['PILOTO_DB_OVERRIDE=1x docker compose down -v', 'banco-descartado', /pgdata/],
    ['PILOTO_DB_OVERRIDE_PREFIX=1 docker compose down -v', 'banco-descartado', /pgdata/],
  ];
  for (const [cmd, familia, trecho] of casos) {
    const r = guard(cmd);
    assert.equal(r.rc, 2, `deveria negar: ${cmd}\nstderr=${r.stderr}`);
    assert.match(r.stderr, new RegExp(`BLOQUEADO \\[${familia}\\]`), `família errada para: ${cmd}\n${r.stderr}`);
    assert.match(r.stderr, trecho, `mensagem sem o caminho certo para: ${cmd}\n${r.stderr}`);
  }
});

test('db-guard: bypass consciente passa; comandos legítimos e leituras não são tocados', () => {
  const passam = [
    'PILOTO_DB_OVERRIDE=1 docker compose down -v',
    'PILOTO_DB_OVERRIDE=1 npx prisma migrate reset --force',
    'npm run db:migrate',
    'cd api && npx prisma migrate dev --name add_campo',
    'npx prisma migrate deploy',
    'docker compose down',
    'docker compose up -d',
    'npm run db:seed',
    'grep -rn "DELETE FROM" api/prisma/migrations',
    'cat api/prisma/migrations/20260920220637_init/migration.sql | grep TRUNCATE',
    'git log -S "UPDATE \\"Pagamento\\" SET"',
    'psql postgresql://gym:gym@localhost:5432/gymdb -c \'SELECT count(*) FROM "Pagamento"\'',
    'psql -h 127.0.0.1 -U gym gymdb -c \'UPDATE "RefreshToken" SET "revogadoEm"=now()\'',
    'curl -X PATCH http://localhost:3000/api/pagamentos/abc/pagar -H "Authorization: Bearer t" -d \'{"metodo":"PIX"}\'',
    'node --test .claude/hooks/test_hooks.mjs',
    'node dist/main.js',
    'node lint-report.js',
    'npx tsx prisma/seed.ts',
    'psql gymdb -c "select 1"',
  ];
  for (const cmd of passam) {
    const r = guard(cmd);
    assert.equal(r.rc, 0, `não deveria negar: ${cmd}\nstderr=${r.stderr}`);
    assert.equal(r.stderr, '', `não deveria escrever nada: ${cmd}`);
  }
});

test('db-guard: modo --comando (segunda porta) dá o mesmo veredito', () => {
  const r = rodarHook('db-guard.mjs', '', { args: ['--comando', 'docker', 'compose', 'down', '--volumes'] });
  assert.equal(r.rc, 2);
  assert.match(r.stderr, /\[banco-descartado\]/);
});

export { rodarHook, sessaoNova, limparSessao, pular, binLocal };
