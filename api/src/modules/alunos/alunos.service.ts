import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/guards/jwt-auth.guard';
import {
  CreateAlunoDto,
  QueryAlunosDto,
  UpdateAlunoDto,
} from './dto/aluno.dto';

@Injectable()
export class AlunosService {
  constructor(private prisma: PrismaService) {}

  findAll(query: QueryAlunosDto, user: AuthUser) {
    const unidadeId = user.unidadeId ?? query.unidadeId;
    const where: Prisma.AlunoWhereInput = {
      ...(unidadeId ? { unidadeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.busca
        ? {
            OR: [
              { nome: { contains: query.busca, mode: 'insensitive' } },
              { cpf: { contains: query.busca } },
              { email: { contains: query.busca, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.aluno.findMany({
      where,
      include: { unidade: { select: { id: true, nome: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id },
      include: {
        unidade: true,
        matriculas: {
          include: { plano: true },
          orderBy: { criadoEm: 'desc' },
        },
      },
    });
    // Recepção só acessa alunos da própria unidade
    if (!aluno || (user.unidadeId && aluno.unidadeId !== user.unidadeId)) {
      throw new NotFoundException('Aluno não encontrado');
    }
    return aluno;
  }

  async create(dto: CreateAlunoDto, user: AuthUser) {
    // Recepção só cadastra alunos na própria unidade
    if (user.unidadeId && dto.unidadeId !== user.unidadeId) {
      throw new ForbiddenException('Sem permissão para esta unidade');
    }

    const unidade = await this.prisma.unidade.findUnique({
      where: { id: dto.unidadeId },
    });
    if (!unidade || !unidade.ativo) {
      throw new NotFoundException('Unidade não encontrada ou inativa');
    }

    const exists = await this.prisma.aluno.findUnique({
      where: { cpf: dto.cpf },
    });
    if (exists) throw new ConflictException('CPF já cadastrado');

    try {
      return await this.prisma.aluno.create({
        data: {
          ...dto,
          dataNascimento: dto.dataNascimento
            ? new Date(dto.dataNascimento)
            : undefined,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('CPF já cadastrado');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateAlunoDto, user: AuthUser) {
    await this.findOne(id, user);
    // Recepção não pode transferir o aluno para outra unidade
    if (
      user.unidadeId &&
      dto.unidadeId &&
      dto.unidadeId !== user.unidadeId
    ) {
      throw new ForbiddenException('Sem permissão para esta unidade');
    }
    if (dto.unidadeId) {
      const unidade = await this.prisma.unidade.findUnique({
        where: { id: dto.unidadeId },
      });
      if (!unidade || !unidade.ativo) {
        throw new NotFoundException('Unidade não encontrada ou inativa');
      }
    }
    return this.prisma.aluno.update({
      where: { id },
      data: {
        ...dto,
        // null explícito em campos obrigatórios é ignorado (evita erro 500)
        nome: dto.nome ?? undefined,
        status: dto.status ?? undefined,
        unidadeId: dto.unidadeId ?? undefined,
        dataNascimento: dto.dataNascimento
          ? new Date(dto.dataNascimento)
          : undefined,
      },
    });
  }
}
