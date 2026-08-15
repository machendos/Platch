import { Injectable } from '@nestjs/common';
import { CreateProject } from './dto/create.project.dto';
import { UpdateProjectDto } from './dto/update.project.dto';
import { ProjectsRepository } from './project.repository';
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
  ) {}

  getProjectsByUser(userId: string) {
    return this.projectsRepository.getProjectsWithTimeSlots({ userId });
  }

  async createProject(dto: CreateProject, userId: string) {
    const createdProject = await this.projectsRepository.createProject({
      name: dto.name,
      goal: dto.goal,
      context: dto.context,

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

  updateProject(dto: UpdateProjectDto) {}

  deleteProject() {}
}
