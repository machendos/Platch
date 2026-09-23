import { ProjectStatus, ProjectType } from '../../../prisma-client';
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
import { validateEach } from '../../system/validation/validate.each';
import {
  stringToPlainDate,
  stringToPlainTime,
} from '../../system/common/date.mappers';
import { EventFields, toEvent } from '../../event/dto/create.event.dto';

export class CreateProjectDto {
  name?: string;
  goal?: string;
  context?: string;

  projectStatus: ProjectStatus;
  projectType: ProjectType;

  timeNeededMinutes?: Int;
  minBlockMinutes?: Int;
  repetitionsNeeded?: Int;

  earliestDate?: DateString;
  earliestTime?: TimeString;
  deadlineDate?: DateString;
  deadlineTime?: TimeString;

  originalTimezone: string;

  parentProjectId?: Uuid;
  colorId?: Uuid;

  recurringTimeComponents: RecurringTimeComponentFields[];
  events: EventFields[];

  static __validate = (dto: CreateProjectDto): string | void =>
    validateEach(
      dto.recurringTimeComponents,
      RecurringTimeComponentFields,
      'recurringTimeComponents',
    ) ?? validateEach(dto.events, EventFields, 'events');
}

export const toCreateProject = (dto: CreateProjectDto) => ({
  ...dto,
  earliestDate: stringToPlainDate(dto.earliestDate) ?? undefined,
  earliestTime: stringToPlainTime(dto.earliestTime) ?? undefined,
  deadlineDate: stringToPlainDate(dto.deadlineDate) ?? undefined,
  deadlineTime: stringToPlainTime(dto.deadlineTime) ?? undefined,
  recurringTimeComponents: dto.recurringTimeComponents.map(toRecurringTimeComponent),
  events: dto.events.map(toEvent),
});

export type CreateProject = ReturnType<typeof toCreateProject>;
