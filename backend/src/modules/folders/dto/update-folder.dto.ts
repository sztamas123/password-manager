import { IsString, Matches, MaxLength } from 'class-validator';
import {
  ENCRYPTED_DATA_PATTERN,
  MAX_ENCRYPTED_DATA_LENGTH,
} from '../../encryption/encrypted-data.validation';

export class UpdateFolderDto {
  @IsString()
  @Matches(ENCRYPTED_DATA_PATTERN)
  @MaxLength(MAX_ENCRYPTED_DATA_LENGTH)
  encryptedData!: string;
}
