import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto, UpdateUsuarioDto } from './dto/usuario.dto';

const usuarioSelect = {
  id: true,
  nome: true,
  email: true,
  role: true,
  ativo: true,
  unidadeId: true,
  criadoEm: true,
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.usuario.findMany({
      select: usuarioSelect,
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: usuarioSelect,
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    return usuario;
  }

  async create(dto: CreateUsuarioDto) {
    if (dto.unidadeId) {
      const unidade = await this.prisma.unidade.findUnique({
        where: { id: dto.unidadeId },
      });
      if (!unidade || !unidade.ativo) {
        throw new NotFoundException('Unidade não encontrada ou inativa');
      }
    }

    const exists = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const { senha, ...rest } = dto;
    const senhaHash = await bcrypt.hash(senha, 12);
    try {
      return await this.prisma.usuario.create({
        data: { ...rest, senhaHash },
        select: usuarioSelect,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    await this.findOne(id);
    if (dto.unidadeId) {
      const unidade = await this.prisma.unidade.findUnique({
        where: { id: dto.unidadeId },
      });
      if (!unidade || !unidade.ativo) {
        throw new NotFoundException('Unidade não encontrada ou inativa');
      }
    }
    const { senha, ...rest } = dto;
    // null em campos obrigatórios é ignorado; unidadeId: null desvincula a unidade
    const data: Prisma.UsuarioUpdateInput = {
      ...rest,
      nome: rest.nome ?? undefined,
      role: rest.role ?? undefined,
      ativo: rest.ativo ?? undefined,
    };
    if (senha) {
      data.senhaHash = await bcrypt.hash(senha, 12);
    }
    return this.prisma.usuario.update({
      where: { id },
      data,
      select: usuarioSelect,
    });
  }
}
