import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import type { AuthResponse } from '../src/modules/auth/auth.types';

describe('Auth endpoints', () => {
  let app: INestApplication<App>;
  const authResponse: AuthResponse = {
    accessToken: 'access-token',
    expiresIn: 900,
    refreshToken: 'r'.repeat(86),
    tokenType: 'Bearer',
    user: {
      email: 'user@example.com',
      id: 'bd1f329a-e9f1-4d57-9c23-7b2a0a791e38',
    },
  };
  const authService = {
    login: jest.fn(),
    refresh: jest.fn(),
    register: jest.fn(),
  };

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

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
    authService.login.mockResolvedValue(authResponse);
    authService.refresh.mockResolvedValue(authResponse);
    authService.register.mockResolvedValue(authResponse);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register normalizes the email and returns tokens', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: '  USER@Example.com ',
        password: 'correct horse battery staple',
      })
      .expect(201)
      .expect(authResponse);

    expect(authService.register).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correct horse battery staple',
    });
  });

  it('POST /auth/register rejects short passwords and unknown fields', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'user@example.com',
        password: 'short',
        role: 'admin',
      })
      .expect(400);

    expect(authService.register).not.toHaveBeenCalled();
  });

  it('POST /auth/login returns 200 for a valid DTO', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'correct horse battery staple',
      })
      .expect(200)
      .expect(authResponse);
  });

  it('POST /auth/refresh validates the opaque token format', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: 'too-short',
      })
      .expect(400);

    expect(authService.refresh).not.toHaveBeenCalled();
  });
});
