import { Injectable, NotFoundException } from '@nestjs/common';
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
      data: { ...dto, multiUnidade: dto.multiUnidade ?? undefined },
    });
  }

  async update(id: string, dto: UpdatePlanoDto) {
    await this.findOne(id);
    return this.prisma.plano.update({
      where: { id },
      // null explícito em campos obrigatórios é ignorado (evita erro 500)
      data: {
        ...dto,
        nome: dto.nome ?? undefined,
        valor: dto.valor ?? undefined,
        periodo: dto.periodo ?? undefined,
        multiUnidade: dto.multiUnidade ?? undefined,
        ativo: dto.ativo ?? undefined,
      },
    });
  }
}
