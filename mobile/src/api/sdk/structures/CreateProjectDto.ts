import type { tags } from "typia";

import type { EventFields } from "./EventFields";
import type { RecurringTimeComponentFields } from "./RecurringTimeComponentFields";

export type CreateProjectDto = {
  name?: undefined | string;
  goal?: undefined | string;
  context?: undefined | string;
  projectStatus: "ACTIVE" | "BACKLOG";
  projectType: "EXTERNAL" | "INTERNAL";
  timeNeededMinutes?: undefined | (number & tags.Type<"int32">);
  minBlockMinutes?: undefined | (number & tags.Type<"int32">);
  repetitionsNeeded?: undefined | (number & tags.Type<"int32">);
  earliestDate?: undefined | (string & tags.Format<"date">);
  earliestTime?:
    | undefined
    | (string & tags.Pattern<"^\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
  deadlineDate?: undefined | (string & tags.Format<"date">);
  deadlineTime?:
    | undefined
    | (string & tags.Pattern<"^\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
  originalTimezone: string;
  parentProjectId?: undefined | (string & tags.Format<"uuid">);
  colorId?: undefined | (string & tags.Format<"uuid">);
  recurringTimeComponents: RecurringTimeComponentFields[];
  events: EventFields[];
};
