import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StatusAluno,
  StatusMatricula,
  StatusPagamento,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatracasService } from '../catracas/catracas.service';
import { AuthUser } from '../../common/guards/jwt-auth.guard';
import { PERIODO_MESES } from '../planos/periodo';
import {
  CreateMatriculaDto,
  QueryMatriculasDto,
  TrocarPlanoDto,
} from './dto/matricula.dto';

@Injectable()
export class MatriculasService {
  constructor(
    private prisma: PrismaService,
    private catracas: CatracasService,
  ) {}

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
        plano: {
          select: { id: true, nome: true, periodo: true, recorrente: true },
        },
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
    const fimCiclo = new Date(dataInicio);
    fimCiclo.setMonth(fimCiclo.getMonth() + PERIODO_MESES[plano.periodo]);
    // Plano recorrente: sem dataFim — a "data de fim" vira próxima renovação
    const dataFim = plano.recorrente ? null : fimCiclo;
    const proximaRenovacao = plano.recorrente ? fimCiclo : null;

    const valor = dto.valor ?? plano.valor;

    // Cria matrícula + primeira cobrança em transação
    let consentimentoRegistrado = false;
    const criada = await this.prisma.$transaction(async (tx) => {
      // Lock por aluno: serializa criações concorrentes e impede
      // duas matrículas ativas para o mesmo aluno
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.alunoId}))`;
      // Lock por plano: serializa com planos.update, que guarda recorrência/
      // período contra matrículas ativas
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.planoId}))`;

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
          proximaRenovacao,
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

      // Quem se matricula já consente a biometria facial por padrão
      // (decisão do dono, 2026-09-22) — grava a data só na primeira vez
      const consent = await tx.aluno.updateMany({
        where: { id: dto.alunoId, consentimentoBiometriaEm: null },
        data: { consentimentoBiometriaEm: new Date() },
      });
      consentimentoRegistrado = consent.count > 0;

      return matricula;
    });
    // Consentimento novo pode liberar a catraca facial — ressincroniza
    if (consentimentoRegistrado) this.catracas.syncAlunoSeguro(dto.alunoId);
    return criada;
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
      // Serializa com marcarPago(): sem o lock, uma cobrança PENDENTE
      // recorrente poderia nascer depois do updateMany e ficar órfã
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      let atualizada;
      try {
        atualizada = await tx.matricula.update({
          where: { id, status: StatusMatricula.ATIVA },
          data: { status: StatusMatricula.INATIVA },
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

  async trocarPlano(id: string, dto: TrocarPlanoDto, user: AuthUser) {
    const atual = await this.prisma.matricula.findUnique({
      where: { id },
      include: {
        aluno: { select: { status: true } },
        unidade: { select: { ativo: true } },
      },
    });
    // Recepção só troca plano de matrículas da própria unidade
    if (!atual || (user.unidadeId && atual.unidadeId !== user.unidadeId)) {
      throw new NotFoundException('Matrícula não encontrada');
    }
    if (atual.status !== StatusMatricula.ATIVA) {
      throw new BadRequestException('Matrícula não está ativa');
    }
    if (atual.planoId === dto.planoId) {
      throw new BadRequestException(
        'O plano informado é o mesmo da matrícula atual',
      );
    }
    if (atual.aluno.status !== StatusAluno.ATIVO) {
      throw new BadRequestException('Aluno não está ativo');
    }
    if (!atual.unidade.ativo) {
      throw new NotFoundException('Unidade não encontrada ou inativa');
    }
    const plano = await this.prisma.plano.findUnique({
      where: { id: dto.planoId },
    });
    if (!plano || !plano.ativo) {
      throw new NotFoundException('Plano não encontrado ou inativo');
    }

    // Sem dataInicio: "hoje" no fuso do negócio, normalizado para UTC-midnight
    // como new Date('YYYY-MM-DD') — data-pura, sem hora
    const dataInicio = dto.dataInicio
      ? new Date(dto.dataInicio)
      : new Date(
          new Date().toLocaleDateString('en-CA', {
            timeZone: 'America/Sao_Paulo',
          }),
        );

    let consentimentoRegistrado = false;
    const trocada = await this.prisma.$transaction(async (tx) => {
      // Mesma família de locks de create() e cancelar(): aluno → plano →
      // matrícula. Quem segurar primeiro define o estado que o outro vê.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${atual.alunoId}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.planoId}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;

      // Re-valida dentro do lock (a leitura pré-tx pode estar velha)
      const estado = await tx.matricula.findUnique({
        where: { id },
        select: {
          status: true,
          aluno: { select: { status: true } },
          unidade: { select: { ativo: true } },
        },
      });
      if (estado?.status !== StatusMatricula.ATIVA) {
        throw new BadRequestException('Matrícula não está ativa');
      }
      if (estado.aluno.status !== StatusAluno.ATIVO) {
        throw new BadRequestException('Aluno não está ativo');
      }
      if (!estado.unidade.ativo) {
        throw new NotFoundException('Unidade não encontrada ou inativa');
      }
      // recorrente/periodo/ativo podem ter mudado desde a leitura pré-tx:
      // planos.update serializa pelo mesmo lock que seguramos agora
      const planoTx = await tx.plano.findUnique({ where: { id: dto.planoId } });
      if (!planoTx || !planoTx.ativo) {
        throw new NotFoundException('Plano não encontrado ou inativo');
      }
      const fimCiclo = new Date(dataInicio);
      fimCiclo.setMonth(fimCiclo.getMonth() + PERIODO_MESES[planoTx.periodo]);
      const valor = dto.valor ?? planoTx.valor;

      try {
        await tx.matricula.update({
          where: { id, status: StatusMatricula.ATIVA },
          data: { status: StatusMatricula.INATIVA },
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
      await tx.pagamento.updateMany({
        where: { matriculaId: id, status: StatusPagamento.PENDENTE },
        data: { status: StatusPagamento.CANCELADO },
      });

      const nova = await tx.matricula.create({
        data: {
          alunoId: atual.alunoId,
          planoId: dto.planoId,
          unidadeId: atual.unidadeId,
          dataInicio,
          dataFim: planoTx.recorrente ? null : fimCiclo,
          proximaRenovacao: planoTx.recorrente ? fimCiclo : null,
          valor,
        },
        include: { aluno: true, plano: true, unidade: true },
      });
      await tx.pagamento.create({
        data: { matriculaId: nova.id, valor, vencimento: dataInicio },
      });
      // Mesmo consentimento por padrão de create() — a troca de plano
      // também é uma matrícula nova
      const consent = await tx.aluno.updateMany({
        where: {
          id: atual.alunoId,
          consentimentoBiometriaEm: null,
        },
        data: { consentimentoBiometriaEm: new Date() },
      });
      consentimentoRegistrado = consent.count > 0;
      return nova;
    });
    if (consentimentoRegistrado) {
      this.catracas.syncAlunoSeguro(atual.alunoId);
    }
    return trocada;
  }
}
