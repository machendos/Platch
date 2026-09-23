import type { tags } from "typia";

export type RecurringTimeComponentWithSlots = {
  recurringTimeSlots: {
    id: string;
    type: "ABSOLUTE" | "FLEXIBLE";
    from: null | (string & tags.Format<"date-time">);
    to: null | (string & tags.Format<"date-time">);
    flexibleMinutesNeeded: null | number;
    recurringTimeComponentId: string;
  }[];
  id: string;
  recurringInterval: number;
  recurringFrequency: "DAY" | "WEEK" | "MONTH" | "YEAR";
  recurringByDay: ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[];
  recurringByMonthDay: null | number;
  recurringByMonth: null | number;
  firstRecurringEventAt: null | (string & tags.Format<"date-time">);
  lastRecurringEventAt: null | (string & tags.Format<"date-time">);
  projectId: string;
};
