import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateEntryDto {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  username?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4_096)
  password?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2_048)
  url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  folderId?: string | null;
}
