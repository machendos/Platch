import { Uuid } from '../../system/validation/validation.decorators';
import {
  RecurringTimeComponentFields,
  toRecurringTimeComponent,
} from './create.recurring.time.component.dto';
import { TimeSlot, toTimeSlot } from './recurring.time.slot.dto';

export class UpdateTimeSlot extends TimeSlot {
  id?: Uuid;
}

export class UpdateRecurringTimeComponentDto extends RecurringTimeComponentFields {
  id: Uuid;
  declare recurringTimeSlots?: UpdateTimeSlot[];
}

export const toUpdateRecurringTimeComponent = (
  dto: UpdateRecurringTimeComponentDto,
) => ({
  ...toRecurringTimeComponent(dto),
  id: dto.id,
  recurringTimeSlots: dto.recurringTimeSlots?.map((slot) => ({
    ...toTimeSlot(slot),
    id: slot.id,
  })),
});

export type UpdateRecurringTimeComponent = ReturnType<
  typeof toUpdateRecurringTimeComponent
>;
