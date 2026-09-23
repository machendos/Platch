import { Injectable } from '@nestjs/common';
import {
  Prisma,
  RecurringTimeComponent,
  RecurringTimeSlots,
} from '../../prisma-client';
import { BaseRepository } from '../system/database/base-repositoty.service';

export interface RecurringTimeComponentWithSlots extends RecurringTimeComponent {
  recurringTimeSlots: RecurringTimeSlots[];
}

@Injectable()
export class RecurringTimeComponentsRepository extends BaseRepository {
  getRecurringTimeComponents(
    where: Prisma.RecurringTimeComponentWhereInput,
  ): Promise<RecurringTimeComponent[]> {
    return this.db.recurringTimeComponent.findMany({ where });
  }

  getRecurringTimeSlots(where: Prisma.RecurringTimeSlotsWhereInput) {
    return this.db.recurringTimeSlots.findMany({ where });
  }

  createRecurringTimeComponent(
    data: Prisma.RecurringTimeComponentCreateInput,
  ): Promise<RecurringTimeComponentWithSlots> {
    return this.db.recurringTimeComponent.create({
      data,
      include: { recurringTimeSlots: true },
    });
  }

  async updateRecurringTimeComponent(
    where: Prisma.RecurringTimeComponentWhereUniqueInput,
    data: Prisma.RecurringTimeComponentUpdateInput,
  ): Promise<RecurringTimeComponentWithSlots> {
    return this.db.recurringTimeComponent.update({
      where,
      data,
      include: { recurringTimeSlots: true },
    });
  }

  async deleteRecurringTimeComponent(
    where: Prisma.RecurringTimeComponentWhereUniqueInput,
  ): Promise<void> {
    await this.db.event.deleteMany({
      where: { recurringTimeComponentId: where.id },
    });
    await this.db.recurringTimeSlots.deleteMany({
      where: { recurringTimeComponentId: where.id },
    });
    await this.db.recurringTimeComponent.delete({ where });
  }
}
