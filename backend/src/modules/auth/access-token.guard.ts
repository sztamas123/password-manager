import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from './auth.constants';
import type { AuthenticatedUser } from './auth.types';

interface AccessTokenPayload {
  sub: string;
}

export interface AuthenticatedRequest extends Request {
  user: Pick<AuthenticatedUser, 'id'>;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = this.extractBearerToken(request);

    if (!accessToken) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        accessToken,
        {
          algorithms: ['HS256'],
          audience: ACCESS_TOKEN_AUDIENCE,
          issuer: ACCESS_TOKEN_ISSUER,
        },
      );

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new UnauthorizedException('Invalid access token');
      }

      request.user = { id: payload.sub };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [scheme, token, ...extraParts] =
      request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token || extraParts.length > 0) {
      return undefined;
    }

    return token;
  }
}
