import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEntryDto {
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_096)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_048)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string | null;
}
