import { ProjectStatus } from '../../../prisma-client';
import {
  DateString,
  Int,
  TimeString,
  Uuid,
} from '../../system/validation/validation.decorators';
import {
  TimeComponentFields,
  toTimeComponent,
} from '../../time-component/dto/create.time.component.dto';
import { validateEach } from '../../system/validation/validate.each';
import {
  stringToPlainDate,
  stringToPlainTime,
} from '../../system/common/date.mappers';

export class CreateProjectDto {
  name?: string;
  goal?: string;
  context?: string;

  projectStatus: ProjectStatus;

  timeNeededMinutes?: Int;
  minBlockMinutes?: Int;
  repetitionsNeeded?: Int;

  earliestDate?: DateString;
  earliestTime?: TimeString;
  deadlineDate?: DateString;
  deadlineTime?: TimeString;

  flexibleTimezone: boolean;
  originalTimezone?: string;

  parentProjectId?: Uuid;
  colorId?: Uuid;

  timeComponents: TimeComponentFields[];

  static __validate = (dto: CreateProjectDto): string | void =>
    validateEach(dto.timeComponents, TimeComponentFields, 'timeComponents');
}

export const toCreateProject = (dto: CreateProjectDto) => ({
  ...dto,
  earliestDate: stringToPlainDate(dto.earliestDate) ?? undefined,
  earliestTime: stringToPlainTime(dto.earliestTime) ?? undefined,
  deadlineDate: stringToPlainDate(dto.deadlineDate) ?? undefined,
  deadlineTime: stringToPlainTime(dto.deadlineTime) ?? undefined,
  timeComponents: dto.timeComponents.map(toTimeComponent),
});

export type CreateProject = ReturnType<typeof toCreateProject>;
