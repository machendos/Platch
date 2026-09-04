import { Injectable } from '@nestjs/common';
import { $Enums, Project } from '../../prisma-client';
import { TransactionsService } from '../system/database/transactions.service';
import { ErrorCode } from '../system/errors/error.code';
import { ErrorType, PlatchError } from '../system/errors/platch.error';
import { MoveProjectDto } from './dto/move.project.dto';
import { ProjectsRepository } from './project.repository';
import { isDefined } from '../system/common/is.defined';

type ProjectStatus = $Enums.ProjectStatus;

@Injectable()
export class ProjectDragService {
  constructor(
    private projectsRepository: ProjectsRepository,
    private transactionsService: TransactionsService,
  ) {}

  async moveProject(dto: MoveProjectDto, userId: string) {
    await this.transactionsService.executeInTransaction({}, async () => {
      await this.transactionsService.acquireLock(`project-chain:${userId}`);

      const projects = await this.projectsRepository.findProjects({ userId });
      const moved = this.validateMove(projects, dto);
      const status = dto.projectStatus ?? moved.projectStatus;

      const oldNext = projects.find(
        (project) => project.prevProjectIdInHierarchy === dto.id,
      );
      const newNext = this.findNewNext(projects, dto, status);

      await this.detach([moved, oldNext, newNext]);

      if (oldNext) {
        await this.projectsRepository.updateProject(
          { id: oldNext.id },
          { prevProjectIdInHierarchy: moved.prevProjectIdInHierarchy },
        );
      }

      await this.projectsRepository.updateProject(
        { id: dto.id },
        {
          prevProjectIdInHierarchy: dto.prevProjectIdInHierarchy,
          parentProjectId: dto.parentProjectId,
          projectStatus: status,
        },
      );

      if (newNext) {
        await this.projectsRepository.updateProject(
          { id: newNext.id },
          { prevProjectIdInHierarchy: dto.id },
        );
      }

      if (status !== moved.projectStatus) {
        await this.carrySubtree(projects, moved, status);
      }
    });
  }

  private validateMove(projects: Project[], dto: MoveProjectDto) {
    const moved = projects.find((project) => project.id === dto.id);

    if (!moved) {
      throw this.rejected('Project not found.', ErrorCode.NOT_FOUND);
    }

    const subtree = this.subtreeOf(projects, dto.id);

    if (dto.parentProjectId !== null) {
      const parent = projects.find(
        (project) => project.id === dto.parentProjectId,
      );

      if (!parent) throw this.rejected('The new parent does not exist.');

      if (subtree.has(parent.id)) {
        throw this.rejected('A project cannot be moved inside itself.');
      }
    }

    if (dto.prevProjectIdInHierarchy !== null) {
      const target = projects.find(
        (project) => project.id === dto.prevProjectIdInHierarchy,
      );

      if (!target) throw this.rejected('The project to follow does not exist.');

      if (subtree.has(target.id)) {
        throw this.rejected(
          'A project cannot be placed after itself or its own child.',
        );
      }

      const status = dto.projectStatus ?? moved.projectStatus;

      if (
        target.parentProjectId !== dto.parentProjectId ||
        target.projectStatus !== status
      ) {
        throw this.rejected(
          'The project to follow is not in the destination list.',
        );
      }
    }

    return moved;
  }

  private findNewNext(
    projects: Project[],
    dto: MoveProjectDto,
    status: ProjectStatus,
  ) {
    if (dto.prevProjectIdInHierarchy !== null) {
      return projects.find(
        (project) =>
          project.prevProjectIdInHierarchy === dto.prevProjectIdInHierarchy &&
          project.id !== dto.id,
      );
    }

    const subtree = this.subtreeOf(projects, dto.id);

    return projects.find(
      (project) =>
        project.prevProjectIdInHierarchy === null &&
        project.parentProjectId === dto.parentProjectId &&
        project.projectStatus === status &&
        !subtree.has(project.id),
    );
  }

  private async detach(projects: (Project | undefined)[]) {
    const projectIds = projects.filter(isDefined).map(({ id }) => id);
    if (projectIds.length) {
      await this.projectsRepository.updateProjects(
        { id: { in: projectIds } },
        { prevProjectIdInHierarchy: null },
      );
    }
  }

  private async carrySubtree(
    projects: Project[],
    moved: Project,
    status: ProjectStatus,
  ) {
    const subtree = this.subtreeOf(projects, moved.id);

    await this.projectsRepository.updateProjects(
      { id: { in: [...subtree] } },
      { projectStatus: status },
    );

    for (const parentId of subtree) {
      const children = projects.filter(
        (project) => project.parentProjectId === parentId,
      );
      const arriving = children.filter(
        (child) => child.projectStatus !== status,
      );
      const settled = children.filter(
        (child) => child.projectStatus === status,
      );

      const head = this.headOf(arriving);
      const tail = this.tailOf(settled);

      if (!head || !tail) continue;

      await this.projectsRepository.updateProject(
        { id: head.id },
        { prevProjectIdInHierarchy: null },
      );
      await this.projectsRepository.updateProject(
        { id: head.id },
        { prevProjectIdInHierarchy: tail.id },
      );
    }
  }

  private subtreeOf(projects: Project[], rootId: string) {
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

  private headOf(siblings: Project[]) {
    const ids = new Set(siblings.map((sibling) => sibling.id));

    return siblings.find(
      (sibling) =>
        sibling.prevProjectIdInHierarchy === null ||
        !ids.has(sibling.prevProjectIdInHierarchy),
    );
  }

  private tailOf(siblings: Project[]) {
    const claimed = new Set(
      siblings.map((sibling) => sibling.prevProjectIdInHierarchy),
    );

    return siblings.find((sibling) => !claimed.has(sibling.id));
  }

  private rejected(message: string, code = ErrorCode.VALIDATION_FAILED) {
    return new PlatchError({
      type: ErrorType.CLIENT_UNEXPECTED,
      code,
      message,
    });
  }
}
