import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  AccessTokenGuard,
  type AuthenticatedRequest,
} from '../src/modules/auth/access-token.guard';
import { VaultsController } from '../src/modules/vaults/vaults.controller';
import { VaultsService } from '../src/modules/vaults/vaults.service';

describe('Encrypted vault contract', () => {
  const ownerId = 'bd1f329a-e9f1-4d57-9c23-7b2a0a791e38';
  const vaultId = '6402d42d-895b-4d0f-9f42-5c9fc9a6fb98';
  const encryptedData = 'pm.v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB';
  let app: INestApplication<App>;
  const vaultsService = {
    create: jest.fn(),
  };
  const authenticatedGuard: CanActivate = {
    canActivate(context: ExecutionContext): boolean {
      const httpRequest = context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();
      httpRequest.user = { id: ownerId };
      return true;
    },
  };

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [VaultsController],
      providers: [
        {
          provide: VaultsService,
          useValue: vaultsService,
        },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue(authenticatedGuard)
      .compile();

    app = testingModule.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vaultsService.create.mockResolvedValue({
      createdAt: new Date().toISOString(),
      encryptedData,
      id: vaultId,
      ownerId,
      updatedAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts only client-generated IDs and ciphertext', async () => {
    await request(app.getHttpServer())
      .post('/vaults')
      .send({ encryptedData, id: vaultId })
      .expect(201);

    expect(vaultsService.create).toHaveBeenCalledWith(ownerId, {
      encryptedData,
      id: vaultId,
    });
  });

  it('rejects the old plaintext vault shape', async () => {
    await request(app.getHttpServer())
      .post('/vaults')
      .send({ id: vaultId, name: 'Personal' })
      .expect(400);

    expect(vaultsService.create).not.toHaveBeenCalled();
  });

  it('rejects data that is not a supported ciphertext envelope', async () => {
    await request(app.getHttpServer())
      .post('/vaults')
      .send({ encryptedData: 'Personal', id: vaultId })
      .expect(400);

    expect(vaultsService.create).not.toHaveBeenCalled();
  });
});
