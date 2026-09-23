import type { tags } from "typia";

import type { EventFields } from "./EventFields";
import type { RecurringTimeComponentFields } from "./RecurringTimeComponentFields";
import type { UpdateEventDto } from "./UpdateEventDto";
import type { UpdateRecurringTimeComponentDto } from "./UpdateRecurringTimeComponentDto";

export type UpdateProjectDto = {
  id: string & tags.Format<"uuid">;
  name?: null | undefined | string;
  goal?: null | undefined | string;
  context?: null | undefined | string;
  projectType?: undefined | "EXTERNAL" | "INTERNAL";
  timeNeededMinutes?: null | undefined | (number & tags.Type<"int32">);
  minBlockMinutes?: null | undefined | (number & tags.Type<"int32">);
  repetitionsNeeded?: null | undefined | (number & tags.Type<"int32">);
  earliestDate?: null | undefined | (string & tags.Format<"date">);
  earliestTime?:
    | null
    | undefined
    | (string & tags.Pattern<"^\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
  deadlineDate?: null | undefined | (string & tags.Format<"date">);
  deadlineTime?:
    | null
    | undefined
    | (string & tags.Pattern<"^\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
  originalTimezone?: undefined | string;
  colorId?: null | undefined | (string & tags.Format<"uuid">);
  createdRecurringTimeComponents: RecurringTimeComponentFields[];
  updatedRecurringTimeComponents: UpdateRecurringTimeComponentDto[];
  deletedRecurringTimeComponentIds: (string & tags.Format<"uuid">)[];
  createdEvents: EventFields[];
  updatedEvents: UpdateEventDto[];
  deletedEventIds: (string & tags.Format<"uuid">)[];
};
