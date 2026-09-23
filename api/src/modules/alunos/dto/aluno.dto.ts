import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { StatusAluno } from '@prisma/client';

export class CreateAlunoDto {
  @IsString()
  nome!: string;

  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF deve conter 11 dígitos numéricos' })
  cpf!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  catracaId?: number;

  @IsUUID()
  unidadeId!: string;
}

export class UpdateAlunoDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsEnum(StatusAluno)
  status?: StatusAluno;

  @IsOptional()
  @IsInt()
  @Min(1)
  catracaId?: number;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;
}

export class QueryAlunosDto {
  @IsOptional()
  @IsString()
  busca?: string;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;

  @IsOptional()
  @IsEnum(StatusAluno)
  status?: StatusAluno;
}
