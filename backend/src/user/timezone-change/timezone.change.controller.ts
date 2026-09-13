import { Controller, Delete, Get, Patch } from '@nestjs/common';
import { TimezoneChangeRepository } from './timezone.change.repository';
import { GetUser } from '../../system/common/get.user.decorator';
import { UserDescriptor } from '../../system/common/user.descriptor';
import { TypedBody, TypedRoute } from '@nestia/core';
import { TimezoneChangeService } from './timezone-change.service';
import { CreateTimezoneChangeDto } from './dto/create.timezone.change.dto';
import Put = TypedRoute.Put;
import { UpdateTimezoneChangeDto } from './dto/update.timezone.change.dto';

@Controller('timezone-change')
export class TimezoneChangeController {
  constructor(
    private readonly timezoneChangeRepository: TimezoneChangeRepository,
    private timezoneChangeService: TimezoneChangeService,
  ) {}

  @Get()
  async getUserTimezoneChanges(@GetUser() { id }: UserDescriptor) {
    return this.timezoneChangeRepository.getUserTimezoneChanges({ userId: id });
  }

  @Put()
  async createTimezoneChange(
    @GetUser() { id }: UserDescriptor,
    @TypedBody() createTimezoneChangeDto: CreateTimezoneChangeDto,
  ) {
    return this.timezoneChangeService.createTimezoneChange(
      createTimezoneChangeDto,
      id,
    );
  }

  @Patch()
  async updateTimezoneChange(
    @TypedBody() updateTimezoneChangeDto: UpdateTimezoneChangeDto,
  ) {
    return this.timezoneChangeService.updateTimezoneChange(
      updateTimezoneChangeDto,
    );
  }
}
