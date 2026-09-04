import { Uuid } from '../../system/validation/validation.decorators';

export class MoveProjectDto {
  id: Uuid;
  parentProjectId: Uuid | null;
  position: string;
  prevSiblingId: Uuid | null;
  nextSiblingId: Uuid | null;
  projectStatus?: 'ACTIVE' | 'BACKLOG';
}
