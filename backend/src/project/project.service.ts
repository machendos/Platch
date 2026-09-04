import { Injectable } from '@nestjs/common';
import { generateKeyBetween } from 'fractional-indexing';
import { CreateProject } from './dto/create.project.dto';
import { UpdateProjectDto } from './dto/update.project.dto';
import { ProjectsRepository } from './project.repository';
import { TimeComponentsService } from '../time-component/time.component.service';
import {
  plainDateToDate,
  plainTimeToDate,
} from '../system/common/date.mappers';
import { ProjectStatus } from '../../prisma-client';

@Injectable()
export class ProjectsService {
  constructor(
    private projectsRepository: ProjectsRepository,
    private timeComponentsService: TimeComponentsService,
  ) {}

  getProjectsByUser(userId: string) {
    return this.projectsRepository.getProjectsWithTimeSlots({ userId });
  }

  private async generatePositionAtEnd(
    userId: string,
    parentProjectId: string | null,
    projectStatus: ProjectStatus,
  ) {
    const siblings = await this.projectsRepository.findProjects({
      userId,
      parentProjectId,
      projectStatus,
    });

    const tail = siblings
      .map((sibling) => sibling.position)
      .sort()
      .at(-1);

    return generateKeyBetween(tail ?? null, null);
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
      position: await this.generatePositionAtEnd(
        userId,
        dto.parentProjectId ?? null,
        dto.projectStatus,
      ),

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

  updateProject(dto: UpdateProjectDto) {}

  deleteProject() {}
}
