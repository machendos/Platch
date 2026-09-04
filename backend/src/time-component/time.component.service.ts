import { Injectable } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import { RecurringTimeSlotsType } from '../../prisma-client';
import { CreateTimeComponent } from './dto/create.time.component.dto';
import { UpdateTimeComponent } from './dto/update.time.component.dto';
import {
  TimeComponentWithSlots,
  TimeComponentsRepository,
} from './time.component.repository';
import {
  plainDateTimeToDate,
  plainDateToDate,
  plainTimeToDate,
} from '../system/common/date.mappers';

@Injectable()
export class TimeComponentsService {
  constructor(private timeComponentsRepository: TimeComponentsRepository) {}

  getTimeComponentsByUser(userId: string) {
    return this.timeComponentsRepository.getTimeComponents({
      project: { userId },
    });
  }

  async createTimeComponent(dto: CreateTimeComponent) {
    return this.timeComponentsRepository.createTimeComponent({
      type: dto.type,
      project: { connect: { id: dto.projectId } },
      absoluteFrom: plainDateTimeToDate(dto.absoluteFrom),
      absoluteTo: plainDateTimeToDate(dto.absoluteTo),

      recurringInterval: dto.recurringInterval,
      recurringFrequency: dto.recurringFrequency,
      recurringByDay: dto.recurringByDay,
      recurringByMonthDay: dto.recurringByMonthDay,
      recurringByMonth: dto.recurringByMonth,
      recurringStartDate: plainDateToDate(dto.recurringStartDate),

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

  async updateTimeComponent(
    dto: UpdateTimeComponent,
  ): Promise<TimeComponentWithSlots> {
    const slots = dto.recurringTimeSlots ?? [];
    const keptIds = slots
      .map((slot) => slot.id)
      .filter((id): id is string => id !== undefined);

    return this.timeComponentsRepository.updateTimeComponent(
      { id: dto.id },
      {
        type: dto.type,
        absoluteFrom: plainDateTimeToDate(dto.absoluteFrom) ?? null,
        absoluteTo: plainDateTimeToDate(dto.absoluteTo) ?? null,

        recurringInterval: dto.recurringInterval ?? null,
        recurringFrequency: dto.recurringFrequency ?? null,
        recurringByDay: dto.recurringByDay ?? [],
        recurringByMonthDay: dto.recurringByMonthDay ?? null,
        recurringByMonth: dto.recurringByMonth ?? null,
        recurringStartDate: plainDateToDate(dto.recurringStartDate) ?? null,

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

  async deleteTimeComponent(id: string): Promise<void> {
    await this.timeComponentsRepository.deleteTimeComponent({ id });
  }
}
