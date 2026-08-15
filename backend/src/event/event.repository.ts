import { Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma-client';
import { PrismaService } from '../system/database/prisma.service';

@Injectable()
export class EventsRepository {
  constructor(private prismaService: PrismaService) {}

  getEvents(where: Prisma.EventWhereInput) {
    return this.prismaService.event.findMany({ where });
  }

  createEvent(data: Prisma.EventCreateInput) {}

  updateEvent(
    where: Prisma.EventWhereUniqueInput,
    data: Prisma.EventUpdateInput,
  ) {}

  deleteEvent(where: Prisma.EventWhereUniqueInput) {}
}
