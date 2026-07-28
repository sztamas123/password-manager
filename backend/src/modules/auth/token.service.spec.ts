import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../../config/environment';
import { PrismaService } from '../../database/prisma.service';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from './auth.constants';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const user = {
    email: 'user@example.com',
    id: 'bd1f329a-e9f1-4d57-9c23-7b2a0a791e38',
  };
  const familyId = 'b51342fa-f125-4b03-b05c-cce5c6205917';
  const transaction = {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    refreshToken: {
      create: jest.fn(),
    },
  };
  const jwtService = {
    signAsync: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: keyof EnvironmentVariables) => {
      if (key === 'JWT_ACCESS_TTL_SECONDS') {
        return 900;
      }

      if (key === 'REFRESH_TOKEN_TTL_DAYS') {
        return 30;
      }

      throw new Error(`Unexpected configuration key: ${key}`);
    }),
  };

  const service = new TokenService(
    prisma as unknown as PrismaService,
    jwtService as unknown as JwtService,
    configService as unknown as ConfigService<EnvironmentVariables, true>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    jwtService.signAsync.mockResolvedValue('signed-access-token');
  });

  it('stores only a hash of a random refresh token', async () => {
    prisma.refreshToken.create.mockResolvedValue({});

    const response = await service.issue(user);
    const createInput = prisma.refreshToken.create.mock.calls[0][0];

    expect(response.refreshToken).toHaveLength(86);
    expect(createInput.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createInput.data.tokenHash).not.toBe(response.refreshToken);
    expect(createInput.data.familyId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: user.id },
      {
        algorithm: 'HS256',
        audience: ACCESS_TOKEN_AUDIENCE,
        expiresIn: 900,
        issuer: ACCESS_TOKEN_ISSUER,
      },
    );
  });

  it('rotates a valid refresh token in the same token family', async () => {
    transaction.refreshToken.findUnique.mockResolvedValue({
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      familyId,
      id: 'a0e5c7ee-69a2-44ab-806f-85d5530d7465',
      replacedByTokenHash: null,
      revokedAt: null,
      tokenHash: 'b'.repeat(64),
      user,
      userId: user.id,
    });
    transaction.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    transaction.refreshToken.create.mockResolvedValue({});

    const response = await service.rotate('r'.repeat(86));

    expect(response.refreshToken).not.toBe('r'.repeat(86));
    expect(transaction.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        familyId,
        userId: user.id,
      }),
    });
    expect(transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        revokedAt: null,
      }),
      data: expect.objectContaining({
        replacedByTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        revokedAt: expect.any(Date),
      }),
    });
  });

  it('revokes the active token family when a rotated token is replayed', async () => {
    transaction.refreshToken.findUnique.mockResolvedValue({
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      familyId,
      id: 'a0e5c7ee-69a2-44ab-806f-85d5530d7465',
      replacedByTokenHash: 'c'.repeat(64),
      revokedAt: new Date(),
      tokenHash: 'b'.repeat(64),
      user,
      userId: user.id,
    });
    transaction.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.rotate('r'.repeat(86))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(transaction.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(transaction.refreshToken.create).not.toHaveBeenCalled();
  });
});
