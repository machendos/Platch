import { Uuid } from '../../../system/validation/validation.decorators';

export class UpdateTimezoneChangeDto {
  id: Uuid;
  ianaTimezone?: string;
  changesAt?: string;
  cityLabel?: string;
}
