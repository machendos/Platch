import { Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma-client';
import { BaseRepository } from '../system/database/base-repositoty.service';

@Injectable()
export class EventsRepository extends BaseRepository {
  getEvents(where: Prisma.EventWhereInput) {
    return this.db.event.findMany({ where, orderBy: [{ start: 'asc' }] });
  }

  createEvent(data: Prisma.EventCreateInput) {
    return this.db.event.create({ data });
  }

  updateEvent(
    where: Prisma.EventWhereUniqueInput,
    data: Prisma.EventUpdateInput,
  ) {
    return this.db.event.update({ where, data });
  }

  async deleteEvent(where: Prisma.EventWhereUniqueInput) {
    await this.db.event.delete({ where });
  }
}
