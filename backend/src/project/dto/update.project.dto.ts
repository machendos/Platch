import { tags } from 'typia';
import { Uuid } from '../../system/validation/validation.decorators';

export class UpdateProjectDto {
  id: Uuid;

  name?: string;
  goal?: string;
  context?: string;

  timeNeededMinutes?: number & tags.Type<'int32'>;
  minBlockMinutes?: number & tags.Type<'int32'>;
  repetitionsNeeded?: number & tags.Type<'int32'>;

  earliestDate?: string & tags.Format<'date'>;
  earliestTime?: string & tags.Format<'time'>;
  deadlineDate?: string & tags.Format<'date'>;
  deadlineTime?: string & tags.Format<'time'>;

  flexibleTimezone?: boolean;
  originalTimezone?: string;

  parentProjectId?: Uuid;
  colorId?: Uuid;
}
