import { Module } from '@nestjs/common';
import UserService from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { TimezoneChangeController } from './timezone-change/timezone.change.controller';
import { TimezoneChangeRepository } from './timezone-change/timezone.change.repository';
import { TimezoneChangeService } from './timezone-change/timezone-change.service';

@Module({
  controllers: [UserController, TimezoneChangeController],
  providers: [
    UserService,
    UserRepository,
    TimezoneChangeRepository,
    TimezoneChangeService,
  ],
  exports: [UserService],
})
export class UserModule {}
