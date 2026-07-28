import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { DUMMY_PASSWORD_HASH } from './auth.constants';
import type { AuthResponse } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async register(input: RegisterDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await this.passwordService.hash(input.password);
    const refreshToken = this.tokenService.prepareRefreshToken();

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            passwordHash,
          },
          select: {
            email: true,
            id: true,
          },
        });

        await tx.refreshToken.create({
          data: {
            expiresAt: refreshToken.expiresAt,
            familyId: randomUUID(),
            tokenHash: refreshToken.tokenHash,
            userId: createdUser.id,
          },
        });

        return createdUser;
      });

      return this.tokenService.createResponse(user, refreshToken.raw);
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }
  }

  async login(input: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: this.normalizeEmail(input.email),
      },
    });
    const passwordIsValid = await this.passwordService.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      input.password,
    );

    if (!user || !passwordIsValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.tokenService.issue({
      email: user.email,
      id: user.id,
    });
  }

  refresh(input: RefreshTokenDto): Promise<AuthResponse> {
    return this.tokenService.rotate(input.refreshToken);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
