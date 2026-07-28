import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const userId = 'bd1f329a-e9f1-4d57-9c23-7b2a0a791e38';
  const input = {
    kdfAlgorithm: 'argon2id',
    kdfIterations: 2,
    kdfMemoryKiB: 19_456,
    kdfParallelism: 1,
    kdfSalt: 'AAAAAAAAAAAAAAAAAAAAAA',
    version: 1,
    wrappedVaultKey:
      'pm.v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  };
  const profile = {
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
    userId,
  };
  const prisma = {
    encryptionProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const service = new EncryptionService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores only the client-created KDF parameters and wrapped key', async () => {
    prisma.encryptionProfile.create.mockResolvedValue(profile);

    await expect(service.create(userId, input)).resolves.toBe(profile);
    expect(prisma.encryptionProfile.create).toHaveBeenCalledWith({
      data: {
        ...input,
        userId,
      },
    });
  });

  it('does not overwrite an existing encryption profile', async () => {
    prisma.encryptionProfile.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.create(userId, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns only the authenticated user’s encryption profile', async () => {
    prisma.encryptionProfile.findUnique.mockResolvedValue(profile);

    await expect(service.findOne(userId)).resolves.toBe(profile);
    expect(prisma.encryptionProfile.findUnique).toHaveBeenCalledWith({
      where: { userId },
    });
  });

  it('returns not found before a profile has been initialized', async () => {
    prisma.encryptionProfile.findUnique.mockResolvedValue(null);

    await expect(service.findOne(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
