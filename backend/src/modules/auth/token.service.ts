import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../../config/environment';
import { PrismaService } from '../../database/prisma.service';
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  REFRESH_TOKEN_BYTES,
} from './auth.constants';
import type {
  AuthenticatedUser,
  AuthResponse,
  PreparedRefreshToken,
} from './auth.types';

interface RotationResult {
  status: 'invalid' | 'valid';
  user?: AuthenticatedUser;
}

@Injectable()
export class TokenService {
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlMilliseconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.accessTokenTtlSeconds = configService.get('JWT_ACCESS_TTL_SECONDS', {
      infer: true,
    });
    this.refreshTokenTtlMilliseconds =
      configService.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) *
      24 *
      60 *
      60 *
      1_000;
  }

  prepareRefreshToken(): PreparedRefreshToken {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    return {
      expiresAt: new Date(Date.now() + this.refreshTokenTtlMilliseconds),
      raw,
      tokenHash: this.hashRefreshToken(raw),
    };
  }

  async issue(user: AuthenticatedUser): Promise<AuthResponse> {
    const refreshToken = this.prepareRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        expiresAt: refreshToken.expiresAt,
        familyId: randomUUID(),
        tokenHash: refreshToken.tokenHash,
        userId: user.id,
      },
    });

    return this.createResponse(user, refreshToken.raw);
  }

  async rotate(rawRefreshToken: string): Promise<AuthResponse> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const nextToken = this.prepareRefreshToken();
    const now = new Date();

    const result = await this.prisma.$transaction<RotationResult>(
      async (tx) => {
        const currentToken = await tx.refreshToken.findUnique({
          where: { tokenHash },
          include: {
            user: {
              select: {
                email: true,
                id: true,
              },
            },
          },
        });

        if (!currentToken) {
          return { status: 'invalid' };
        }

        if (currentToken.revokedAt || currentToken.expiresAt <= now) {
          await tx.refreshToken.updateMany({
            where: {
              familyId: currentToken.familyId,
              revokedAt: null,
            },
            data: {
              revokedAt: now,
            },
          });

          return { status: 'invalid' };
        }

        const consumed = await tx.refreshToken.updateMany({
          where: {
            expiresAt: { gt: now },
            id: currentToken.id,
            revokedAt: null,
          },
          data: {
            replacedByTokenHash: nextToken.tokenHash,
            revokedAt: now,
          },
        });

        if (consumed.count !== 1) {
          await tx.refreshToken.updateMany({
            where: {
              familyId: currentToken.familyId,
              revokedAt: null,
            },
            data: {
              revokedAt: now,
            },
          });

          return { status: 'invalid' };
        }

        await tx.refreshToken.create({
          data: {
            expiresAt: nextToken.expiresAt,
            familyId: currentToken.familyId,
            tokenHash: nextToken.tokenHash,
            userId: currentToken.userId,
          },
        });

        return {
          status: 'valid',
          user: currentToken.user,
        };
      },
    );

    if (result.status !== 'valid' || !result.user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.createResponse(result.user, nextToken.raw);
  }

  async createResponse(
    user: AuthenticatedUser,
    refreshToken: string,
  ): Promise<AuthResponse> {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
      },
      {
        algorithm: 'HS256',
        audience: ACCESS_TOKEN_AUDIENCE,
        expiresIn: this.accessTokenTtlSeconds,
        issuer: ACCESS_TOKEN_ISSUER,
      },
    );

    return {
      accessToken,
      expiresIn: this.accessTokenTtlSeconds,
      refreshToken,
      tokenType: 'Bearer',
      user,
    };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken, 'utf8').digest('hex');
  }
}
