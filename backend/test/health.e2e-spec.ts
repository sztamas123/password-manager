import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DatabaseModule } from '../src/database/database.module';
import { PrismaService } from '../src/database/prisma.service';
import { HealthModule } from '../src/modules/health/health.module';

describe('Health endpoint', () => {
  let app: INestApplication<App>;
  const queryRaw = jest.fn();

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [DatabaseModule, HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: queryRaw,
      })
      .compile();

    app = testingModule.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    queryRaw.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns the service and database status', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      database: 'up',
      timestamp: expect.any(String),
    });
  });

  it('GET /health returns 503 when PostgreSQL is unavailable', async () => {
    queryRaw.mockRejectedValue(new Error('database unavailable'));

    await request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: 'error',
          database: 'down',
          timestamp: expect.any(String),
        });
      });
  });
});
