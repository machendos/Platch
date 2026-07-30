import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { CacheService } from '../../system/cashe/cache.service';
import UserService from '../../user/user.service';
import { PrismaService } from '../../system/database/prisma.service';
import { Reflector } from '@nestjs/core';

@Injectable()
export class TokensGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private cacheService: CacheService,
    private userService: UserService,
    private prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublicEndpoint = this.reflector.get<boolean>(
      'public',
      context.getHandler(),
    );

    if (isPublicEndpoint) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    const userId = await this.cacheService.get(token);

    if (!userId) {
      throw new UnauthorizedException();
    }

    request.user = await this.prismaService.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
