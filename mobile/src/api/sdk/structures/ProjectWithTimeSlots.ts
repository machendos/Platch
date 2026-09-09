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
  projectType: "EXTERNAL" | "INTERNAL";

  /**
   * Where the wall clock readings above were written. It is a separate field
   *      from them on purpose: the stamps stay free of any zone, and this applies
   *      or does not depending on `projectType`. An EXTERNAL project reads its
   *      times in this zone; an INTERNAL one ignores it.
   */
  originalTimezone: null | string;
  position: string;
  parentProjectId: null | string;
  colorId: null | string;
  userId: string;
};
