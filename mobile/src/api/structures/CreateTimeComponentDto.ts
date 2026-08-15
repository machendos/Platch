import type { tags } from "typia";

import type { TimeSlot } from "./TimeSlot";

export type CreateTimeComponentDto = {
  projectId: string & tags.Format<"uuid">;
  type: "ABSOLUTE" | "RECURRING";
  absoluteFrom?:
    | undefined
    | (string &
        tags.Pattern<"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
  absoluteTo?:
    | undefined
    | (string &
        tags.Pattern<"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
  recurringInterval?: undefined | (number & tags.Type<"int32">);
  recurringFrequency?: undefined | "DAY" | "WEEK" | "MONTH" | "YEAR";
  recurringByDay?:
    undefined | ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[];
  recurringByMonthDay?:
    | undefined
    | (number & tags.Type<"int32"> & tags.Minimum<1> & tags.Maximum<31>);
  recurringByMonth?:
    | undefined
    | (number & tags.Type<"int32"> & tags.Minimum<1> & tags.Maximum<12>);
  recurringStartDate?: undefined | (string & tags.Format<"date">);
  recurringTimeSlots?: undefined | TimeSlot[];
};
