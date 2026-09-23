import type { tags } from "typia";

export type EventRangeQuery = {
  from: string & tags.Format<"date">;
  to: string & tags.Format<"date">;
};
