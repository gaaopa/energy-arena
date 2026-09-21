import {
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
      matricula.dataFim < agora
    ) {
      throw new ForbiddenException('Aluno sem matrícula ativa');
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
}
