import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatracasService } from '../catracas/catracas.service';
import { AuthUser } from '../../common/guards/jwt-auth.guard';
import {
  CreateAlunoDto,
  QueryAlunosDto,
  UpdateAlunoDto,
} from './dto/aluno.dto';

const FOTO_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export interface ArquivoUpload {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class AlunosService {
  private readonly fotoDir = join(process.cwd(), 'uploads', 'alunos');

  constructor(
    private prisma: PrismaService,
    private catracas: CatracasService,
  ) {}

  private conflitoAluno(e: unknown): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      const alvo = (e.meta?.target as string[] | undefined)?.join(',') ?? '';
      throw new ConflictException(
        alvo.includes('catracaId')
          ? 'ID de catraca já em uso'
          : 'CPF já cadastrado',
      );
    }
    throw e;
  }

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
      const aluno = await this.prisma.aluno.create({
        data: {
          ...dto,
          dataNascimento: dto.dataNascimento
            ? new Date(dto.dataNascimento)
            : undefined,
        },
      });
      this.catracas.syncAlunoSeguro(aluno.id);
      return aluno;
    } catch (e) {
      this.conflitoAluno(e);
    }
  }

  async update(id: string, dto: UpdateAlunoDto, user: AuthUser) {
    // findOne já aplica o escopo de unidade da recepção
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
    try {
      const aluno = await this.prisma.$transaction(async (tx) => {
        // Mesmo lock de matriculas.create/trocarPlano: uma suspensão ou
        // inativação serializa com a criação de matrícula — quem segurar
        // primeiro define o status que o outro enxerga
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        return tx.aluno.update({
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
      });
      this.catracas.syncAlunoSeguro(aluno.id);
      return aluno;
    } catch (e) {
      this.conflitoAluno(e);
    }
  }

  async uploadFoto(id: string, file: ArquivoUpload, user: AuthUser) {
    // findOne já aplica o escopo de unidade da recepção
    const aluno = await this.findOne(id, user);

    const ext = FOTO_MIME_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Formato inválido — use JPG, PNG ou WebP',
      );
    }

    const filename = `${aluno.id}${ext}`;
    await mkdir(this.fotoDir, { recursive: true });
    // Remove foto antiga se a extensão mudou
    if (aluno.foto && aluno.foto !== filename) {
      await rm(join(this.fotoDir, basename(aluno.foto)), {
        force: true,
      }).catch(() => {});
    }
    await writeFile(join(this.fotoDir, filename), file.buffer);

    const atualizado = await this.prisma.aluno.update({
      where: { id },
      data: { foto: filename },
    });
    // Reenvia a foto nova para a catraca gerar o template facial
    this.catracas.syncAlunoSeguro(id);
    return atualizado;
  }

  async fotoStream(id: string, user: AuthUser) {
    const aluno = await this.findOne(id, user);
    if (!aluno.foto) throw new NotFoundException('Aluno sem foto');

    // basename elimina qualquer componente de caminho (path traversal)
    const caminho = join(this.fotoDir, basename(aluno.foto));
    if (!existsSync(caminho)) {
      throw new NotFoundException('Foto não encontrada');
    }
    const mime =
      Object.entries(FOTO_MIME_EXT).find(
        ([, e]) => e === extname(caminho),
      )?.[0] ?? 'application/octet-stream';
    return { stream: createReadStream(caminho), mime };
  }
}
