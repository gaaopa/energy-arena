import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateCatracaDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsUUID()
  unidadeId!: string;

  // URL local do terminal — ex: http://192.168.0.50
  @IsString()
  @Matches(/^https?:\/\//, { message: 'URL deve começar com http:// ou https://' })
  url!: string;

  @IsString()
  login!: string;

  @IsString()
  senha!: string;
}

export class UpdateCatracaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nome?: string;

  @IsOptional()
  @IsUUID()
  unidadeId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\//, { message: 'URL deve começar com http:// ou https://' })
  url?: string;

  @IsOptional()
  @IsString()
  login?: string;

  @IsOptional()
  @IsString()
  senha?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
