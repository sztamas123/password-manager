import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EntriesService } from './entries.service';

describe('EntriesService', () => {
  const ownerId = 'bd1f329a-e9f1-4d57-9c23-7b2a0a791e38';
  const vaultId = '6402d42d-895b-4d0f-9f42-5c9fc9a6fb98';
  const folderId = '135ab4ee-8758-46c1-bfba-55e54dfba01f';
  const entryId = 'f9ccba83-3f69-438e-a040-5b1dc135a95f';
  const entry = {
    createdAt: new Date(),
    folderId,
    id: entryId,
    name: 'Example',
    notes: null,
    password: 'development-only-password',
    updatedAt: new Date(),
    url: 'https://example.com',
    username: 'user@example.com',
    vaultId,
  };
  const prisma = {
    entry: {
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    folder: {
      findFirst: jest.fn(),
    },
    vault: {
      findFirst: jest.fn(),
    },
  };
  const service = new EntriesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an entry only in an owned vault and matching folder', async () => {
    prisma.vault.findFirst.mockResolvedValue({ id: vaultId });
    prisma.folder.findFirst.mockResolvedValue({ id: folderId });
    prisma.entry.create.mockResolvedValue(entry);

    await expect(
      service.create(ownerId, vaultId, {
        folderId,
        name: 'Example',
        password: 'development-only-password',
        url: 'https://example.com',
        username: 'user@example.com',
      }),
    ).resolves.toBe(entry);

    expect(prisma.folder.findFirst).toHaveBeenCalledWith({
      where: {
        id: folderId,
        vaultId,
        vault: { ownerId },
      },
      select: { id: true },
    });
  });

  it('rejects a folder from another vault', async () => {
    prisma.vault.findFirst.mockResolvedValue({ id: vaultId });
    prisma.folder.findFirst.mockResolvedValue(null);

    await expect(
      service.create(ownerId, vaultId, {
        folderId,
        name: 'Example',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.entry.create).not.toHaveBeenCalled();
  });

  it('does not reveal an entry outside the caller’s vault', async () => {
    prisma.entry.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne(ownerId, vaultId, entryId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.entry.findFirst).toHaveBeenCalledWith({
      where: {
        id: entryId,
        vaultId,
        vault: { ownerId },
      },
    });
  });

  it('allows removing an entry from its folder with null', async () => {
    prisma.entry.findFirst.mockResolvedValue(entry);
    prisma.entry.update.mockResolvedValue({
      ...entry,
      folderId: null,
    });

    await service.update(ownerId, vaultId, entryId, {
      folderId: null,
    });

    expect(prisma.folder.findFirst).not.toHaveBeenCalled();
    expect(prisma.entry.update).toHaveBeenCalledWith({
      where: { id: entryId },
      data: { folderId: null },
    });
  });
});
