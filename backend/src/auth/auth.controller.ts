import { TypedBody } from '@nestia/core';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { PasswordGuard } from './guards/password.guard';
import { Public } from '../system/common/public.descriptor';
import { GetUser } from '../system/common/get.user.decorator';
import { AuthService } from './auth.service';
import { UserDescriptor } from '../system/common/user.descriptor';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @UseGuards(PasswordGuard)
  login(
    @TypedBody() body: { username: string; password: string },
    @GetUser() user: UserDescriptor,
  ) {
    return this.authService.createTokensPair(user.id);
  }

  @Post('refresh-token')
  refreshToken(@GetUser() user: UserDescriptor) {
    return this.authService.createTokensPair(user.id);
  }
}
