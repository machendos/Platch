import { Injectable } from '@nestjs/common';
import { Prisma, RecurringTimeSlots, TimeComponent } from '../../prisma-client';
import { PrismaService } from '../system/database/prisma.service';

export interface TimeComponentWithSlots extends TimeComponent {
  recurringTimeSlots: RecurringTimeSlots[];
}

@Injectable()
export class TimeComponentsRepository {
  constructor(private prismaService: PrismaService) {}

  getTimeComponents(where: Prisma.TimeComponentWhereInput) {
    return this.prismaService.timeComponent.findMany({ where });
  }

  getRecurringTImeSlots(where: Prisma.RecurringTimeSlotsWhereInput) {
    return this.prismaService.recurringTimeSlots.findMany({ where });
  }

  createTimeComponent(
    data: Prisma.TimeComponentCreateInput,
  ): Promise<TimeComponentWithSlots> {
    return this.prismaService.timeComponent.create({
      data,
      include: { recurringTimeSlots: true },
    });
  }

  updateTimeComponent(
    where: Prisma.TimeComponentWhereUniqueInput,
    data: Prisma.TimeComponentUpdateInput,
  ) {}

  deleteTimeComponent(where: Prisma.TimeComponentWhereUniqueInput) {}
}
