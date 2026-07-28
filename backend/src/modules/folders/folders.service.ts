import { Injectable, NotFoundException } from '@nestjs/common';
import type { Folder } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateFolderDto } from './dto/create-folder.dto';
import type { UpdateFolderDto } from './dto/update-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    ownerId: string,
    vaultId: string,
    input: CreateFolderDto,
  ): Promise<Folder> {
    await this.assertOwnedVault(ownerId, vaultId);

    return this.prisma.folder.create({
      data: {
        name: input.name,
        vaultId,
      },
    });
  }

  findAll(ownerId: string, vaultId: string): Promise<Folder[]> {
    return this.prisma.folder.findMany({
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
    folderId: string,
  ): Promise<Folder> {
    const folder = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        vaultId,
        vault: { ownerId },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return folder;
  }

  async update(
    ownerId: string,
    vaultId: string,
    folderId: string,
    input: UpdateFolderDto,
  ): Promise<Folder> {
    await this.findOne(ownerId, vaultId, folderId);

    return this.prisma.folder.update({
      where: { id: folderId },
      data: input,
    });
  }

  async remove(
    ownerId: string,
    vaultId: string,
    folderId: string,
  ): Promise<void> {
    await this.findOne(ownerId, vaultId, folderId);
    await this.prisma.folder.delete({
      where: { id: folderId },
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
}
