import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CheckInsService } from './checkins.service';
import { CreateCheckInDto, QueryCheckInsDto } from './dto/checkin.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/guards/jwt-auth.guard';

@Controller('checkins')
@Roles(Role.ADMIN, Role.RECEPCAO, Role.INSTRUTOR)
export class CheckInsController {
  constructor(private checkins: CheckInsService) {}

  @Get()
  findAll(@Query() query: QueryCheckInsDto, @CurrentUser() user: AuthUser) {
    return this.checkins.findAll(query, user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.RECEPCAO, Role.INSTRUTOR)
  create(@Body() dto: CreateCheckInDto, @CurrentUser() user: AuthUser) {
    return this.checkins.create(dto, user);
  }
}
