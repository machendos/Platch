import { Injectable } from '@nestjs/common';
import { Color, Prisma, Project } from '../../prisma-client';
import { TimeComponentWithSlots } from '../time-component/time.component.repository';
import { PrismaService } from '../system/database/prisma.service';

export interface ProjectWithTimeSlots extends Project {
  timeComponents: TimeComponentWithSlots[];
  color: Color | null;
}

@Injectable()
export class ProjectsRepository {
  constructor(private prismaService: PrismaService) {}

  async getProjectsWithTimeSlots(
    where: Prisma.ProjectWhereInput,
  ): Promise<ProjectWithTimeSlots[]> {
    return this.prismaService.project.findMany({
      where,
      include: {
        timeComponents: { include: { recurringTimeSlots: true } },
        color: true,
      },
    });
  }

  getColorsForUser(userId: string) {
    return this.prismaService.color.findMany({
      include: {
        projects: { where: { userId }, select: { id: true, name: true } },
      },
    });
  }

  createProject(data: Prisma.ProjectCreateInput) {
    return this.prismaService.project.create({ data });
  }

  updateProject(
    where: Prisma.ProjectWhereUniqueInput,
    data: Prisma.ProjectUpdateInput,
  ) {}

  deleteProject(where: Prisma.ProjectWhereUniqueInput) {}
}
