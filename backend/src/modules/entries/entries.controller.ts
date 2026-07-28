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
import type { Entry } from '../../generated/prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { EntriesService } from './entries.service';

@Controller('vaults/:vaultId/entries')
@UseGuards(AccessTokenGuard)
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Post()
  create(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Body() input: CreateEntryDto,
  ): Promise<Entry> {
    return this.entriesService.create(ownerId, vaultId, input);
  }

  @Get()
  findAll(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
  ): Promise<Entry[]> {
    return this.entriesService.findAll(ownerId, vaultId);
  }

  @Get(':entryId')
  findOne(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ): Promise<Entry> {
    return this.entriesService.findOne(ownerId, vaultId, entryId);
  }

  @Patch(':entryId')
  update(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() input: UpdateEntryDto,
  ): Promise<Entry> {
    return this.entriesService.update(ownerId, vaultId, entryId, input);
  }

  @Delete(':entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ): Promise<void> {
    return this.entriesService.remove(ownerId, vaultId, entryId);
  }
}
