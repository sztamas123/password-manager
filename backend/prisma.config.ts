import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({
  path: resolve(process.cwd(), '../.env'),
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://password_manager:change-me@localhost:5432/password_manager',
  },
});
