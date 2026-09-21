import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateUnidadeDto {
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  telefone?: string;
}

export class UpdateUnidadeDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
