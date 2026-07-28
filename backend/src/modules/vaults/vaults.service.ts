import { Injectable, NotFoundException } from '@nestjs/common';
import type { Vault } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateVaultDto } from './dto/create-vault.dto';
import type { UpdateVaultDto } from './dto/update-vault.dto';

@Injectable()
export class VaultsService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, input: CreateVaultDto): Promise<Vault> {
    return this.prisma.vault.create({
      data: {
        name: input.name,
        ownerId,
      },
    });
  }

  findAll(ownerId: string): Promise<Vault[]> {
    return this.prisma.vault.findMany({
      where: { ownerId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(ownerId: string, vaultId: string): Promise<Vault> {
    const vault = await this.findOwnedVault(ownerId, vaultId);

    if (!vault) {
      throw new NotFoundException('Vault not found');
    }

    return vault;
  }

  async update(
    ownerId: string,
    vaultId: string,
    input: UpdateVaultDto,
  ): Promise<Vault> {
    await this.findOne(ownerId, vaultId);

    return this.prisma.vault.update({
      where: { id: vaultId },
      data: input,
    });
  }

  async remove(ownerId: string, vaultId: string): Promise<void> {
    await this.findOne(ownerId, vaultId);
    await this.prisma.vault.delete({
      where: { id: vaultId },
    });
  }

  private findOwnedVault(
    ownerId: string,
    vaultId: string,
  ): Promise<Vault | null> {
    return this.prisma.vault.findFirst({
      where: {
        id: vaultId,
        ownerId,
      },
    });
  }
}
