import { TypedBody, TypedQuery } from '@nestia/core';
import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { GetUser } from '../system/common/get.user.decorator';
import { UserDescriptor } from '../system/common/user.descriptor';
import { RecurringTimeComponent } from '../../prisma-client';
import { CreateRecurringTimeComponentDto } from './dto/create.recurring.time.component.dto';
import { UpdateRecurringTimeComponentDto } from './dto/update.recurring.time.component.dto';
import { RecurringTimeComponentsService } from './recurring.time.component.service';

@Controller('recurring-time-component')
export class RecurringTimeComponentsController {
  constructor(
    private readonly recurringTimeComponentsService: RecurringTimeComponentsService,
  ) {}

  @Get()
  async getRecurringTimeComponentsByUser(
    @GetUser() user: UserDescriptor,
  ): Promise<RecurringTimeComponent[]> {
    return this.recurringTimeComponentsService.getRecurringTimeComponentsByUser(
      user.id,
    );
  }

  @Post()
  createRecurringTimeComponent(
    @TypedBody() body: CreateRecurringTimeComponentDto,
  ) {}

  @Patch()
  updateRecurringTimeComponent(
    @TypedBody() body: UpdateRecurringTimeComponentDto,
  ) {}

  @Delete()
  deleteRecurringTimeComponent(@TypedQuery() query: { id: string }) {}
}
