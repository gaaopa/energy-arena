import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusAluno, StatusMatricula } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/guards/jwt-auth.guard';
import { CreateCheckInDto, QueryCheckInsDto } from './dto/checkin.dto';

const checkInInclude = {
  aluno: { select: { id: true, nome: true } },
  unidade: { select: { id: true, nome: true } },
} satisfies Prisma.CheckInInclude;

// Janela de deduplicação contra duplo clique / reescaneio do QR
const CHECKIN_DEDUPE_MS = 5 * 60 * 1000;

@Injectable()
export class CheckInsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCheckInDto, user: AuthUser) {
    // Recepção registra check-in apenas na própria unidade
    if (user.unidadeId && dto.unidadeId !== user.unidadeId) {
      throw new ForbiddenException('Sem permissão para esta unidade');
    }

    const unidade = await this.prisma.unidade.findUnique({
      where: { id: dto.unidadeId },
    });
    if (!unidade || !unidade.ativo) {
      throw new NotFoundException('Unidade não encontrada ou inativa');
    }

    const aluno = await this.prisma.aluno.findUnique({
      where: { id: dto.alunoId },
      include: {
        matriculas: {
          where: { status: StatusMatricula.ATIVA },
          orderBy: { criadoEm: 'desc' },
          include: { plano: true },
          take: 1,
        },
      },
    });
    if (!aluno) throw new NotFoundException('Aluno não encontrado');
    if (aluno.status !== StatusAluno.ATIVO) {
      throw new ForbiddenException('Aluno não está ativo');
    }

    const agora = new Date();
    const matricula = aluno.matriculas[0];
    if (
      !matricula ||
      matricula.dataInicio > agora ||
      (matricula.dataFim !== null && matricula.dataFim < agora)
    ) {
      throw new ForbiddenException('Aluno sem matrícula ativa');
    }
    // Plano recorrente: proximaRenovacao = vencimento da cobrança mais
    // recente; se passou, o ciclo está em aberto (inadimplente)
    if (
      matricula.proximaRenovacao !== null &&
      matricula.proximaRenovacao < agora
    ) {
      throw new ForbiddenException('Matrícula com cobrança em aberto');
    }

    // Plano não multi-unidade só permite check-in na unidade da matrícula
    if (
      !matricula.plano.multiUnidade &&
      matricula.unidadeId !== dto.unidadeId
    ) {
      throw new ForbiddenException(
        'Plano do aluno não permite acesso a esta unidade',
      );
    }

    // Idempotência: retorna check-in recente em vez de criar duplicado
    const checkInRecente = await this.prisma.checkIn.findFirst({
      where: {
        alunoId: dto.alunoId,
        unidadeId: dto.unidadeId,
        criadoEm: { gte: new Date(agora.getTime() - CHECKIN_DEDUPE_MS) },
      },
      orderBy: { criadoEm: 'desc' },
      include: checkInInclude,
    });
    if (checkInRecente) return checkInRecente;

