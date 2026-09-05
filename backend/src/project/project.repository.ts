import { Injectable } from '@nestjs/common';
import { Color, Prisma, Project } from '../../prisma-client';
import { TimeComponentWithSlots } from '../time-component/time.component.repository';
import { Repository } from '../system/database/repository';

export interface ProjectWithTimeSlots extends Project {
  timeComponents: TimeComponentWithSlots[];
  color: Color | null;
}

export interface ProjectsSnapshot {
  version: number;
  projects: ProjectWithTimeSlots[];
}

@Injectable()
export class ProjectsRepository extends Repository {
  async bumpProjectsVersion(userId: string): Promise<number> {
    const { projectsVersion } = await this.db.user.update({
      where: { id: userId },
      data: { projectsVersion: { increment: 1 } },
      select: { projectsVersion: true },
    });

    return projectsVersion;
  }

  async readProjectsVersion(userId: string): Promise<number> {
    const { projectsVersion } = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { projectsVersion: true },
    });

    return projectsVersion;
  }

  async getProjectsWithTimeSlots(
    where: Prisma.ProjectWhereInput,
  ): Promise<ProjectWithTimeSlots[]> {
    return this.db.project.findMany({
      where,
      include: {
        timeComponents: { include: { recurringTimeSlots: true } },
        color: true,
      },
    });
  }

  async getProjectWithTimeSlots(
    where: Prisma.ProjectWhereUniqueInput,
  ): Promise<ProjectWithTimeSlots> {
    return this.prismaService.project.findUniqueOrThrow({
      where,
      include: {
        timeComponents: { include: { recurringTimeSlots: true } },
        color: true,
      },
    });
  }

  getColorsForUser(userId: string) {
    return this.db.color.findMany({
      include: {
        projects: { where: { userId }, select: { id: true, name: true } },
      },
    });
  }

  createProject(data: Prisma.ProjectCreateInput) {
    return this.db.project.create({ data });
  }

  findProjects(where: Prisma.ProjectWhereInput): Promise<Project[]> {
    return this.db.project.findMany({ where });
  }

  async updateProject(
    where: Prisma.ProjectWhereUniqueInput,
    data: Prisma.ProjectUpdateArgs['data'],
  ): Promise<ProjectWithTimeSlots> {
    return this.db.project.update({
      where,
      data,
      include: {
        timeComponents: { include: { recurringTimeSlots: true } },
        color: true,
      },
    });
  }

  updateProjects(
    where: Prisma.ProjectWhereInput,
    data: Prisma.ProjectUpdateManyArgs['data'],
  ) {
    return this.db.project.updateMany({ where, data });
  }

  deleteProject(where: Prisma.ProjectWhereUniqueInput) {}
}
