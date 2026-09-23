import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CatracasService } from './catracas.service';
import {
  CreateCatracaDto,
  UpdateCatracaDto,
} from './dto/catraca.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/guards/jwt-auth.guard';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('catracas')
@Roles(Role.ADMIN)
export class CatracasController {
  constructor(
    private catracas: CatracasService,
    private prisma: PrismaService,
  ) {}

  // Endpoint público: o terminal iDFace chama ao identificar uma pessoa.
  // Autenticação pelo token único do dispositivo na URL.
  // Body é Record (não classe) — o ValidationPipe global ignora tipos
  // primitivos, então os campos extras do payload do terminal passam.
  @Public()
  @Post('eventos/:token')
  @HttpCode(200)
  evento(
    @Param('token') token: string,
    @Body() body: Record<string, unknown>,
    @Query('tipo') tipo?: string,
  ) {
    return this.catracas.processarEvento(token, body, tipo);
  }

  @Get()
  findAll() {
    return this.catracas.findAll();
  }

  @Post()
  create(@Body() dto: CreateCatracaDto) {
    return this.catracas.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCatracaDto) {
    return this.catracas.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.catracas.remove(id);
  }

  @Get(':id/eventos')
  eventos(@Param('id', ParseUUIDPipe) id: string) {
    return this.catracas.eventos(id);
  }

  @Post(':id/testar')
  testar(@Param('id', ParseUUIDPipe) id: string) {
    return this.catracas.testar(id);
  }

  @Post(':id/sincronizar')
  syncDispositivo(@Param('id', ParseUUIDPipe) id: string) {
    return this.catracas.syncDispositivo(id);
  }

  // Recepção pode ressincronizar aluno da própria unidade
  @Post('sincronizar-aluno/:alunoId')
  @Roles(Role.ADMIN, Role.RECEPCAO)
  async syncAluno(
    @Param('alunoId', ParseUUIDPipe) alunoId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.unidadeId) {
      const aluno = await this.prisma.aluno.findUnique({
        where: { id: alunoId },
        select: { unidadeId: true },
      });
      if (!aluno || aluno.unidadeId !== user.unidadeId) {
        throw new ForbiddenException('Sem permissão para este aluno');
      }
    }
    return this.catracas.syncAluno(alunoId);
  }
}
