import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { UnidadesService } from './unidades.service';
import { CreateUnidadeDto, UpdateUnidadeDto } from './dto/unidade.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('unidades')
@Roles(Role.ADMIN, Role.RECEPCAO, Role.INSTRUTOR)
export class UnidadesController {
  constructor(private unidades: UnidadesService) {}

  @Get()
  findAll() {
    return this.unidades.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.unidades.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateUnidadeDto) {
    return this.unidades.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnidadeDto) {
    return this.unidades.update(id, dto);
  }
}
