import type { tags } from "typia";

import type { TimeComponentFields } from "./TimeComponentFields";
import type { UpdateTimeComponentDto } from "./UpdateTimeComponentDto";

export type UpdateProjectDto = {
  id: string & tags.Format<"uuid">;
  name?: null | undefined | string;
  goal?: null | undefined | string;
  context?: null | undefined | string;
  projectStatus?: undefined | "ACTIVE" | "BACKLOG";
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
  flexibleTimezone?: undefined | boolean;
  originalTimezone?: null | undefined | string;
  parentProjectId?: null | undefined | (string & tags.Format<"uuid">);
  colorId?: null | undefined | (string & tags.Format<"uuid">);
  createdTimeComponents: TimeComponentFields[];
  updatedTimeComponents: UpdateTimeComponentDto[];
  deletedTimeComponentIds: (string & tags.Format<"uuid">)[];
};
