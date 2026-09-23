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
import { MatriculasService } from './matriculas.service';
import {
  CreateMatriculaDto,
  QueryMatriculasDto,
  TrocarPlanoDto,
} from './dto/matricula.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/guards/jwt-auth.guard';

@Controller('matriculas')
@Roles(Role.ADMIN, Role.RECEPCAO)
export class MatriculasController {
  constructor(private matriculas: MatriculasService) {}

  @Get()
  findAll(@Query() query: QueryMatriculasDto, @CurrentUser() user: AuthUser) {
    return this.matriculas.findAll(query, user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.RECEPCAO)
  create(@Body() dto: CreateMatriculaDto, @CurrentUser() user: AuthUser) {
    return this.matriculas.create(dto, user);
  }

  @Patch(':id/trocar-plano')
  @Roles(Role.ADMIN, Role.RECEPCAO)
  trocarPlano(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TrocarPlanoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.matriculas.trocarPlano(id, dto, user);
  }

  @Patch(':id/cancelar')
  @Roles(Role.ADMIN, Role.RECEPCAO)
  cancelar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.matriculas.cancelar(id, user);
  }
}
