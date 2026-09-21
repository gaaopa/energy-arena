import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUsuarioDto {
  @IsString()
  nome!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  senha!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;
}

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  senha?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
