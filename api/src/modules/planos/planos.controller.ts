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
import { PlanosService } from './planos.service';
import { CreatePlanoDto, UpdatePlanoDto } from './dto/plano.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('planos')
@Roles(Role.ADMIN, Role.RECEPCAO, Role.INSTRUTOR)
export class PlanosController {
  constructor(private planos: PlanosService) {}

  @Get()
  findAll() {
    return this.planos.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.planos.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreatePlanoDto) {
    return this.planos.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanoDto) {
    return this.planos.update(id, dto);
  }
}
