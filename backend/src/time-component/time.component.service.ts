import { Injectable } from '@nestjs/common';
import { CreateTimeComponent } from './dto/create.time.component.dto';
import { UpdateTimeComponentDto } from './dto/update.time.component.dto';
import { TimeComponentsRepository } from './time.component.repository';
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

  updateTimeComponent(dto: UpdateTimeComponentDto) {}

  deleteTimeComponent() {}
}
