import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create.event.dto';
import { UpdateEventDto } from './dto/update.event.dto';
import { EventsRepository } from './event.repository';

@Injectable()
export class EventsService {
  constructor(private eventsRepository: EventsRepository) {}

  getEventsByUser(userId: string) {
    return this.eventsRepository.getEvents({ project: { userId } });
  }

  createEvent(dto: CreateEventDto) {}

  updateEvent(dto: UpdateEventDto) {}

  deleteEvent() {}
}
