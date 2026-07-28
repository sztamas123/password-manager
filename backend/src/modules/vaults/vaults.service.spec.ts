import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { VaultsService } from './vaults.service';

describe('VaultsService', () => {
  const ownerId = 'bd1f329a-e9f1-4d57-9c23-7b2a0a791e38';
  const vaultId = '6402d42d-895b-4d0f-9f42-5c9fc9a6fb98';
  const encryptedData = 'pm.v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB';
  const vault = {
    createdAt: new Date(),
    encryptedData,
    id: vaultId,
    ownerId,
    updatedAt: new Date(),
  };
  const prisma = {
    vault: {
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new VaultsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a vault for the authenticated owner', async () => {
    prisma.vault.create.mockResolvedValue(vault);

    await expect(
      service.create(ownerId, { encryptedData, id: vaultId }),
    ).resolves.toBe(vault);
    expect(prisma.vault.create).toHaveBeenCalledWith({
      data: {
        encryptedData,
        id: vaultId,
        ownerId,
      },
    });
  });

  it('scopes vault lookups to the authenticated owner', async () => {
    prisma.vault.findFirst.mockResolvedValue(vault);

    await expect(service.findOne(ownerId, vaultId)).resolves.toBe(vault);
    expect(prisma.vault.findFirst).toHaveBeenCalledWith({
      where: {
        id: vaultId,
        ownerId,
      },
    });
  });

  it('does not reveal a vault that is not owned by the caller', async () => {
    prisma.vault.findFirst.mockResolvedValue(null);

    await expect(service.findOne(ownerId, vaultId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('checks ownership before deleting a vault', async () => {
    prisma.vault.findFirst.mockResolvedValue(null);

    await expect(service.remove(ownerId, vaultId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.vault.delete).not.toHaveBeenCalled();
  });
});
