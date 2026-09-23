import { Injectable } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import {
  RecurringTimeComponent,
  RecurringTimeSlotsType,
} from '../../prisma-client';
import { CreateRecurringTimeComponent } from './dto/create.recurring.time.component.dto';
import { UpdateRecurringTimeComponent } from './dto/update.recurring.time.component.dto';
import {
  RecurringTimeComponentWithSlots,
  RecurringTimeComponentsRepository,
} from './recurring.time.component.repository';
import {
  plainDateTimeToDate,
  plainTimeToDate,
} from '../system/common/date.mappers';

@Injectable()
export class RecurringTimeComponentsService {
  constructor(
    private recurringTimeComponentsRepository: RecurringTimeComponentsRepository,
  ) {}

  async getRecurringTimeComponentsByUser(
    userId: string,
  ): Promise<RecurringTimeComponent[]> {
    return this.recurringTimeComponentsRepository.getRecurringTimeComponents({
      project: { userId },
    });
  }

  async createRecurringTimeComponent(dto: CreateRecurringTimeComponent) {
    return this.recurringTimeComponentsRepository.createRecurringTimeComponent({
      project: { connect: { id: dto.projectId } },

      recurringInterval: dto.recurringInterval,
      recurringFrequency: dto.recurringFrequency,
      recurringByDay: dto.recurringByDay,
      recurringByMonthDay: dto.recurringByMonthDay,
      recurringByMonth: dto.recurringByMonth,
      firstRecurringEventAt: plainDateTimeToDate(dto.firstRecurringEventAt),
      lastRecurringEventAt: plainDateTimeToDate(dto.lastRecurringEventAt),

      recurringTimeSlots: dto.recurringTimeSlots
        ? {
            createMany: {
              data: dto.recurringTimeSlots?.map((timeSlotToCreate) => ({
                type: timeSlotToCreate.type,
                from: plainTimeToDate(timeSlotToCreate.from),
                to: plainTimeToDate(timeSlotToCreate.to),
                flexibleMinutesNeeded: timeSlotToCreate.flexibleMinutesNeeded,
              })),
            },
          }
        : undefined,
    });
  }

  async updateRecurringTimeComponent(
    dto: UpdateRecurringTimeComponent,
  ): Promise<RecurringTimeComponentWithSlots> {
    const slots = dto.recurringTimeSlots ?? [];
    const keptIds = slots
      .map((slot) => slot.id)
      .filter((id): id is string => id !== undefined);

    return this.recurringTimeComponentsRepository.updateRecurringTimeComponent(
      { id: dto.id },
      {
        recurringInterval: dto.recurringInterval ?? null,
        recurringFrequency: dto.recurringFrequency ?? null,
        recurringByDay: dto.recurringByDay ?? [],
        recurringByMonthDay: dto.recurringByMonthDay ?? null,
        recurringByMonth: dto.recurringByMonth ?? null,
        firstRecurringEventAt:
          plainDateTimeToDate(dto.firstRecurringEventAt) ?? null,
        lastRecurringEventAt:
          plainDateTimeToDate(dto.lastRecurringEventAt) ?? null,

        recurringTimeSlots: {
          deleteMany: { id: { notIn: keptIds } },
          update: slots
            .filter(({ id }) => id)
            .map((slot) => ({
              where: { id: slot.id },
              data: {
                type: slot.type,
                from: plainTimeToDate(slot.from) ?? null,
                to: plainTimeToDate(slot.to) ?? null,
                flexibleMinutesNeeded: slot.flexibleMinutesNeeded ?? null,
              },
            })),
          create: slots
            .filter(({ id }) => !id)
            .map((slot) => ({
              type: slot.type,
              from: plainTimeToDate(slot.from) ?? null,
              to: plainTimeToDate(slot.to) ?? null,
              flexibleMinutesNeeded: slot.flexibleMinutesNeeded ?? null,
            })),
        },
      },
    );
  }

  async deleteRecurringTimeComponent(id: string): Promise<void> {
    await this.recurringTimeComponentsRepository.deleteRecurringTimeComponent({
      id,
    });
  }
}
