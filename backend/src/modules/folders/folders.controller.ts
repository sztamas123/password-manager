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
import type { Folder } from '../../generated/prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { FoldersService } from './folders.service';

@Controller('vaults/:vaultId/folders')
@UseGuards(AccessTokenGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  create(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Body() input: CreateFolderDto,
  ): Promise<Folder> {
    return this.foldersService.create(ownerId, vaultId, input);
  }

  @Get()
  findAll(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
  ): Promise<Folder[]> {
    return this.foldersService.findAll(ownerId, vaultId);
  }

  @Get(':folderId')
  findOne(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('folderId', ParseUUIDPipe) folderId: string,
  ): Promise<Folder> {
    return this.foldersService.findOne(ownerId, vaultId, folderId);
  }

  @Patch(':folderId')
  update(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('folderId', ParseUUIDPipe) folderId: string,
    @Body() input: UpdateFolderDto,
  ): Promise<Folder> {
    return this.foldersService.update(ownerId, vaultId, folderId, input);
  }

  @Delete(':folderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() ownerId: string,
    @Param('vaultId', ParseUUIDPipe) vaultId: string,
    @Param('folderId', ParseUUIDPipe) folderId: string,
  ): Promise<void> {
    return this.foldersService.remove(ownerId, vaultId, folderId);
  }
}
