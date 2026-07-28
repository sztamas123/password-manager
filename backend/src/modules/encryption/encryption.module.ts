import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EncryptionController } from './encryption.controller';
import { EncryptionService } from './encryption.service';

@Module({
  imports: [AuthModule],
  controllers: [EncryptionController],
  providers: [EncryptionService],
})
export class EncryptionModule {}
