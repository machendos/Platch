import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly client = createClient({
    url: ConfigService.redisPassword
      ? `redis://:${encodeURIComponent(ConfigService.redisPassword)}@${ConfigService.redisHost}:${ConfigService.redisPort}`
      : `redis://${ConfigService.redisHost}:${ConfigService.redisPort}`,
  });

  async onModuleInit() {
    this.client.on('error', (error) => {
      console.error('Redis error:', error);
    });

    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, { EX: ttlSeconds });
      return;
    }

    await this.client.set(key, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
