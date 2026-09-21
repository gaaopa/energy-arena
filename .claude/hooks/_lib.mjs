// Biblioteca comum dos hooks. Contrato de saída (medido, não suposto):
//   PreToolUse/PostToolUse bloqueiam com stderr + exit 2; avisam com exit 0 + JSON.
//   Stop só devolve systemMessage (additionalContext no Stop reabre o turno).
//   Falha interna do hook sai 0, sempre (lei 1).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOOKS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(HOOKS_DIR, '..', '..');
export const STATE_DIR = path.join(HOOKS_DIR, '.state');
export const IS_WIN = process.platform === 'win32';

export function lerStdinJson() {
  try {
    const bruto = fs.readFileSync(0, 'utf8');
    return bruto.trim() ? JSON.parse(bruto) : {};
  } catch {
    return {};
  }
}

export function caminhoDaEdicao(dados) {
  const ti = dados.tool_input || {};
  return ti.file_path || ti.path || ti.filePath || '';
}

export function normalizar(p) {
  if (!p) return '';
  const abs = path.isAbsolute(p) ? p : path.resolve(RAIZ, p);
  const norm = path.normalize(abs).replace(/\\/g, '/');
  return IS_WIN ? norm.toLowerCase() : norm;
}

export function relativoARaiz(p) {
  return path.relative(RAIZ, path.resolve(RAIZ, p)).replace(/\\/g, '/');
}

export function dentroDe(arquivo, prefixo) {
  return normalizar(arquivo).startsWith(normalizar(path.join(RAIZ, prefixo)) + '/');
}

export function avisar(evento, texto, resumo) {
  process.stdout.write(
    JSON.stringify({
      systemMessage: resumo,
      hookSpecificOutput: { hookEventName: evento, additionalContext: texto },
    }) + '\n',
  );
  return 0;
}

export function bloquear(texto) {
  process.stderr.write(texto.endsWith('\n') ? texto : texto + '\n');
  return 2;
}

export function rodar(cmd, args, opts = {}) {
  // Windows não executa .cmd sem shell; mas spawnSync(cmd, args, {shell:true})
  // concatena args sem escapar (DEP0190). Montamos a linha com quoting manual.
  const precisaShell = IS_WIN && /\.(cmd|bat)$/i.test(cmd);
  const r = precisaShell
    ? spawnSync(
        `"${cmd}" ${args.map((a) => `"${String(a).replace(/"/g, '\\"')}"`).join(' ')}`,
        { shell: true, cwd: opts.cwd || RAIZ, encoding: 'utf8', timeout: opts.timeout || 25_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } },
      )
    : spawnSync(cmd, args, {
        cwd: opts.cwd || RAIZ,
        encoding: 'utf8',
        timeout: opts.timeout || 25_000,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      });
  return { rc: r.status, stdout: r.stdout || '', stderr: r.stderr || '', erro: r.error };
}

export function binLocal(nome) {
  const p = path.join(RAIZ, 'node_modules', '.bin', IS_WIN ? `${nome}.cmd` : nome);
  return fs.existsSync(p) ? p : null;
}

export function raizGit(cwd) {
  const r = rodar('git', ['rev-parse', '--show-toplevel'], { cwd });
  return r.rc === 0 ? r.stdout.trim() : null;
}

// Versão do arquivo no HEAD, ou null se o arquivo é novo / não há HEAD / não há git.
export function conteudoNoHead(arquivo) {
  const dir = path.dirname(arquivo);
  const raiz = raizGit(dir);
  if (!raiz) return null;
  const rel = path.relative(raiz, arquivo).replace(/\\/g, '/');
  const r = rodar('git', ['show', `HEAD:${rel}`], { cwd: raiz });
  return r.rc === 0 ? r.stdout : null;
}

export function semComentario(linha) {
  return linha
    .replace(/\r$/, '')
    .replace(/\/\/.*$/, '')
    .replace(/\/\*.*?\*\//g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

const RE_ESCOPO =
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s+(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\(|function|\w+\s*=>)|(?:public|private|protected|static|async|readonly|get|set|\s)*(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{\s*$)/;

// Nome do escopo (função/classe/método) que contém a linha `idx` (0-based).
export function escopoDaLinha(linhas, idx) {
  for (let i = idx; i >= 0; i--) {
    const m = RE_ESCOPO.exec(linhas[i].replace(/\r$/, ''));
    if (m) {
      const nome = m[1] || m[2] || m[3] || m[4];
      if (nome && !/^(if|for|while|switch|catch|return|function)$/.test(nome)) return nome;
    }
  }
  return '<módulo>';
}

// Chave de comparação de um achado: (código, mensagem, linha sem comentário, escopo).
// Só (código, mensagem) perde o defeito que mudou de lugar; linha crua gera falso
// positivo a cada reindentação.
export function chaveAchado(a, linhas) {
  const idx = Math.max(0, (a.linha || 1) - 1);
  return [a.codigo, a.mensagem, semComentario(linhas[idx] || ''), escopoDaLinha(linhas, idx)].join('\u0001');
}

export function achadosNovos(atuais, linhasAtuais, anteriores, linhasAnteriores) {
  const vistos = new Map();
  for (const a of anteriores) {
    const k = chaveAchado(a, linhasAnteriores);
    vistos.set(k, (vistos.get(k) || 0) + 1);
  }
  const novos = [];
  for (const a of atuais) {
    const k = chaveAchado(a, linhasAtuais);
    const n = vistos.get(k) || 0;
    if (n > 0) vistos.set(k, n - 1);
    else novos.push(a);
  }
  return novos;
}

export function lerJson(p, padrao) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return padrao;
  }
}

// Lei "ler e transformar antes de escrever": grava em temporário e troca o inode.
export function gravarJson(p, valor) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(valor, null, 2));
  fs.renameSync(tmp, p);
}

export function tmpArquivoComExtensao(conteudo, extensao) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(require_os_tmpdir()), 'hook-'));
  const p = path.join(dir, `head${extensao}`);
  fs.writeFileSync(p, conteudo);
  return { caminho: p, limpar: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function require_os_tmpdir() {
  return process.env.TMPDIR || process.env.TEMP || process.env.TMP || '/tmp';
}

// true quando o módulo é o script invocado (e não importado pela bancada).
export function ehPrincipal(metaUrl) {
  if (!process.argv[1]) return false;
  return normalizar(fileURLToPath(metaUrl)) === normalizar(path.resolve(process.argv[1]));
}

// Executa `main` sob a lei 1: bug do hook nunca trava edição legítima.
// process.exitCode (não process.exit): exit() pode cortar write() ainda em
// buffer num pipe — e é justamente o texto que ensina o caminho certo.
export async function executar(main) {
  try {
    process.exitCode = (await main()) ?? 0;
  } catch (e) {
    if (process.env.HOOK_DEBUG) process.stderr.write(`[hook] erro interno: ${e?.stack || e}\n`);
    process.exitCode = 0;
  }
}
