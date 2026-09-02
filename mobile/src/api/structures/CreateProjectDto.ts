import type { tags } from "typia";

import type { TimeComponentFields } from "./TimeComponentFields";

export type CreateProjectDto = {
  name?: undefined | string;
  goal?: undefined | string;
  context?: undefined | string;
  projectStatus: "ACTIVE" | "BACKLOG";
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
  flexibleTimezone: boolean;
  originalTimezone?: undefined | string;
  parentProjectId?: undefined | (string & tags.Format<"uuid">);
  colorId?: undefined | (string & tags.Format<"uuid">);
  prevProjectIdInHierarchy?: undefined | (string & tags.Format<"uuid">);
  timeComponents: TimeComponentFields[];
};
