import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CacheModule } from '../system/cashe/cache.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [CacheModule, UserModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
