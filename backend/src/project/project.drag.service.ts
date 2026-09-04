import { Injectable } from '@nestjs/common';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { $Enums, Project } from '../../prisma-client';
import { TransactionsService } from '../system/database/transactions.service';
import { ErrorCode } from '../system/errors/error.code';
import { ErrorType, PlatchError } from '../system/errors/platch.error';
import { MoveProjectDto } from './dto/move.project.dto';
import { ProjectsRepository } from './project.repository';

type ProjectStatus = $Enums.ProjectStatus;

export const REBALANCE_KEY_LENGTH = 80;

@Injectable()
export class ProjectDragService {
  constructor(
    private projectsRepository: ProjectsRepository,
    private transactionsService: TransactionsService,
  ) {}

  async moveProject(dto: MoveProjectDto, userId: string): Promise<Project[]> {
    return this.transactionsService.executeInTransaction({}, async () => {
      await this.transactionsService.acquireLock(`project-chain:${userId}`);

      const projects = await this.projectsRepository.findProjects({ userId });
      const moved = this.validateMove(projects, dto);
      const status = dto.projectStatus ?? moved.projectStatus;

      const changed = new Map<string, Project>();

      const position = this.resolvePosition(projects, dto, status);
      changed.set(
        dto.id,
        await this.projectsRepository.updateProject(
          { id: dto.id },
          {
            position,
            parentProjectId: dto.parentProjectId,
            projectStatus: status,
          },
        ),
      );

      if (status !== moved.projectStatus) {
        for (const project of await this.carrySubtree(projects, moved, status))
          changed.set(project.id, project);
      }

      for (const project of await this.rebalance(userId, dto, status))
        changed.set(project.id, project);

      return [...changed.values()];
    });
  }

  private validateMove(projects: Project[], dto: MoveProjectDto) {
    const moved = projects.find((project) => project.id === dto.id);

    if (!moved) {
      throw this.buildRejection('Project not found.', ErrorCode.NOT_FOUND);
    }

    if (dto.parentProjectId !== null) {
      const parent = projects.find(
        (project) => project.id === dto.parentProjectId,
      );

      if (!parent) throw this.buildRejection('The new parent does not exist.');

      if (this.collectSubtreeIds(projects, dto.id).has(parent.id)) {
        throw this.buildRejection('A project cannot be moved inside itself.');
      }
    }

    return moved;
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

  private async carrySubtree(
    projects: Project[],
    moved: Project,
    status: ProjectStatus,
  ) {
    const subtree = this.collectSubtreeIds(projects, moved.id);
    subtree.delete(moved.id);

    if (subtree.size > 0) {
      await this.projectsRepository.updateProjects(
        { id: { in: [...subtree] } },
        { projectStatus: status },
      );
    }

    const changed: Project[] = [];

    for (const parentId of [moved.id, ...subtree]) {
      const children = projects.filter(
        (project) => project.parentProjectId === parentId,
      );
      const arriving = children.filter(
        (child) => child.projectStatus !== status,
      );
      const settled = children.filter(
        (child) => child.projectStatus === status,
      );

      if (arriving.length === 0 || settled.length === 0) continue;

      const tail = this.sortProjectsByPosition(settled).at(-1) as Project;
      const keys = generateNKeysBetween(tail.position, null, arriving.length);

      for (const [index, child] of this.sortProjectsByPosition(arriving).entries()) {
        changed.push(
          await this.projectsRepository.updateProject(
            { id: child.id },
            { position: keys[index] },
          ),
        );
      }
    }

    return changed;
  }

  /* Only ever triggered by a move into the group, so a group nobody reorders
     never pays for keys it is not growing. Which also means there is no
     background pass: the write that lengthens a key is the write that pays. */
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
    const changed: Project[] = [];

    for (const [index, project] of group.entries()) {
      changed.push(
        await this.projectsRepository.updateProject(
          { id: project.id },
          { position: keys[index] },
        ),
      );
    }

    return changed;
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
