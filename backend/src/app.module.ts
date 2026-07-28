import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['.env', '../.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
  ],
})
export class AppModule {}
