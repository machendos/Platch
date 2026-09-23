import { Temporal } from '@js-temporal/polyfill';
import {
  DateString,
  Uuid,
} from '../../system/validation/validation.decorators';

export class EventRangeQuery {
  from: DateString;
  to: DateString;

  static __validate = (query: EventRangeQuery): string | void => {
    if (
      Temporal.PlainDate.compare(
        Temporal.PlainDate.from(query.from),
        Temporal.PlainDate.from(query.to),
      ) > 0
    )
      return 'A range must end on or after it starts';
  };
}

export const toEventRange = (query: EventRangeQuery) => ({
  from: Temporal.PlainDate.from(query.from),
  to: Temporal.PlainDate.from(query.to),
});

export type EventRange = ReturnType<typeof toEventRange>;

export class ProjectEventsQuery {
  projectId: Uuid;
}
