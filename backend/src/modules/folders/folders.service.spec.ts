import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FoldersService } from './folders.service';

describe('FoldersService', () => {
  const ownerId = 'bd1f329a-e9f1-4d57-9c23-7b2a0a791e38';
  const vaultId = '6402d42d-895b-4d0f-9f42-5c9fc9a6fb98';
  const folderId = '135ab4ee-8758-46c1-bfba-55e54dfba01f';
  const folder = {
    createdAt: new Date(),
    id: folderId,
    name: 'Work',
    updatedAt: new Date(),
    vaultId,
  };
  const prisma = {
    folder: {
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    vault: {
      findFirst: jest.fn(),
    },
  };
  const service = new FoldersService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a folder only after verifying vault ownership', async () => {
    prisma.vault.findFirst.mockResolvedValue({ id: vaultId });
    prisma.folder.create.mockResolvedValue(folder);

    await expect(
      service.create(ownerId, vaultId, { name: 'Work' }),
    ).resolves.toBe(folder);

    expect(prisma.vault.findFirst).toHaveBeenCalledWith({
      where: {
        id: vaultId,
        ownerId,
      },
      select: { id: true },
    });
  });

  it('rejects folder creation in another user’s vault', async () => {
    prisma.vault.findFirst.mockResolvedValue(null);

    await expect(
      service.create(ownerId, vaultId, { name: 'Work' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.folder.create).not.toHaveBeenCalled();
  });

  it('scopes individual folders through their owning vault', async () => {
    prisma.folder.findFirst.mockResolvedValue(folder);

    await expect(service.findOne(ownerId, vaultId, folderId)).resolves.toBe(
      folder,
    );
    expect(prisma.folder.findFirst).toHaveBeenCalledWith({
      where: {
        id: folderId,
        vaultId,
        vault: { ownerId },
      },
    });
  });
});
