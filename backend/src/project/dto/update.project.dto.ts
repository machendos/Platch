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
import {
  UpdateTimeComponentDto,
  toUpdateTimeComponent,
} from '../../time-component/dto/update.time.component.dto';
import { validateEach } from '../../system/validation/validate.each';
import {
  stringToPlainDate,
  stringToPlainTime,
} from '../../system/common/date.mappers';

export class UpdateProjectDto {
  id: Uuid;

  name?: string | null;
  goal?: string | null;
  context?: string | null;

  timeNeededMinutes?: Int | null;
  minBlockMinutes?: Int | null;
  repetitionsNeeded?: Int | null;

  earliestDate?: DateString | null;
  earliestTime?: TimeString | null;
  deadlineDate?: DateString | null;
  deadlineTime?: TimeString | null;

  flexibleTimezone?: boolean;
  originalTimezone?: string | null;

  colorId?: Uuid | null;

  createdTimeComponents: TimeComponentFields[];
  updatedTimeComponents: UpdateTimeComponentDto[];
  deletedTimeComponentIds: Uuid[];

  static __validate = (dto: UpdateProjectDto): string | void =>
    validateEach(
      dto.createdTimeComponents ?? [],
      TimeComponentFields,
      'createdTimeComponents',
    ) ??
    validateEach(
      dto.updatedTimeComponents ?? [],
      TimeComponentFields,
      'updatedTimeComponents',
    );
}

export const toUpdateProject = (dto: UpdateProjectDto) => ({
  ...dto,
  earliestDate: stringToPlainDate(dto.earliestDate),
  earliestTime: stringToPlainTime(dto.earliestTime),
  deadlineDate: stringToPlainDate(dto.deadlineDate),
  deadlineTime: stringToPlainTime(dto.deadlineTime),
  createdTimeComponents: dto.createdTimeComponents.map(toTimeComponent),
  updatedTimeComponents: dto.updatedTimeComponents.map(toUpdateTimeComponent),
});

export type UpdateProject = ReturnType<typeof toUpdateProject>;
