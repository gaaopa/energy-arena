import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PeriodoPlano,
  Prisma,
  StatusAluno,
  StatusMatricula,
  StatusPagamento,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/guards/jwt-auth.guard';
import { CreateMatriculaDto, QueryMatriculasDto } from './dto/matricula.dto';

const PERIODO_MESES: Record<PeriodoPlano, number> = {
  MENSAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

@Injectable()
export class MatriculasService {
  constructor(private prisma: PrismaService) {}

  findAll(query: QueryMatriculasDto, user: AuthUser) {
    // Recepção vê apenas matrículas da própria unidade
    const unidadeId = user.unidadeId ?? query.unidadeId;
    const where: Prisma.MatriculaWhereInput = {
      ...(query.alunoId ? { alunoId: query.alunoId } : {}),
      ...(unidadeId ? { unidadeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    return this.prisma.matricula.findMany({
      where,
      include: {
        aluno: { select: { id: true, nome: true } },
        plano: { select: { id: true, nome: true, periodo: true } },
        unidade: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async create(dto: CreateMatriculaDto, user: AuthUser) {
    // Recepção só cria matrícula na própria unidade
    if (user.unidadeId && dto.unidadeId !== user.unidadeId) {
      throw new ForbiddenException('Sem permissão para esta unidade');
    }

    const [aluno, plano, unidade] = await Promise.all([
      this.prisma.aluno.findUnique({ where: { id: dto.alunoId } }),
      this.prisma.plano.findUnique({ where: { id: dto.planoId } }),
      this.prisma.unidade.findUnique({ where: { id: dto.unidadeId } }),
    ]);
    if (!aluno) throw new NotFoundException('Aluno não encontrado');
    if (aluno.status !== StatusAluno.ATIVO) {
      throw new BadRequestException('Aluno não está ativo');
    }
    if (!plano || !plano.ativo)
      throw new NotFoundException('Plano não encontrado ou inativo');
    if (!unidade || !unidade.ativo)
      throw new NotFoundException('Unidade não encontrada ou inativa');

    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dataInicio);
    dataFim.setMonth(dataFim.getMonth() + PERIODO_MESES[plano.periodo]);

    const valor = dto.valor ?? plano.valor;

    // Cria matrícula + primeira cobrança em transação
    return this.prisma.$transaction(async (tx) => {
      // Lock por aluno: serializa criações concorrentes e impede
      // duas matrículas ativas para o mesmo aluno
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.alunoId}))`;

      const matriculaAtiva = await tx.matricula.findFirst({
        where: { alunoId: dto.alunoId, status: StatusMatricula.ATIVA },
      });
      if (matriculaAtiva) {
        throw new BadRequestException('Aluno já possui matrícula ativa');
      }

      const matricula = await tx.matricula.create({
        data: {
          alunoId: dto.alunoId,
          planoId: dto.planoId,
          unidadeId: dto.unidadeId,
          dataInicio,
          dataFim,
          valor,
        },
        include: { aluno: true, plano: true, unidade: true },
      });

      await tx.pagamento.create({
        data: {
          matriculaId: matricula.id,
          valor,
          vencimento: dataInicio,
        },
      });

      return matricula;
    });
  }

  async cancelar(id: string, user: AuthUser) {
    const matricula = await this.prisma.matricula.findUnique({
      where: { id },
    });
    // Recepção só cancela matrículas da própria unidade
    if (
      !matricula ||
      (user.unidadeId && matricula.unidadeId !== user.unidadeId)
    ) {
      throw new NotFoundException('Matrícula não encontrada');
    }
    if (matricula.status !== StatusMatricula.ATIVA) {
      throw new BadRequestException('Matrícula não está ativa');
    }
    return this.prisma.$transaction(async (tx) => {
      let atualizada;
      try {
        atualizada = await tx.matricula.update({
          where: { id, status: StatusMatricula.ATIVA },
          data: { status: StatusMatricula.CANCELADA },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2025'
        ) {
          throw new BadRequestException('Matrícula não está ativa');
        }
        throw e;
      }
      // Cancela cobranças pendentes da matrícula cancelada
      await tx.pagamento.updateMany({
        where: { matriculaId: id, status: StatusPagamento.PENDENTE },
        data: { status: StatusPagamento.CANCELADO },
      });
      return atualizada;
    });
  }
}
