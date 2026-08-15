import { Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma-client';
import { PrismaService } from '../system/database/prisma.service';

@Injectable()
export class ProjectsRepository {
  constructor(private prismaService: PrismaService) {}

  getProjectsWithTimeSlots(where: Prisma.ProjectWhereInput) {
    return this.prismaService.project.findMany({
      where,
      include: { timeComponents: { include: { recurringTimeSlots: true } } },
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