    return this.prisma.checkIn.create({
      data: {
        alunoId: dto.alunoId,
        unidadeId: dto.unidadeId,
        metodo: dto.metodo ?? undefined,
      },
      include: checkInInclude,
    });
  }

  findAll(query: QueryCheckInsDto, user: AuthUser) {
    const unidadeId = user.unidadeId ?? query.unidadeId;
    const where: Prisma.CheckInWhereInput = {
      ...(query.alunoId ? { alunoId: query.alunoId } : {}),
      ...(unidadeId ? { unidadeId } : {}),
      ...(query.de || query.ate
        ? {
            criadoEm: {
              ...(query.de ? { gte: new Date(query.de) } : {}),
              ...(query.ate ? { lte: new Date(query.ate) } : {}),
            },
          }
        : {}),
    };
    return this.prisma.checkIn.findMany({
      where,
      include: {
        aluno: { select: { id: true, nome: true } },
        unidade: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
  }

  async registrarSaida(id: string, user: AuthUser) {
    const checkIn = await this.prisma.checkIn.findUnique({ where: { id } });
    // Recepção só registra saída de check-ins da própria unidade
    if (
      !checkIn ||
      (user.unidadeId && checkIn.unidadeId !== user.unidadeId)
    ) {
      throw new NotFoundException('Check-in não encontrado');
    }
    const agora = new Date();
    // Garante saída posterior à entrada (relógios/tolerância)
    const saiuEm =
      agora.getTime() > checkIn.criadoEm.getTime()
        ? agora
        : new Date(checkIn.criadoEm.getTime() + 60_000);
    try {
      // WHERE saiuEm:null torna a saída única mesmo sob PATCHs concorrentes
      return await this.prisma.checkIn.update({
        where: { id, saiuEm: null },
        data: { saiuEm },
        include: checkInInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new BadRequestException('Saída já registrada');
      }
      throw e;
    }
  }

  async relatorio(user: AuthUser) {
    const where: Prisma.CheckInWhereInput = user.unidadeId
      ? { unidadeId: user.unidadeId }
      : {};
    const checkIns = await this.prisma.checkIn.findMany({
      where,
      select: {
        alunoId: true,
        criadoEm: true,
        saiuEm: true,
        aluno: { select: { nome: true } },
        unidade: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'asc' },
    });

    const agora = new Date();
    const mesAtual = { mes: agora.getMonth(), ano: agora.getFullYear() };
    const noMesAtual = (d: Date) =>
      d.getMonth() === mesAtual.mes && d.getFullYear() === mesAtual.ano;
    const mesesDesde = (d: Date) =>
      Math.max(
        1,
        (agora.getFullYear() - d.getFullYear()) * 12 +
          (agora.getMonth() - d.getMonth()) +
          1,
      );

    type Acc = {
      alunoId: string;
      nome: string;
      totalAcessos: number;
      acessosMesAtual: number;
      somaPermanenciaMin: number;
      qtdComSaida: number;
      primeiroAcesso: Date;
      ultimoAcesso: Date;
    };
    const novoAcc = (alunoId: string, nome: string, d: Date): Acc => ({
      alunoId,
      nome,
      totalAcessos: 0,
      acessosMesAtual: 0,
      somaPermanenciaMin: 0,
      qtdComSaida: 0,
      primeiroAcesso: d,
      ultimoAcesso: d,
    });
    // Acumuladores por unidade e globais — aluno multi-unidade aparece em
    // cada unidade com os acessos dela, e uma vez no geral.
    const porUnidade = new Map<
      string,
      { nome: string; alunos: Map<string, Acc>; somaPerm: number; qtdSaida: number }
    >();
    const globalMap = new Map<string, Acc>();
    let somaPermGeral = 0;
    let qtdSaidaGeral = 0;

    for (const c of checkIns) {
      let u = porUnidade.get(c.unidade.id);
      if (!u) {
        u = {
          nome: c.unidade.nome,
          alunos: new Map(),
          somaPerm: 0,
          qtdSaida: 0,
        };
        porUnidade.set(c.unidade.id, u);
      }
      const acc = u.alunos.get(c.alunoId) ?? novoAcc(c.alunoId, c.aluno.nome, c.criadoEm);
      u.alunos.set(c.alunoId, acc);
      const gacc =
        globalMap.get(c.alunoId) ?? novoAcc(c.alunoId, c.aluno.nome, c.criadoEm);
      globalMap.set(c.alunoId, gacc);

      for (const a of [acc, gacc]) {
        a.totalAcessos += 1;
        if (noMesAtual(c.criadoEm)) a.acessosMesAtual += 1;
        if (c.criadoEm < a.primeiroAcesso) a.primeiroAcesso = c.criadoEm;
        if (c.criadoEm > a.ultimoAcesso) a.ultimoAcesso = c.criadoEm;
        if (c.saiuEm) {
          a.somaPermanenciaMin += Math.max(
            0,
            Math.round((c.saiuEm.getTime() - c.criadoEm.getTime()) / 60_000),
          );
          a.qtdComSaida += 1;
        }
      }
      if (c.saiuEm) {
        const min = Math.max(
          0,
          Math.round((c.saiuEm.getTime() - c.criadoEm.getTime()) / 60_000),
        );
        u.somaPerm += min;
        u.qtdSaida += 1;
        somaPermGeral += min;
        qtdSaidaGeral += 1;
      }
    }

    const toRow = (a: Acc) => {
      const meses = mesesDesde(a.primeiroAcesso);
      return {
        alunoId: a.alunoId,
        nome: a.nome,
        totalAcessos: a.totalAcessos,
        acessosMesAtual: a.acessosMesAtual,
        mediaAcessosMes: Math.round((a.totalAcessos / meses) * 10) / 10,
        permanenciaMediaMin: a.qtdComSaida
          ? Math.round(a.somaPermanenciaMin / a.qtdComSaida)
          : null,
        primeiroAcesso: a.primeiroAcesso,
        ultimoAcesso: a.ultimoAcesso,
        diasVinculo: Math.max(
          0,
          Math.floor(
            (agora.getTime() - a.primeiroAcesso.getTime()) / 86_400_000,
          ),
        ),
      };
    };
    const toResumo = (
      alunos: ReturnType<typeof toRow>[],
      totalAcessos: number,
      somaPerm: number,
      qtdSaida: number,
    ) => ({
      alunosComAcesso: alunos.length,
      totalAcessos,
      acessosMesAtual: alunos.reduce((s, a) => s + a.acessosMesAtual, 0),
      mediaAcessosMesAluno: alunos.length
        ? Math.round(
            (alunos.reduce((s, a) => s + a.mediaAcessosMes, 0) /
              alunos.length) *
              10,
          ) / 10
        : 0,
      permanenciaMediaMin: qtdSaida ? Math.round(somaPerm / qtdSaida) : null,
    });

    const unidades = [...porUnidade.entries()]
      .map(([unidadeId, u]) => {
        const alunos = [...u.alunos.values()]
          .map(toRow)
          .sort((a, b) => b.acessosMesAtual - a.acessosMesAtual);
        return {
          unidadeId,
          nome: u.nome,
          resumo: toResumo(
            alunos,
            alunos.reduce((s, a) => s + a.totalAcessos, 0),
            u.somaPerm,
            u.qtdSaida,
          ),
          alunos,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));

    const geral = toResumo(
      [...globalMap.values()].map(toRow),
      checkIns.length,
      somaPermGeral,
      qtdSaidaGeral,
    );

    return { geral, unidades };
  }
}
