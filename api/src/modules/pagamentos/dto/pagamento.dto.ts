import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { MetodoPagamento, StatusPagamento } from '@prisma/client';

export class QueryPagamentosDto {
  @IsOptional()
  @IsEnum(StatusPagamento)
  status?: StatusPagamento;

  @IsOptional()
  @IsUUID()
  matriculaId?: string;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;
}

export class PagarDto {
  @IsEnum(MetodoPagamento)
  metodo!: MetodoPagamento;

  @IsOptional()
  @IsString()
  referencia?: string;
}
