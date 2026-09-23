import { Injectable } from '@nestjs/common';
import {
  plainDateTimeToDate,
  plainDateToDate,
} from '../system/common/date.mappers';
import { CreateEvent } from './dto/create.event.dto';
import { EventRange } from './dto/event.query.dto';
import { UpdateEvent } from './dto/update.event.dto';
import { EventsRepository } from './event.repository';

@Injectable()
export class EventsService {
  constructor(private eventsRepository: EventsRepository) {}

  async getEventsInRange(userId: string, range: EventRange) {
    return this.eventsRepository.getEvents({
      project: { userId },
      start: { lt: plainDateToDate(range.to.add({ days: 1 })) },
      end: { gt: plainDateToDate(range.from) },
    });
  }

  async getEventsOfProject(userId: string, projectId: string) {
    return this.eventsRepository.getEvents({ projectId, project: { userId } });
  }

  async createEvent(dto: CreateEvent) {
    return this.eventsRepository.createEvent({
      project: { connect: { id: dto.projectId } },
      start: plainDateTimeToDate(dto.start),
      end: plainDateTimeToDate(dto.end),
      overridedName: dto.overridedName,
      overridedGoal: dto.overridedGoal,
      overridedContext: dto.overridedContext,
    });
  }

  async updateEvent(dto: UpdateEvent) {
    return this.eventsRepository.updateEvent(
      { id: dto.id },
      {
        start: plainDateTimeToDate(dto.start) ?? null,
        end: plainDateTimeToDate(dto.end) ?? null,
        overridedName: dto.overridedName ?? null,
        overridedGoal: dto.overridedGoal ?? null,
        overridedContext: dto.overridedContext ?? null,
      },
    );
  }

  async deleteEvent(id: string): Promise<void> {
    await this.eventsRepository.deleteEvent({ id });
  }
}
