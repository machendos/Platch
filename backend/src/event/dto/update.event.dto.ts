import { Uuid } from '../../system/validation/validation.decorators';
import { EventFields, toEvent } from './create.event.dto';

export class UpdateEventDto extends EventFields {
  id: Uuid;
}

export const toUpdateEvent = (dto: UpdateEventDto) => ({
  ...toEvent(dto),
  id: dto.id,
});

export type UpdateEvent = ReturnType<typeof toUpdateEvent>;
