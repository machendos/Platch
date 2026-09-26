import type { tags } from "typia";

import type { UpdateTimeSlot } from "./UpdateTimeSlot";

export type UpdateRecurringTimeComponentDto = {
  id: string & tags.Format<"uuid">;
  recurringTimeSlots?: undefined | UpdateTimeSlot[];
  recurringInterval: number & tags.Type<"int32">;
  recurringFrequency: "DAY" | "WEEK" | "MONTH" | "YEAR";
  recurringByDay?:
    undefined | ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[];
  recurringByMonthDay?:
    | undefined
    | (number & tags.Type<"int32"> & tags.Minimum<1> & tags.Maximum<31>);
  recurringByMonth?:
    | undefined
    | (number & tags.Type<"int32"> & tags.Minimum<1> & tags.Maximum<12>);
  firstRecurringEventAt: string &
    tags.Pattern<"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">;
  lastRecurringEventAt?:
    | undefined
    | (string &
        tags.Pattern<"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$">);
};
