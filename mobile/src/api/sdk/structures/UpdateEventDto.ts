import type { tags } from "typia";

export type UpdateEventDto = {
  id: string & tags.Format<"uuid">;
  start?:
    | undefined
    | (string &
        tags.Pattern<"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
  end?:
    | undefined
    | (string &
        tags.Pattern<"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
  overridedName?: null | undefined | string;
  overridedGoal?: null | undefined | string;
  overridedContext?: null | undefined | string;
};
