import { Uuid } from '../../system/validation/validation.decorators';

export class MoveProjectDto {
  id: Uuid;
  parentProjectId: Uuid | null;
  prevProjectIdInHierarchy: Uuid | null;
  projectStatus?: 'ACTIVE' | 'BACKLOG';
}
