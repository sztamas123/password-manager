import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Vault } from '../../generated/prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { CreateVaultDto } from './dto/create-vault.dto';
import { UpdateVaultDto } from './dto/update-vault.dto';
import { VaultsService } from './vaults.service';

@Controller('vaults')
@UseGuards(AccessTokenGuard)
export class VaultsController {
  constructor(private readonly vaultsService: VaultsService) {}

  @Post()
  create(
    @CurrentUserId() ownerId: string,
    @Body() input: CreateVaultDto,
  ): Promise<Vault> {
    return this.vaultsService.create(ownerId, input);
  }

  @Get()
  findAll(@CurrentUserId() ownerId: string): Promise<Vault[]> {
    return this.vaultsService.findAll(ownerId);
  }

  @Get(':vaultId')
  findOne(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
  ): Promise<Vault> {
    return this.vaultsService.findOne(ownerId, vaultId);
  }

  @Patch(':vaultId')
  update(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Body() input: UpdateVaultDto,
  ): Promise<Vault> {
    return this.vaultsService.update(ownerId, vaultId, input);
  }

  @Delete(':vaultId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
  ): Promise<void> {
    return this.vaultsService.remove(ownerId, vaultId);
  }
}
