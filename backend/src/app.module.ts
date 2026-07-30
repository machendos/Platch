import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './system/cashe/cache.module';
import { PrismaModule } from './system/database/prisma.module';
import { UserModule } from './user/user.module';
import { HttpExceptionFilter } from './system/errors/http.exception.filter';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TokensGuard } from './auth/guards/tokens.guard';
import { LoggerModule } from './system/logger/logger.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    AuthModule,
    CacheModule,
    PrismaModule,
    UserModule,
    LoggerModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: TokensGuard },
  ],
})
export class AppModule {}
