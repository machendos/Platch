import { Uuid } from '../../system/validation/validation.decorators';
import {
  TimeComponentFields,
  toTimeComponent,
} from './create.time.component.dto';
import { TimeSlot, toTimeSlot } from './recurring.time.slot.dto';

export class UpdateTimeSlot extends TimeSlot {
  id?: Uuid;
}

export class UpdateTimeComponentDto extends TimeComponentFields {
  id: Uuid;
  declare recurringTimeSlots?: UpdateTimeSlot[];
}

export const toUpdateTimeComponent = (dto: UpdateTimeComponentDto) => ({
  ...toTimeComponent(dto),
  id: dto.id,
  recurringTimeSlots: dto.recurringTimeSlots?.map((slot) => ({
    ...toTimeSlot(slot),
    id: slot.id,
  })),
});

export type UpdateTimeComponent = ReturnType<typeof toUpdateTimeComponent>;
