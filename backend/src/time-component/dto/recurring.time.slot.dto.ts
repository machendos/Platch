import { Int, TimeString } from '../../system/validation/validation.decorators';
import { RecurringTimeSlotsType } from '../../../prisma-client';
import { stringToPlainTime } from '../../system/common/date.mappers';

export class TimeSlot {
  type: RecurringTimeSlotsType;
  from?: TimeString;
  to?: TimeString;
  flexibleMinutesNeeded?: Int;

  static __validate = (slot: TimeSlot): string | void => {
    if (
      slot.type === RecurringTimeSlotsType.ABSOLUTE &&
      (!slot.from || !slot.to)
    )
      return 'ABSOLUTE time slot must have from&to';

    if (
      slot.type === RecurringTimeSlotsType.FLEXIBLE &&
      !slot.flexibleMinutesNeeded
    )
      return 'FLEXIBLE time slot must have flexibleMinutesNeeded';
  };
}

export const toTimeSlot = (slot: TimeSlot) => ({
  ...slot,
  from: stringToPlainTime(slot.from),
  to: stringToPlainTime(slot.to),
});
