import { Equals, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { WRAPPED_VAULT_KEY_PATTERN } from '../encrypted-data.validation';

export class CreateEncryptionProfileDto {
  @Equals(1)
  version!: number;

  @Equals('argon2id')
  kdfAlgorithm!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{22}$/)
  kdfSalt!: string;

  @IsInt()
  @Min(19_456)
  @Max(1_048_576)
  kdfMemoryKiB!: number;

  @IsInt()
  @Min(2)
  @Max(10)
  kdfIterations!: number;

  @IsInt()
  @Min(1)
  @Max(4)
  kdfParallelism!: number;

  @IsString()
  @Matches(WRAPPED_VAULT_KEY_PATTERN)
  wrappedVaultKey!: string;
}
