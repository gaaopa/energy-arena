import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AlunosService } from './alunos.service';
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

  @Post()
  @Roles(Role.ADMIN, Role.RECEPCAO)
  create(@Body() dto: CreateAlunoDto, @CurrentUser() user: AuthUser) {
    return this.alunos.create(dto, user);
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
