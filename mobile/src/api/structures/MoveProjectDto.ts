import type { tags } from "typia";

export type MoveProjectDto = {
  id: string & tags.Format<"uuid">;
  parentProjectId: null | (string & tags.Format<"uuid">);
  prevProjectIdInHierarchy: null | (string & tags.Format<"uuid">);
  projectStatus?: undefined | "ACTIVE" | "BACKLOG";
};
