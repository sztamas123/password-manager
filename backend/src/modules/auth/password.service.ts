import { Injectable } from '@nestjs/common';
import { argon2id, hash as argon2Hash, verify as argon2Verify } from 'argon2';
import { ARGON2_OPTIONS } from './auth.constants';

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2Hash(password, {
      ...ARGON2_OPTIONS,
      type: argon2id,
    });
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2Verify(passwordHash, password);
  }
}
