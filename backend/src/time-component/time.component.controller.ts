import { TypedBody, TypedQuery } from '@nestia/core';
import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { GetUser } from '../system/common/get.user.decorator';
import { UserDescriptor } from '../system/common/user.descriptor';
import { CreateTimeComponentDto } from './dto/create.time.component.dto';
import { UpdateTimeComponentDto } from './dto/update.time.component.dto';
import { TimeComponentsService } from './time.component.service';

@Controller('time-component')
export class TimeComponentsController {
  constructor(private readonly timeComponentsService: TimeComponentsService) {}

  @Get()
  getTimeComponentsByUser(@GetUser() user: UserDescriptor) {
    return this.timeComponentsService.getTimeComponentsByUser(user.id);
  }

  @Post()
  createTimeComponent(@TypedBody() body: CreateTimeComponentDto) {}

  @Patch()
  updateTimeComponent(@TypedBody() body: UpdateTimeComponentDto) {}

  @Delete()
  deleteTimeComponent(@TypedQuery() query: { id: string }) {}
}
