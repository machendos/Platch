import type { tags } from "typia";

export type TimeSlot = {
  type: "ABSOLUTE" | "FLEXIBLE";
  from?:
    | undefined
    | (string & tags.Pattern<"^\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
  to?:
    | undefined
    | (string & tags.Pattern<"^\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
  flexibleMinutesNeeded?: undefined | (number & tags.Type<"int32">);
};
