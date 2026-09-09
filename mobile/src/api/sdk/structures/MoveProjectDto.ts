import type { tags } from "typia";

export type MoveProjectDto = {
  id: string & tags.Format<"uuid">;
  parentProjectId: null | (string & tags.Format<"uuid">);
  position: string;
  prevSiblingId: null | (string & tags.Format<"uuid">);
  nextSiblingId: null | (string & tags.Format<"uuid">);
  projectStatus?: undefined | "ACTIVE" | "BACKLOG";
};
