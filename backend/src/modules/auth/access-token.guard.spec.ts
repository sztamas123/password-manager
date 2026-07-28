import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from './auth.constants';
import {
  AccessTokenGuard,
  type AuthenticatedRequest,
} from './access-token.guard';

describe('AccessTokenGuard', () => {
  const jwtService = {
    verifyAsync: jest.fn(),
  };
  const guard = new AccessTokenGuard(jwtService as unknown as JwtService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verifies a Bearer token with strict JWT constraints', async () => {
    const request = createRequest('Bearer signed-access-token');
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'bd1f329a-e9f1-4d57-9c23-7b2a0a791e38',
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('signed-access-token', {
      algorithms: ['HS256'],
      audience: ACCESS_TOKEN_AUDIENCE,
      issuer: ACCESS_TOKEN_ISSUER,
    });
    expect(request.user).toEqual({
      id: 'bd1f329a-e9f1-4d57-9c23-7b2a0a791e38',
    });
  });

  it.each([undefined, 'Basic credentials', 'Bearer', 'Bearer token extra'])(
    'rejects a malformed authorization header: %s',
    async (authorization) => {
      await expect(
        guard.canActivate(createContext(createRequest(authorization))),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid or expired JWTs', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('token expired'));

    await expect(
      guard.canActivate(
        createContext(createRequest('Bearer expired-access-token')),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createRequest(authorization?: string): AuthenticatedRequest {
  return {
    headers: {
      authorization,
    },
  } as AuthenticatedRequest;
}

function createContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}
