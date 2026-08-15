import type { tags } from "typia";

;
export namespace recurringTimeSlotsidstringtypeRecurringTimeSlotsTypefromDatenulltoDatenullflexibleMinutesNeedednumbernulltimeComponentIdstring {
    export namespace  {
        export namespace  {
            export type  = {
                recurringTimeSlots: {
                    id: string;
                    type: "ABSOLUTE" | "FLEXIBLE";
                    from: null | (string & tags.Format<"date-time">);
                    to: null | (string & tags.Format<"date-time">);
                    flexibleMinutesNeeded: null | number;
                    timeComponentId: string;
                }[];
                id: string;
                type: "ABSOLUTE" | "RECURRING";
                absoluteFrom: null | (string & tags.Format<"date-time">);
                absoluteTo: null | (string & tags.Format<"date-time">);
                recurringInterval: null | number;
                recurringFrequency: null | "DAY" | "WEEK" | "MONTH" | "YEAR";
                recurringByDay: ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[];
                recurringByMonthDay: null | number;
                recurringByMonth: null | number;
                recurringStartDate: null | (string & tags.Format<"date-time">);
                projectId: string;
            };
        }
    }
}
