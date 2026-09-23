import { ProjectType } from '../../../prisma-client';
import {
  DateString,
  Int,
  TimeString,
  Uuid,
} from '../../system/validation/validation.decorators';
import {
  RecurringTimeComponentFields,
  toRecurringTimeComponent,
} from '../../recurring-time-component/dto/create.recurring.time.component.dto';
import {
  UpdateRecurringTimeComponentDto,
  toUpdateRecurringTimeComponent,
} from '../../recurring-time-component/dto/update.recurring.time.component.dto';
import { validateEach } from '../../system/validation/validate.each';
import {
  stringToPlainDate,
  stringToPlainTime,
} from '../../system/common/date.mappers';
import { EventFields, toEvent } from '../../event/dto/create.event.dto';
import {
  UpdateEventDto,
  toUpdateEvent,
} from '../../event/dto/update.event.dto';

export class UpdateProjectDto {
  id: Uuid;

  name?: string | null;
  goal?: string | null;
  context?: string | null;

  projectType?: ProjectType;

  timeNeededMinutes?: Int | null;
  minBlockMinutes?: Int | null;
  repetitionsNeeded?: Int | null;

  earliestDate?: DateString | null;
  earliestTime?: TimeString | null;
  deadlineDate?: DateString | null;
  deadlineTime?: TimeString | null;

  originalTimezone?: string;

  colorId?: Uuid | null;

  createdRecurringTimeComponents: RecurringTimeComponentFields[];
  updatedRecurringTimeComponents: UpdateRecurringTimeComponentDto[];
  deletedRecurringTimeComponentIds: Uuid[];

  createdEvents: EventFields[];
  updatedEvents: UpdateEventDto[];
  deletedEventIds: Uuid[];

  static __validate = (dto: UpdateProjectDto): string | void =>
    validateEach(
      dto.createdRecurringTimeComponents ?? [],
      RecurringTimeComponentFields,
      'createdRecurringTimeComponents',
    ) ??
    validateEach(
      dto.updatedRecurringTimeComponents ?? [],
      RecurringTimeComponentFields,
      'updatedRecurringTimeComponents',
    ) ??
    validateEach(dto.createdEvents ?? [], EventFields, 'createdEvents') ??
    validateEach(dto.updatedEvents ?? [], EventFields, 'updatedEvents');
}

export const toUpdateProject = (dto: UpdateProjectDto) => ({
  ...dto,
  earliestDate: stringToPlainDate(dto.earliestDate),
  earliestTime: stringToPlainTime(dto.earliestTime),
  deadlineDate: stringToPlainDate(dto.deadlineDate),
  deadlineTime: stringToPlainTime(dto.deadlineTime),
  createdRecurringTimeComponents: dto.createdRecurringTimeComponents.map(
    toRecurringTimeComponent,
  ),
  updatedRecurringTimeComponents: dto.updatedRecurringTimeComponents.map(
    toUpdateRecurringTimeComponent,
  ),
  createdEvents: dto.createdEvents.map(toEvent),
  updatedEvents: dto.updatedEvents.map(toUpdateEvent),
});

export type UpdateProject = ReturnType<typeof toUpdateProject>;
