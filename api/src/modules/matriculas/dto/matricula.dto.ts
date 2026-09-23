import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { StatusMatricula } from '@prisma/client';

export class CreateMatriculaDto {
  @IsUUID()
  alunoId!: string;

  @IsUUID()
  planoId!: string;

  @IsUUID()
  unidadeId!: string;

  @IsDateString()
  dataInicio!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor?: number;
}

export class TrocarPlanoDto {
  @IsUUID()
  planoId!: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor?: number;
}

export class QueryMatriculasDto {
  @IsOptional()
  @IsUUID()
  alunoId?: string;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;

  @IsOptional()
  @IsEnum(StatusMatricula)
  status?: StatusMatricula;
}
