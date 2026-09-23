import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PeriodoPlano,
  Prisma,
  Role,
  StatusAluno,
  StatusMatricula,
  StatusPagamento,
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import type { AuthUser } from '../src/common/guards/jwt-auth.guard';
import type { CatracasService } from '../src/modules/catracas/catracas.service';

// Testes rodam contra gymdb_test, nunca contra o banco dev.
const apiDir = join(__dirname, '..');
const linha = readFileSync(join(apiDir, '.env'), 'utf8').match(
  /^DATABASE_URL=(.+)$/m,
);
if (!linha) throw new Error('DATABASE_URL ausente em api/.env');
const url = new URL(linha[1].trim().replace(/\r$/, '').replace(/^["']|["']$/g, ''));
// hostname de IPv6 vem com colchetes ("[::1]") — normaliza antes da allowlist
const host = url.hostname.replace(/^\[|\]$/g, '');
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error('testes só rodam contra banco local');
}
url.pathname = '/gymdb_test';

export const prisma = new PrismaService({
  datasources: { db: { url: url.toString() } },
});

export const admin: AuthUser = {
  id: randomUUID(),
  email: 'admin@test.local',
  role: Role.ADMIN,
  unidadeId: null,
};

export const recepcao = (unidadeId: string): AuthUser => ({
  id: randomUUID(),
  email: 'recepcao@test.local',
  role: Role.RECEPCAO,
  unidadeId,
});

// Espia syncAlunoSeguro sem bater em terminal real
export function catracasEspia() {
  const sincronizados: string[] = [];
  const catracas = {
    syncAlunoSeguro: (alunoId: string) => {
      sincronizados.push(alunoId);
    },
  } as unknown as CatracasService;
  return { catracas, sincronizados };
}

let seq = 0;
const sufixo = () => `${Date.now().toString(36)}-${seq++}`;

export const novaUnidade = () =>
  prisma.unidade.create({ data: { nome: `Unidade T ${sufixo()}` } });

export const novoPlano = (
  opts: {
    recorrente?: boolean;
    multiUnidade?: boolean;
    periodo?: PeriodoPlano;
  } = {},
) =>
  prisma.plano.create({
    data: {
      nome: `Plano T ${sufixo()}`,
      valor: new Prisma.Decimal('99.90'),
      periodo: opts.periodo ?? PeriodoPlano.MENSAL,
      recorrente: opts.recorrente ?? false,
      multiUnidade: opts.multiUnidade ?? false,
    },
  });

export const novoAluno = (
  unidadeId: string,
  opts: { consentimento?: Date; status?: StatusAluno } = {},
) =>
  prisma.aluno.create({
    data: {
      nome: `Aluno T ${sufixo()}`,
      cpf: `9${String(randomInt(0, 1e10)).padStart(10, '0')}`,
      unidadeId,
      status: opts.status ?? StatusAluno.ATIVO,
      consentimentoBiometriaEm: opts.consentimento ?? null,
    },
  });

// Fixture direto no banco: prepara estado que os services não permitem criar
// (matrícula ativa sem consentimento, datas no passado/futuro).
export const novaMatricula = (over: {
  alunoId: string;
  planoId: string;
  unidadeId: string;
  dataInicio?: Date;
  dataFim?: Date | null;
  proximaRenovacao?: Date | null;
  status?: StatusMatricula;
}) =>
  prisma.matricula.create({
    data: {
      alunoId: over.alunoId,
      planoId: over.planoId,
      unidadeId: over.unidadeId,
      dataInicio: over.dataInicio ?? diasAtras(30),
      dataFim: over.dataFim === undefined ? null : over.dataFim,
      proximaRenovacao: over.proximaRenovacao ?? null,
      valor: new Prisma.Decimal('99.90'),
      status: over.status ?? StatusMatricula.ATIVA,
    },
  });

export const novoPagamento = (
  matriculaId: string,
  opts: { vencimento?: Date; status?: StatusPagamento } = {},
) =>
  prisma.pagamento.create({
    data: {
      matriculaId,
      valor: new Prisma.Decimal('99.90'),
      vencimento: opts.vencimento ?? diasAtras(30),
      status: opts.status ?? StatusPagamento.PENDENTE,
    },
  });

export const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000);
export const diasAdiante = (n: number) => new Date(Date.now() + n * 86_400_000);
export const addMeses = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};
