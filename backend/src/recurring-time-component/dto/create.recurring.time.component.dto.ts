import { RecurringFrequency, WEEKDAY } from '../../../prisma-client';
import { Temporal } from '@js-temporal/polyfill';
import {
  DateTimeString,
  Int,
  Uuid,
} from '../../system/validation/validation.decorators';
import { validateEach } from '../../system/validation/validate.each';

import { TimeSlot, toTimeSlot } from './recurring.time.slot.dto';
import { stringToPlainDateTime } from '../../system/common/date.mappers';

export class RecurringTimeComponentFields {
  recurringInterval: Int;
  recurringFrequency: RecurringFrequency;
  recurringByDay?: WEEKDAY[];
  recurringByMonthDay?: Int<1, 31>;
  recurringByMonth?: Int<1, 12>;

  firstRecurringEventAt?: DateTimeString;
  lastRecurringEventAt?: DateTimeString;

  recurringTimeSlots?: TimeSlot[];

  static __validate = (fields: RecurringTimeComponentFields): string | void => {
    if (fields.recurringInterval < 1)
      return 'recurringInterval must be at least 1';

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

export const toRecurringTimeComponent = (
  fields: RecurringTimeComponentFields,
) => ({
  ...fields,
  firstRecurringEventAt: stringToPlainDateTime(fields.firstRecurringEventAt),
  lastRecurringEventAt: stringToPlainDateTime(fields.lastRecurringEventAt),
  recurringTimeSlots: fields.recurringTimeSlots?.map(toTimeSlot),
});

export class CreateRecurringTimeComponentDto extends RecurringTimeComponentFields {
  projectId: Uuid;
}

export const toCreateRecurringTimeComponent = (
  dto: CreateRecurringTimeComponentDto,
) => ({
  ...toRecurringTimeComponent(dto),
  projectId: dto.projectId,
});

export type RecurringTimeComponentToCreate = ReturnType<
  typeof toRecurringTimeComponent
>;
export type CreateRecurringTimeComponent = ReturnType<
  typeof toCreateRecurringTimeComponent
>;
