import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Entry } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateEntryDto } from './dto/create-entry.dto';
import type { UpdateEntryDto } from './dto/update-entry.dto';

@Injectable()
export class EntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    ownerId: string,
    vaultId: string,
    input: CreateEntryDto,
  ): Promise<Entry> {
    await this.assertOwnedVault(ownerId, vaultId);
    await this.assertFolderInVault(ownerId, vaultId, input.folderId);

    return this.prisma.entry.create({
      data: {
        ...input,
        vaultId,
      },
    });
  }

  findAll(ownerId: string, vaultId: string): Promise<Entry[]> {
    return this.prisma.entry.findMany({
      where: {
        vaultId,
        vault: { ownerId },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(
    ownerId: string,
    vaultId: string,
    entryId: string,
  ): Promise<Entry> {
    const entry = await this.prisma.entry.findFirst({
      where: {
        id: entryId,
        vaultId,
        vault: { ownerId },
      },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    return entry;
  }

  async update(
    ownerId: string,
    vaultId: string,
    entryId: string,
    input: UpdateEntryDto,
  ): Promise<Entry> {
    await this.findOne(ownerId, vaultId, entryId);
    await this.assertFolderInVault(ownerId, vaultId, input.folderId);

    return this.prisma.entry.update({
      where: { id: entryId },
      data: input,
    });
  }

  async remove(
    ownerId: string,
    vaultId: string,
    entryId: string,
  ): Promise<void> {
    await this.findOne(ownerId, vaultId, entryId);
    await this.prisma.entry.delete({
      where: { id: entryId },
    });
  }

  private async assertOwnedVault(
    ownerId: string,
    vaultId: string,
  ): Promise<void> {
    const vault = await this.prisma.vault.findFirst({
      where: {
        id: vaultId,
        ownerId,
      },
      select: { id: true },
    });

    if (!vault) {
      throw new NotFoundException('Vault not found');
    }
  }

  private async assertFolderInVault(
    ownerId: string,
    vaultId: string,
    folderId: string | null | undefined,
  ): Promise<void> {
    if (folderId === undefined || folderId === null) {
      return;
    }

    const folder = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        vaultId,
        vault: { ownerId },
      },
      select: { id: true },
    });

    if (!folder) {
      throw new BadRequestException('Folder does not belong to this vault');
    }
  }
}
