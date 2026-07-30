import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CacheService } from '../system/cashe/cache.service';
import { ConfigService } from '../system/config/config.service';

@Injectable()
export class AuthService {
  constructor(private cacheService: CacheService) {}

  async createTokensPair(userId: string) {
    const [accessToken, refreshToken] = [randomUUID(), randomUUID()];

    await this.cacheService.set(
      accessToken,
      userId,
      ConfigService.accessTokenTtlSeconds,
    );
    await this.cacheService.set(
      refreshToken,
      userId,
      ConfigService.refreshTokenTtlSeconds,
    );

    return { accessToken, refreshToken };
  }
}
