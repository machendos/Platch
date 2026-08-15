import { TypedBody, TypedQuery } from '@nestia/core';
import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { GetUser } from '../system/common/get.user.decorator';
import { UserDescriptor } from '../system/common/user.descriptor';
import { CreateEventDto } from './dto/create.event.dto';
import { UpdateEventDto } from './dto/update.event.dto';
import { EventsService } from './event.service';
import { Public } from '../system/common/public.descriptor';

@Controller('event')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  getEventsByUser(@GetUser() user: UserDescriptor) {
    return this.eventsService.getEventsByUser(user.id);
  }

  @Post()
  createEvent(@TypedBody() body: CreateEventDto) {}

  @Patch()
  updateEvent(@TypedBody() body: UpdateEventDto) {}

  @Delete()
  deleteEvent(@TypedQuery() query: { id: string }) {}
}
