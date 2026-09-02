import { Uuid } from '../../system/validation/validation.decorators';

export class MoveProjectDto {
  id: Uuid;

  /* Null puts the project at the root of its section. Both this and the
     position are stated outright rather than inferred, so a client that
     computed a drop from pixels says exactly where it meant. */
  parentProjectId: Uuid | null;

  /* The project this one should follow inside its new list; null makes it the
     first. */
  prevProjectIdInHierarchy: Uuid | null;

  /* Only on a move between sections. The subtree follows. */
  projectStatus?: 'ACTIVE' | 'BACKLOG';
}
