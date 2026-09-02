import type { tags } from "typia";

import type { TimeComponentWithSlots } from "./TimeComponentWithSlots";

export type ProjectWithTimeSlots = {
  timeComponents: TimeComponentWithSlots[];
  color: null | {
    id: string;
    placement: number;
    hexCode: string;
  };
  name: null | string;
  id: string;
  goal: null | string;
  context: null | string;
  timeNeededMinutes: null | number;
  minBlockMinutes: null | number;
  repetitionsNeeded: null | number;
  earliestDate: null | (string & tags.Format<"date-time">);
  earliestTime: null | (string & tags.Format<"date-time">);
  deadlineDate: null | (string & tags.Format<"date-time">);
  deadlineTime: null | (string & tags.Format<"date-time">);
  projectStatus: "ACTIVE" | "BACKLOG";
  flexibleTimezone: boolean;
  originalTimezone: null | string;
  parentProjectId: null | string;
  colorId: null | string;
  prevProjectIdInHierarchy: null | string;
  userId: string;
};
