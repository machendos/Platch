import type { tags } from "typia";

export type ProjectEventsQuery = {
  projectId: string & tags.Format<"uuid">;
};
