// Garante o banco de teste gymdb_test: cria se ausente e aplica as migrations.
// Idempotente — roda a cada `npm test`. Nunca toca o gymdb dev.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const linha = readFileSync(join(apiDir, '.env'), 'utf8').match(/^DATABASE_URL=(.+)$/m);
if (!linha) {
  console.error('DATABASE_URL não encontrada em api/.env');
  process.exit(1);
}
const urlOriginal = linha[1].trim().replace(/\r$/, '').replace(/^["']|["']$/g, '');
const url = new URL(urlOriginal);
// hostname de IPv6 vem com colchetes ("[::1]") — normaliza antes da allowlist
const host = url.hostname.replace(/^\[|\]$/g, '');
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(`recusado: host ${url.hostname} não é local`);
  process.exit(1);
}
url.pathname = '/gymdb_test';
const testUrl = url.toString();

const prisma = new PrismaClient({ datasources: { db: { url: urlOriginal } } });
try {
  const existe = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM pg_database WHERE datname = 'gymdb_test'`,
  );
  if (existe.length === 0) {
    try {
      await prisma.$executeRawUnsafe('CREATE DATABASE gymdb_test');
      console.log('gymdb_test criado');
    } catch (e) {
      // corrida com outro `npm test`: segue se o banco agora existe
      const deNovo = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM pg_database WHERE datname = 'gymdb_test'`,
      );
      if (deNovo.length === 0) throw e;
    }
  }
} finally {
  await prisma.$disconnect();
}

// cwd na raiz do repo (sem api/.env à vista) + --schema explícito: o CLI não
// tem como confundir o .env dev com o DATABASE_URL de teste
const r = spawnSync(
  'npx',
  ['prisma', 'migrate', 'deploy', '--schema', join(apiDir, 'prisma', 'schema.prisma')],
  {
    cwd: dirname(apiDir),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
    shell: true,
  },
);
process.exit(r.status ?? 1);
