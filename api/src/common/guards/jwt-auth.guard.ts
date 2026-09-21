import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  unidadeId: string | null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const request = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Token ausente');

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        role: Role;
        unidadeId: string | null;
      }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        algorithms: ['HS256'],
      });

      if (!payload.sub || !payload.role) {
        throw new UnauthorizedException('Token inválido ou expirado');
      }

      (request as Request & { user: AuthUser }).user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        unidadeId: payload.unidadeId,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  private extractToken(request: Request): string | undefined {
    // Esquema HTTP é case-insensitive (RFC 7235) e pode haver espaços extras
    const [type, token] =
      request.headers.authorization?.trim().split(/\s+/) ?? [];
    return type?.toLowerCase() === 'bearer' && token ? token : undefined;
  }
}
