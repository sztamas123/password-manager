import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { EncryptionProfile } from '../../generated/prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { CreateEncryptionProfileDto } from './dto/create-encryption-profile.dto';
import { EncryptionService } from './encryption.service';

@Controller('encryption/profile')
@UseGuards(AccessTokenGuard)
export class EncryptionController {
  constructor(private readonly encryptionService: EncryptionService) {}

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Body() input: CreateEncryptionProfileDto,
  ): Promise<EncryptionProfile> {
    return this.encryptionService.create(userId, input);
  }

  @Get()
  findOne(@CurrentUserId() userId: string): Promise<EncryptionProfile> {
    return this.encryptionService.findOne(userId);
  }
}
