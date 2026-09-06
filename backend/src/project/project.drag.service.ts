import { Injectable } from '@nestjs/common';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { $Enums, Project } from '../../prisma-client';
import { TransactionsService } from '../system/database/transactions.service';
import { ErrorCode } from '../system/errors/error.code';
import { ErrorType, PlatchError } from '../system/errors/platch.error';
import { MoveProjectDto } from './dto/move.project.dto';
import { ProjectsRepository, ProjectsSnapshot } from './project.repository';
import { runInBatches } from '../system/common/run.in.batches';

type ProjectStatus = $Enums.ProjectStatus;

export const REBALANCE_KEY_LENGTH = 80;

@Injectable()
export class ProjectDragService {
  constructor(
    private projectsRepository: ProjectsRepository,
    private transactionsService: TransactionsService,
  ) {}

  async moveProject(
    dto: MoveProjectDto,
    userId: string,
  ): Promise<ProjectsSnapshot> {
    return this.transactionsService.executeInTransaction({}, async () => {
      await this.transactionsService.acquireLock(`project-chain:${userId}`);

      const projects = await this.projectsRepository.findProjects({ userId });
      const { movedProject, parent } = this.validateMove(projects, dto);

      /* A parent decides its children's category, so a status on the wire is
         only consulted when the project is landing at the root. Deriving rather
         than rejecting keeps a stale client's move working: it asked to put the
         project under this parent, and that is still what happens. */
      const status =
        parent?.projectStatus ??
        dto.projectStatus ??
        movedProject.projectStatus;

      const position = this.resolvePosition(projects, dto, status);
      await this.projectsRepository.updateProject(
        { id: dto.id },
        {
          position,
          parentProjectId: dto.parentProjectId,
          projectStatus: status,
        },
      );

      await this.carrySubtree(projects, movedProject, status);
      await this.rebalance(userId, dto, status);

      /* Both taken inside the transaction the advisory lock guards, so the
         version and the rows it labels can never come from different states —
         which is what lets the client order snapshots that arrive out of
         order. */
      return {
        version: await this.projectsRepository.bumpProjectsVersion(userId),
        projects: await this.projectsRepository.getProjectsWithTimeSlots({
          userId,
        }),
      };
    });
  }

  private validateMove(projects: Project[], dto: MoveProjectDto) {
    const moved = projects.find((project) => project.id === dto.id);

    if (!moved) {
      throw this.buildRejection('Project not found.', ErrorCode.NOT_FOUND);
    }

    if (dto.parentProjectId === null) {
      return { movedProject: moved, parent: null };
    }

    const parent = projects.find(
      (project) => project.id === dto.parentProjectId,
    );

    if (!parent) throw this.buildRejection('The new parent does not exist.');

    if (this.collectSubtreeIds(projects, dto.id).has(parent.id)) {
      throw this.buildRejection('A project cannot be moved inside itself.');
    }

    return { movedProject: moved, parent };
  }

  /* The client computes `position` against the keys it last read. A rebalance
     between that read and this write renumbers the whole group, which leaves
     the key pointing somewhere else entirely — so the sibling *ids* travel with
     it. They survive renumbering, and when they no longer bracket the key the
     drop is resolved from them instead. A sibling that has since left the group
     proves nothing either way, and the key is taken as sent. */
  private resolvePosition(
    projects: Project[],
    dto: MoveProjectDto,
    status: ProjectStatus,
  ) {
    const findSiblingInGroup = (id: string | null) => {
      if (id === null) return null;

      const sibling = projects.find((project) => project.id === id);

      return sibling &&
        sibling.parentProjectId === dto.parentProjectId &&
        sibling.projectStatus === status
        ? sibling
        : undefined;
    };

    const prev = findSiblingInGroup(dto.prevSiblingId);
    const next = findSiblingInGroup(dto.nextSiblingId);

    if (prev === undefined || next === undefined) return dto.position;

    const brackets =
      (prev === null || prev.position < dto.position) &&
      (next === null || dto.position < next.position);

    return brackets
      ? dto.position
      : generateKeyBetween(prev?.position ?? null, next?.position ?? null);
  }

  /* A category change takes the whole subtree with it. This is the only thing
     keeping a parent and its children in the same category, which is in turn
     what lets a section render without drawing ancestors from the other one. */
  private async carrySubtree(
    projects: Project[],
    moved: Project,
    status: ProjectStatus,
  ) {
    if (status === moved.projectStatus) return;

    const subtree = this.collectSubtreeIds(projects, moved.id);
    subtree.delete(moved.id);

    if (subtree.size === 0) return;

    await this.projectsRepository.updateProjects(
      { id: { in: [...subtree] } },
      { projectStatus: status },
    );
  }

  private async rebalance(
    userId: string,
    dto: MoveProjectDto,
    status: ProjectStatus,
  ) {
    const group = this.sortProjectsByPosition(
      await this.projectsRepository.findProjects({
        userId,
        parentProjectId: dto.parentProjectId,
        projectStatus: status,
      }),
    );

    const longest = group.reduce(
      (length, project) => Math.max(length, project.position.length),
      0,
    );

    if (longest < REBALANCE_KEY_LENGTH) return [];

    const keys = generateNKeysBetween(null, null, group.length);

    await runInBatches(
      group.map(
        (project, index) => () =>
          this.projectsRepository.updateProject(
            { id: project.id },
            { position: keys[index] },
          ),
      ),
    );
  }

  private sortProjectsByPosition(projects: Project[]) {
    return [...projects].sort((left, right) =>
      left.position === right.position
        ? left.id.localeCompare(right.id)
        : left.position < right.position
          ? -1
          : 1,
    );
  }

  private collectSubtreeIds(projects: Project[], rootId: string) {
    const childrenOf = new Map<string, string[]>();

    for (const project of projects) {
      const parentId = project.parentProjectId;
      if (parentId === null) continue;

      childrenOf.set(parentId, [
        ...(childrenOf.get(parentId) ?? []),
        project.id,
      ]);
    }

    const subtree = new Set<string>();
    const pending = [rootId];

    while (pending.length > 0) {
      const id = pending.pop() as string;
      if (subtree.has(id)) continue;

      subtree.add(id);
      pending.push(...(childrenOf.get(id) ?? []));
    }

    return subtree;
  }

  private buildRejection(message: string, code = ErrorCode.VALIDATION_FAILED) {
    return new PlatchError({
      type: ErrorType.CLIENT_UNEXPECTED,
      code,
      message,
    });
  }
}
