import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let queryRaw: jest.Mock;
  let service: HealthService;

  beforeEach(() => {
    queryRaw = jest.fn();
    const prisma = {
      $queryRaw: queryRaw,
    } as unknown as PrismaService;

    service = new HealthService(prisma);
  });

  it('reports that the API and database are healthy', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
      timestamp: expect.any(String),
    });
  });

  it('returns a service unavailable error when the database is unreachable', async () => {
    queryRaw.mockRejectedValue(new Error('database unavailable'));

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
