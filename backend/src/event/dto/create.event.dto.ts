import { Temporal } from '@js-temporal/polyfill';
import {
  DateTimeString,
  Uuid,
} from '../../system/validation/validation.decorators';
import { stringToPlainDateTime } from '../../system/common/date.mappers';

export class EventFields {
  start?: DateTimeString;
  end?: DateTimeString;

  overridedName?: string | null;
  overridedGoal?: string | null;
  overridedContext?: string | null;

  static __validate = (fields: EventFields): string | void => {
    if (!fields.start || !fields.end) return 'An event must have start & end';

    if (
      Temporal.PlainDateTime.compare(
        Temporal.PlainDateTime.from(fields.start),
        Temporal.PlainDateTime.from(fields.end),
      ) >= 0
    )
      return 'An event must end after it starts';
  };
}

export const toEvent = (fields: EventFields) => ({
  ...fields,
  start: stringToPlainDateTime(fields.start),
  end: stringToPlainDateTime(fields.end),
});

export class CreateEventDto extends EventFields {
  projectId: Uuid;
}

export const toCreateEvent = (dto: CreateEventDto) => ({
  ...toEvent(dto),
  projectId: dto.projectId,
});

export type EventToCreate = ReturnType<typeof toEvent>;
export type CreateEvent = ReturnType<typeof toCreateEvent>;
