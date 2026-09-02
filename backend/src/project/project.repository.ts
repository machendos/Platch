import { Injectable } from '@nestjs/common';
import { Color, Prisma, Project } from '../../prisma-client';
import { TimeComponentWithSlots } from '../time-component/time.component.repository';
import { Repository } from '../system/database/repository';
import { ChainWrite, ProjectStatus } from './chain.writes';

export interface ProjectWithTimeSlots extends Project {
  timeComponents: TimeComponentWithSlots[];
  color: Color | null;
}

/* Extends Repository so every read and write below goes through `this.db`,
   which is the ambient transaction when there is one. A move touches several
   rows and must be all-or-nothing; reaching for the plain client here would
   quietly opt those statements out of it. */
@Injectable()
export class ProjectsRepository extends Repository {
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

  updateProject(
    where: Prisma.ProjectWhereUniqueInput,
    data: Prisma.ProjectUpdateInput,
  ) {
    return this.db.project.update({ where, data });
  }

  /* Written out field by field rather than spreading the plan's write: the
     scalar foreign keys only exist on Prisma's unchecked update input, and a
     spread would also carry `id` into `data`, which it rejects. Neither shows
     up in a typecheck, because a spread of a variable skips excess-property
     checking. */
  applyChainWrite(write: ChainWrite) {
    return this.db.project.update({
      where: { id: write.id },
      data: {
        prevProjectIdInHierarchy: write.prevProjectIdInHierarchy,
        ...(write.parentProjectId === undefined
          ? {}
          : { parentProjectId: write.parentProjectId }),
      },
    });
  }

  updateProjectStatuses(ids: string[], projectStatus: ProjectStatus) {
    return this.db.project.updateMany({
      where: { id: { in: ids } },
      data: { projectStatus },
    });
  }

  /* Only the columns the ordering is made of. Small enough to stay unnamed
     under nestia's synthesis limit, and never returned over the wire anyway. */
  getChainNodes(userId: string) {
    return this.db.project.findMany({
      where: { userId },
      select: {
        id: true,
        parentProjectId: true,
        projectStatus: true,
        prevProjectIdInHierarchy: true,
      },
    });
  }

  deleteProject(where: Prisma.ProjectWhereUniqueInput) {}
}
