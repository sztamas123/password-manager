import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DUMMY_PASSWORD_HASH } from './auth.constants';
import { AuthService } from './auth.service';
import type { AuthResponse, PreparedRefreshToken } from './auth.types';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

describe('AuthService', () => {
  const preparedRefreshToken: PreparedRefreshToken = {
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    raw: 'r'.repeat(86),
    tokenHash: 'a'.repeat(64),
  };
  const authResponse: AuthResponse = {
    accessToken: 'access-token',
    expiresIn: 900,
    refreshToken: preparedRefreshToken.raw,
    tokenType: 'Bearer',
    user: {
      email: 'user@example.com',
      id: 'bd1f329a-e9f1-4d57-9c23-7b2a0a791e38',
    },
  };

  const transaction = {
    refreshToken: {
      create: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    user: {
      findUnique: jest.fn(),
    },
  };
  const passwordService = {
    hash: jest.fn(),
    verify: jest.fn(),
  };
  const tokenService = {
    createResponse: jest.fn(),
    issue: jest.fn(),
    prepareRefreshToken: jest.fn(),
    rotate: jest.fn(),
  };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
  });

  it('registers a normalized email without persisting the plaintext password', async () => {
    const user = authResponse.user;
    passwordService.hash.mockResolvedValue('argon2-password-hash');
    tokenService.prepareRefreshToken.mockReturnValue(preparedRefreshToken);
    transaction.user.create.mockResolvedValue(user);
    transaction.refreshToken.create.mockResolvedValue({});
    tokenService.createResponse.mockResolvedValue(authResponse);

    await expect(
      service.register({
        email: '  USER@Example.com ',
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual(authResponse);

    expect(transaction.user.create).toHaveBeenCalledWith({
      data: {
        email: 'user@example.com',
        passwordHash: 'argon2-password-hash',
      },
      select: {
        email: true,
        id: true,
      },
    });
    expect(transaction.user.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          password: expect.anything(),
        }),
      }),
    );
  });

  it('rejects registration when the normalized email already exists', async () => {
    passwordService.hash.mockResolvedValue('argon2-password-hash');
    tokenService.prepareRefreshToken.mockReturnValue(preparedRefreshToken);
    transaction.user.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'correct horse battery staple',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with a valid password and issues tokens', async () => {
    const user = {
      ...authResponse.user,
      passwordHash: 'argon2-password-hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.user.findUnique.mockResolvedValue(user);
    passwordService.verify.mockResolvedValue(true);
    tokenService.issue.mockResolvedValue(authResponse);

    await expect(
      service.login({
        email: 'USER@example.com',
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual(authResponse);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(passwordService.verify).toHaveBeenCalledWith(
      user.passwordHash,
      'correct horse battery staple',
    );
  });

  it('uses a dummy Argon2 hash and a generic error for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    passwordService.verify.mockResolvedValue(false);

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'incorrect password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(passwordService.verify).toHaveBeenCalledWith(
      DUMMY_PASSWORD_HASH,
      'incorrect password',
    );
    expect(tokenService.issue).not.toHaveBeenCalled();
  });
});
