import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { MetodoCheckIn } from '@prisma/client';

export class CreateCheckInDto {
  @IsUUID()
  alunoId!: string;

  @IsUUID()
  unidadeId!: string;

  @IsOptional()
  @IsEnum(MetodoCheckIn)
  metodo?: MetodoCheckIn;
}

export class QueryCheckInsDto {
  @IsOptional()
  @IsUUID()
  alunoId?: string;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;

  @IsOptional()
  @IsDateString()
  de?: string;

  @IsOptional()
  @IsDateString()
  ate?: string;
}
