import { TypedBody, TypedQuery } from '@nestia/core';
import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { GetUser } from '../system/common/get.user.decorator';
import { UserDescriptor } from '../system/common/user.descriptor';
import { CreateEventDto } from './dto/create.event.dto';
import { UpdateEventDto } from './dto/update.event.dto';
import {
  EventRangeQuery,
  ProjectEventsQuery,
  toEventRange,
} from './dto/event.query.dto';
import { EventsService } from './event.service';

@Controller('event')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async getEventsInRange(
    @GetUser() user: UserDescriptor,
    @TypedQuery() query: EventRangeQuery,
  ) {
    return this.eventsService.getEventsInRange(user.id, toEventRange(query));
  }

  @Get('by-project')
  async getEventsOfProject(
    @GetUser() user: UserDescriptor,
    @TypedQuery() query: ProjectEventsQuery,
  ) {
    return this.eventsService.getEventsOfProject(user.id, query.projectId);
  }

  @Post()
  createEvent(@TypedBody() body: CreateEventDto) {}

  @Patch()
  updateEvent(@TypedBody() body: UpdateEventDto) {}

  @Delete()
  deleteEvent(@TypedQuery() query: { id: string }) {}
}
