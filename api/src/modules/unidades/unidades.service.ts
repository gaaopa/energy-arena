import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUnidadeDto, UpdateUnidadeDto } from './dto/unidade.dto';

@Injectable()
export class UnidadesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.unidade.findMany({
      orderBy: { nome: 'asc' },
      include: { _count: { select: { alunos: true } } },
    });
  }

  async findOne(id: string) {
    const unidade = await this.prisma.unidade.findUnique({ where: { id } });
    if (!unidade) throw new NotFoundException('Unidade não encontrada');
    return unidade;
  }

  create(dto: CreateUnidadeDto) {
    return this.prisma.unidade.create({ data: dto });
  }

  async update(id: string, dto: UpdateUnidadeDto) {
    await this.findOne(id);
    return this.prisma.unidade.update({
      where: { id },
      // null explícito em campos obrigatórios é ignorado (evita erro 500)
      data: { ...dto, nome: dto.nome ?? undefined, ativo: dto.ativo ?? undefined },
    });
  }
}
