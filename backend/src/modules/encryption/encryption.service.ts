import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EncryptionProfile } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateEncryptionProfileDto } from './dto/create-encryption-profile.dto';

@Injectable()
export class EncryptionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: CreateEncryptionProfileDto,
  ): Promise<EncryptionProfile> {
    try {
      return await this.prisma.encryptionProfile.create({
        data: {
          ...input,
          userId,
        },
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Encryption profile already exists');
      }

      throw error;
    }
  }

  async findOne(userId: string): Promise<EncryptionProfile> {
    const profile = await this.prisma.encryptionProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Encryption profile not found');
    }

    return profile;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
