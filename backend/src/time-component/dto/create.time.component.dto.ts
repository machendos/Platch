import {
  RecurringFrequency,
  TimeComponentType,
  WEEKDAY,
} from '../../../prisma-client';
import { Temporal } from '@js-temporal/polyfill';
import {
  DateTimeString,
  Int,
  Uuid,
} from '../../system/validation/validation.decorators';
import { validateEach } from '../../system/validation/validate.each';

import { TimeSlot, toTimeSlot } from './recurring.time.slot.dto';
import { stringToPlainDateTime } from '../../system/common/date.mappers';

export class TimeComponentFields {
  type: TimeComponentType;

  absoluteFrom?: DateTimeString;
  absoluteTo?: DateTimeString;

  recurringInterval?: Int;
  recurringFrequency?: RecurringFrequency;
  recurringByDay?: WEEKDAY[];
  recurringByMonthDay?: Int<1, 31>;
  recurringByMonth?: Int<1, 12>;

  firstRecurringEventAt?: DateTimeString;
  lastRecurringEventAt?: DateTimeString;

  recurringTimeSlots?: TimeSlot[];

  static __validate = (fields: TimeComponentFields): string | void => {
    if (
      fields.type === TimeComponentType.ABSOLUTE &&
      (!fields.absoluteTo || !fields.absoluteFrom)
    )
      return 'ABSOLUTE time component must have absoluteFrom&absoluteTo';

    if (fields.type !== TimeComponentType.RECURRING) return;

    if (!fields.recurringInterval || !fields.recurringFrequency)
      return 'RECURRING TIME component must have recurringInterval & recurringFrequency';

    if (
      fields.recurringFrequency === RecurringFrequency.WEEK &&
      !fields.recurringByDay
    )
      return 'WEEK recurring time component must have recurringByDay';

    if (
      fields.recurringFrequency === RecurringFrequency.MONTH &&
      !fields.recurringByMonthDay
    )
      return 'MONTH recurring time component must have recurringByMonthDay';

    if (
      fields.recurringFrequency === RecurringFrequency.YEAR &&
      (!fields.recurringByMonthDay || !fields.recurringByMonth)
    )
      return 'YEAR component must have recurringByMonthDay && recurringByMonth';

    if (!fields.recurringTimeSlots?.length)
      return 'Recurring time component must have at least one time slot';

    if (!fields.firstRecurringEventAt)
      return 'RECURRING time component must have firstRecurringEventAt';

    if (
      fields.lastRecurringEventAt &&
      Temporal.PlainDateTime.compare(
        Temporal.PlainDateTime.from(fields.firstRecurringEventAt),
        Temporal.PlainDateTime.from(fields.lastRecurringEventAt),
      ) > 0
    )
      return 'lastRecurringEventAt must not precede firstRecurringEventAt';

    return validateEach(fields.recurringTimeSlots, TimeSlot, 'timeSlot');
  };
}

export const toTimeComponent = (fields: TimeComponentFields) => ({
  ...fields,
  absoluteFrom: stringToPlainDateTime(fields.absoluteFrom),
  absoluteTo: stringToPlainDateTime(fields.absoluteTo),
  firstRecurringEventAt: stringToPlainDateTime(fields.firstRecurringEventAt),
  lastRecurringEventAt: stringToPlainDateTime(fields.lastRecurringEventAt),
  recurringTimeSlots: fields.recurringTimeSlots?.map(toTimeSlot),
});

export class CreateTimeComponentDto extends TimeComponentFields {
  projectId: Uuid;
}

export const toCreateTimeComponent = (dto: CreateTimeComponentDto) => ({
  ...toTimeComponent(dto),
  projectId: dto.projectId,
});

export type TimeComponentToCreate = ReturnType<typeof toTimeComponent>;
export type CreateTimeComponent = ReturnType<typeof toCreateTimeComponent>;
