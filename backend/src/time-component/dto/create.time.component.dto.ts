import {
  RecurringFrequency,
  TimeComponentType,
  WEEKDAY,
} from '../../../prisma-client';
import {
  DateString,
  DateTimeString,
  Int,
  Uuid,
} from '../../system/validation/validation.decorators';
import { validateEach } from '../../system/validation/validate.each';

import { TimeSlot, toTimeSlot } from './recurring.time.slot.dto';
import {
  stringToPlainDate,
  stringToPlainDateTime,
} from '../../system/common/date.mappers';

export class TimeComponentFields {
  type: TimeComponentType;

  absoluteFrom?: DateTimeString;
  absoluteTo?: DateTimeString;

  recurringInterval?: Int;
  recurringFrequency?: RecurringFrequency;
  recurringByDay?: WEEKDAY[];
  recurringByMonthDay?: Int<1, 31>;
  recurringByMonth?: Int<1, 12>;
  recurringStartDate?: DateString;

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

    return validateEach(fields.recurringTimeSlots, TimeSlot, 'timeSlot');
  };
}

export const toTimeComponent = (fields: TimeComponentFields) => ({
  ...fields,
  absoluteFrom: stringToPlainDateTime(fields.absoluteFrom),
  absoluteTo: stringToPlainDateTime(fields.absoluteTo),
  recurringStartDate: stringToPlainDate(fields.recurringStartDate),
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
