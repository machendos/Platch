import { Injectable } from '@nestjs/common';
import { CreateProject } from './dto/create.project.dto';
import { UpdateProjectDto } from './dto/update.project.dto';
import { ProjectsRepository } from './project.repository';
import { MoveProjectDto } from './dto/move.project.dto';
import { planChainWrites } from './chain.writes';
import { TransactionsService } from '../system/database/transactions.service';
import { ErrorCode } from '../system/errors/error.code';
import { ErrorType, PlatchError } from '../system/errors/platch.error';
import { TimeComponentsService } from '../time-component/time.component.service';
import {
  plainDateToDate,
  plainTimeToDate,
} from '../system/common/date.mappers';

@Injectable()
export class ProjectsService {
  constructor(
    private projectsRepository: ProjectsRepository,
    private timeComponentsService: TimeComponentsService,
    private transactionsService: TransactionsService,
  ) {}

  getProjectsByUser(userId: string) {
    return this.projectsRepository.getProjectsWithTimeSlots({ userId });
  }

  async getProjectColors(userId: string) {
    const colors = await this.projectsRepository.getColorsForUser(userId);

    return colors.map((color) => ({
      id: color.id,
      hexCode: color.hexCode,
      placement: color.placement,
      projects: color.projects.map(({ id, name }) => ({ id, name })),
    }));
  }

  async createProject(dto: CreateProject, userId: string) {
    const createdProject = await this.projectsRepository.createProject({
      name: dto.name,
      goal: dto.goal,
      context: dto.context,

      projectStatus: dto.projectStatus,

      timeNeededMinutes: dto.timeNeededMinutes,
      minBlockMinutes: dto.minBlockMinutes,
      repetitionsNeeded: dto.repetitionsNeeded,

      earliestDate: plainDateToDate(dto.earliestDate),
      earliestTime: plainTimeToDate(dto.earliestTime),
      deadlineDate: plainDateToDate(dto.deadlineDate),
      deadlineTime: plainTimeToDate(dto.deadlineTime),

      flexibleTimezone: dto.flexibleTimezone,
      originalTimezone: dto.originalTimezone,

      prevProjectInHierarchy: dto.prevProjectIdInHierarchy
        ? { connect: { id: dto.prevProjectIdInHierarchy } }
        : undefined,

      user: { connect: { id: userId } },
      parentProject: dto.parentProjectId
        ? { connect: { id: dto.parentProjectId } }
        : undefined,
      color: dto.colorId ? { connect: { id: dto.colorId } } : undefined,
    });

    const createdTimeComponents = await Promise.all(
      dto.timeComponents.map((timeComponent) =>
        this.timeComponentsService.createTimeComponent({
          ...timeComponent,
          projectId: createdProject.id,
        }),
      ),
    );

    return { ...createdProject, timeComponents: createdTimeComponents };
  }

  /**
   * Reorders, reparents and moves a project between sections.
   *
   * The whole thing is one transaction because a half-applied move leaves the
   * list in a state nothing can repair on its own: the unique index means the
   * writes are only legal in a particular order, so stopping midway can leave
   * two projects claiming one predecessor, or none claiming it at all.
   *
   * The lock is per user rather than per chain. Two moves in the same list race
   * each other for the unique index, and a move can touch several lists at once
   * when a subtree changes section — cheap to serialise, and one user's moves
   * are one person's clicks.
   */
  async moveProject(dto: MoveProjectDto, userId: string) {
    await this.transactionsService.executeInTransaction({}, async () => {
      await this.transactionsService.acquireLock(`project-chain:${userId}`);

      /* Read inside the lock, so the plan is built from a state no other move
         can be changing underneath it. */
      const projects = await this.projectsRepository.getChainNodes(userId);

      if (!projects.some((project) => project.id === dto.id)) {
        throw new PlatchError({
          type: ErrorType.CLIENT_UNEXPECTED,
          code: ErrorCode.NOT_FOUND,
          message: 'Project not found.',
        });
      }

      const plan = planChainWrites(projects, dto);

      if (plan.statusChange) {
        await this.projectsRepository.updateProjectStatuses(
          plan.statusChange.ids,
          plan.statusChange.projectStatus,
        );
      }

      /* In order, and one at a time: the plan nulls a pointer before anything
         claims it, and running these concurrently would lose that ordering. */
      for (const write of plan.writes) {
        await this.projectsRepository.applyChainWrite(write);
      }
    });
  }

  updateProject(dto: UpdateProjectDto) {}

  deleteProject() {}
}
