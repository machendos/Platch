import { Controller, Get, Post } from '@nestjs/common';
import { Public } from '../system/common/public.descriptor';
import { TypedBody } from '@nestia/core';
import UserService from './user.service';
import { GetUser } from '../system/common/get.user.decorator';
import { UserDescriptor } from '../system/common/user.descriptor';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getCurrentUser(@GetUser() user: UserDescriptor) {
    return this.userService.getUser(user.id);
  }

  @Public()
  @Post()
  async createUser(@TypedBody() body: { username: string; password: string }) {
    await this.userService.createUser(body.username, body.password);
  }
}
