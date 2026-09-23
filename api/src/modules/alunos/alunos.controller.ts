import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { AlunosService, type ArquivoUpload } from './alunos.service';
import {
  CreateAlunoDto,
  QueryAlunosDto,
  UpdateAlunoDto,
} from './dto/aluno.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/guards/jwt-auth.guard';

@Controller('alunos')
@Roles(Role.ADMIN, Role.RECEPCAO, Role.INSTRUTOR)
export class AlunosController {
  constructor(private alunos: AlunosService) {}

  @Get()
  findAll(@Query() query: QueryAlunosDto, @CurrentUser() user: AuthUser) {
    return this.alunos.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.alunos.findOne(id, user);
  }

  @Get(':id/foto')
  async foto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mime } = await this.alunos.fotoStream(id, user);
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'private, max-age=300');
    return new StreamableFile(stream);
  }

  @Post()
  @Roles(Role.ADMIN, Role.RECEPCAO)
  create(@Body() dto: CreateAlunoDto, @CurrentUser() user: AuthUser) {
    return this.alunos.create(dto, user);
  }

  @Post(':id/foto')
  @Roles(Role.ADMIN, Role.RECEPCAO)
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: ArquivoUpload | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Envie o arquivo de foto');
    return this.alunos.uploadFoto(id, file, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RECEPCAO)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlunoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.alunos.update(id, dto, user);
  }
}
