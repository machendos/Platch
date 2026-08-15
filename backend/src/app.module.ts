import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './system/cashe/cache.module';
import { PrismaModule } from './system/database/prisma.module';
import { UserModule } from './user/user.module';
import { HttpExceptionFilter } from './system/errors/http.exception.filter';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidateBodyPipe } from './system/validation/validate.body.pipe';
import { TokensGuard } from './auth/guards/tokens.guard';
import { LoggerModule } from './system/logger/logger.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ProjectsModule } from './project/project.module';
import { TimeComponentsModule } from './time-component/time.component.module';
import { EventsModule } from './event/event.module';

@Module({
  imports: [
    AuthModule,
    CacheModule,
    PrismaModule,
    UserModule,
    ProjectsModule,
    TimeComponentsModule,
    EventsModule,
    LoggerModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: TokensGuard },
    { provide: APP_PIPE, useClass: ValidateBodyPipe },
  ],
})
export class AppModule {}
