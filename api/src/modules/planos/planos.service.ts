import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusMatricula } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanoDto, UpdatePlanoDto } from './dto/plano.dto';

@Injectable()
export class PlanosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.plano.findMany({ orderBy: { nome: 'asc' } });
  }

  async findOne(id: string) {
    const plano = await this.prisma.plano.findUnique({ where: { id } });
    if (!plano) throw new NotFoundException('Plano não encontrado');
    return plano;
  }

  create(dto: CreatePlanoDto) {
    // null explícito cairia em coluna NOT NULL → erro 500; undefined usa o default
    return this.prisma.plano.create({
      data: {
        ...dto,
        recorrente: dto.recorrente ?? undefined,
        multiUnidade: dto.multiUnidade ?? undefined,
      },
    });
  }

  async update(id: string, dto: UpdatePlanoDto) {
    const plano = await this.findOne(id);
    // Recorrência e período mudam a semântica das matrículas existentes:
    // dataFim vs proximaRenovacao, e a aritmética de renovação usada em
    // marcarPago — ambos proibidos enquanto houver matrícula ativa
    const mudaRecorrencia =
      dto.recorrente != null && dto.recorrente !== plano.recorrente;
    const mudaPeriodoEmRecorrente =
      plano.recorrente &&
      dto.periodo != null &&
      dto.periodo !== plano.periodo;
    return this.prisma.$transaction(async (tx) => {
      // Serializa com matriculas.create: uma matrícula nascendo na janela
      // entre a checagem e o update não escapa da guarda
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      if (mudaRecorrencia || mudaPeriodoEmRecorrente) {
        const ativas = await tx.matricula.count({
          where: { planoId: id, status: StatusMatricula.ATIVA },
        });
        if (ativas > 0) {
          throw new BadRequestException(
            'Plano possui matrículas ativas; recorrência e período não podem ser alterados',
          );
        }
      }
      return tx.plano.update({
        where: { id },
        // null explícito em campos obrigatórios é ignorado (evita erro 500)
        data: {
          ...dto,
          nome: dto.nome ?? undefined,
          valor: dto.valor ?? undefined,
          periodo: dto.periodo ?? undefined,
          recorrente: dto.recorrente ?? undefined,
          multiUnidade: dto.multiUnidade ?? undefined,
          ativo: dto.ativo ?? undefined,
        },
      });
    });
  }
}
