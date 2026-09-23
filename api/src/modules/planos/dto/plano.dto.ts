import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PeriodoPlano } from '@prisma/client';

export class CreatePlanoDto {
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor!: number;

  @IsEnum(PeriodoPlano)
  periodo!: PeriodoPlano;

  @IsOptional()
  @IsBoolean()
  recorrente?: boolean;

  @IsOptional()
  @IsBoolean()
  multiUnidade?: boolean;
}

export class UpdatePlanoDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor?: number;

  @IsOptional()
  @IsEnum(PeriodoPlano)
  periodo?: PeriodoPlano;

  @IsOptional()
  @IsBoolean()
  recorrente?: boolean;

  @IsOptional()
  @IsBoolean()
  multiUnidade?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
