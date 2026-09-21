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
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto, UpdateUsuarioDto } from './dto/usuario.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('usuarios')
@Roles(Role.ADMIN)
export class UsuariosController {
  constructor(private usuarios: UsuariosService) {}

  @Get()
  findAll() {
    return this.usuarios.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuarios.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuarios.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUsuarioDto) {
    return this.usuarios.update(id, dto);
  }
}
