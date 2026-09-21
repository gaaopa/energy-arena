import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PagamentosService } from './pagamentos.service';
import { PagarDto, QueryPagamentosDto } from './dto/pagamento.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/guards/jwt-auth.guard';

@Controller('pagamentos')
@Roles(Role.ADMIN, Role.RECEPCAO)
export class PagamentosController {
  constructor(private pagamentos: PagamentosService) {}

  @Get()
  findAll(@Query() query: QueryPagamentosDto, @CurrentUser() user: AuthUser) {
    return this.pagamentos.findAll(query, user);
  }

  @Patch(':id/pagar')
  @Roles(Role.ADMIN, Role.RECEPCAO)
  marcarPago(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PagarDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pagamentos.marcarPago(id, dto, user);
  }
}
