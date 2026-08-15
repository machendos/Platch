import type { tags } from "typia";

export type UpdateProjectDto = {
  id: string & tags.Format<"uuid">;
  name?: undefined | string;
  goal?: undefined | string;
  context?: undefined | string;
  timeNeededMinutes?: undefined | (number & tags.Type<"int32">);
  minBlockMinutes?: undefined | (number & tags.Type<"int32">);
  repetitionsNeeded?: undefined | (number & tags.Type<"int32">);
  earliestDate?: undefined | (string & tags.Format<"date">);
  earliestTime?: undefined | (string & tags.Format<"time">);
  deadlineDate?: undefined | (string & tags.Format<"date">);
  deadlineTime?: undefined | (string & tags.Format<"time">);
  flexibleTimezone?: undefined | boolean;
  originalTimezone?: undefined | string;
  parentProjectId?: undefined | (string & tags.Format<"uuid">);
  colorId?: undefined | (string & tags.Format<"uuid">);
};
