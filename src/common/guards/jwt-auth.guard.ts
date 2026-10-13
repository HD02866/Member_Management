import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Optional,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { Request } from 'express';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    const jwtSecret =
      this.configService?.get<string>('jwt.secret') ||
      process.env.JWT_SECRET ||
      'dev_insecure_jwt_secret_change_me_immediately_32chars';

    if (isPublic) {
      // If public and token is present, try decoding to enrich request without failing
      if (token) {
        try {
          const payload = await this.jwtService.verifyAsync(token, {
            secret: jwtSecret,
          });
          request.user = payload as AuthenticatedUser;
        } catch {
          // Ignore invalid token on public routes
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('Authentication token required');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
      });
      
      // Real-time revocation/suspension check
      if (this.prisma && payload.id) {
        const dbUser = await this.prisma.user.findUnique({
          where: { id: payload.id },
          select: { status: true },
        });
        if (!dbUser || dbUser.status === 'SUSPENDED' || dbUser.status === 'DEACTIVATED') {
          throw new UnauthorizedException('Account has been suspended or deactivated');
        }
      }

      request.user = payload as AuthenticatedUser;
      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private extractToken(request: Request): string | undefined {
    // 1. Check Authorization header: Bearer <token>
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      return token;
    }

    // 2. Check signed or unsigned cookies
    if (request.cookies && request.cookies['access_token']) {
      return request.cookies['access_token'];
    }

    // 3. Fallback to query param token for direct media/resource requests
    if (request.query && typeof request.query.token === 'string') {
      return request.query.token;
    }

    return undefined;
  }
}
