import { Injectable } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import { generateKeyBetween } from 'fractional-indexing';
import { CreateProject } from './dto/create.project.dto';
import { UpdateProject } from './dto/update.project.dto';
import {
  ProjectsRepository,
  ProjectsSnapshot,
  ProjectWithTimeSlots,
} from './project.repository';
import { RecurringTimeComponentsService } from '../recurring-time-component/recurring.time.component.service';
import { EventsService } from '../event/event.service';
import { TransactionsService } from '../system/database/transactions.service';
import { ErrorType, PlatchError } from '../system/errors/platch.error';
import {
  plainDateToDate,
  plainTimeToDate,
} from '../system/common/date.mappers';
import { ProjectStatus } from '../../prisma-client';

/* Absent and empty are different answers here: a field the caller left out is
   one it is not touching, and an explicit `null` is one it is clearing.
   Prisma reads `undefined` as "leave alone", so passing the two through
   unchanged is what makes both possible. */
const dateColumn = (value?: Temporal.PlainDate | null) =>
  value === null ? null : plainDateToDate(value);

const timeColumn = (value?: Temporal.PlainTime | null) =>
  value === null ? null : plainTimeToDate(value);

const relation = (id?: string | null) => {
  if (id === undefined) return undefined;
  return id === null ? { disconnect: true } : { connect: { id } };
};

@Injectable()
export class ProjectsService {
  constructor(
    private projectsRepository: ProjectsRepository,
    private recurringTimeComponentsService: RecurringTimeComponentsService,
    private eventsService: EventsService,
    private transactionsService: TransactionsService,
  ) {}

  async getProjectsByUser(userId: string): Promise<ProjectsSnapshot> {
    const version = await this.projectsRepository.readProjectsVersion(userId);

    return {
      version,
      projects: await this.projectsRepository.getProjectsWithTimeSlots({
        userId,
      }),
    };
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
      projectType: dto.projectType,

      timeNeededMinutes: dto.timeNeededMinutes,
      minBlockMinutes: dto.minBlockMinutes,
      repetitionsNeeded: dto.repetitionsNeeded,

      earliestDate: plainDateToDate(dto.earliestDate),
      earliestTime: plainTimeToDate(dto.earliestTime),
      deadlineDate: plainDateToDate(dto.deadlineDate),
      deadlineTime: plainTimeToDate(dto.deadlineTime),

      originalTimezone: dto.originalTimezone,

      user: { connect: { id: userId } },
      parentProject: dto.parentProjectId
        ? { connect: { id: dto.parentProjectId } }
        : undefined,
      color: dto.colorId ? { connect: { id: dto.colorId } } : undefined,
    });

    await Promise.all(
      dto.recurringTimeComponents.map((component) =>
        this.recurringTimeComponentsService.createRecurringTimeComponent({
          ...component,
          projectId: createdProject.id,
        }),
      ),
    );

    await Promise.all(
      dto.events.map((event) =>
        this.eventsService.createEvent({
          ...event,
          projectId: createdProject.id,
        }),
      ),
    );

    await this.projectsRepository.bumpProjectsVersion(userId);

    return this.projectsRepository.getProjectWithTimeSlots({
      id: createdProject.id,
    });
  }

  async updateProject(
    dto: UpdateProject,
    userId: string,
  ): Promise<ProjectWithTimeSlots> {
    return this.transactionsService.executeInTransaction({}, async () => {
      const project = await this.projectsRepository.getProjectWithTimeSlots({
        id: dto.id,
        userId,
      });

      const events = await this.eventsService.getEventsOfProject(
        userId,
        dto.id,
      );

      const unexistingEventIds = [
        ...dto.updatedEvents.map(({ id }) => id),
        ...dto.deletedEventIds,
      ].filter((id) => events.every(({ id: itToTest }) => itToTest !== id));

      if (unexistingEventIds.length > 0) {
        throw new PlatchError({
          type: ErrorType.CLIENT_UNEXPECTED,
          message: 'Unexisting events to edit/delete',
          extraData: { unexistingEventIds },
        });
      }

      const unexistingTimeComponentIds = [
        ...dto.updatedRecurringTimeComponents.map(({ id }) => id),
        ...dto.deletedRecurringTimeComponentIds,
      ].filter((id) =>
        project.recurringTimeComponents.every(
          ({ id: itToTest }) => itToTest !== id,
        ),
      );

      if (unexistingTimeComponentIds.length > 0) {
        throw new PlatchError({
          type: ErrorType.CLIENT_UNEXPECTED,
          message: 'Unexisting time components to edit/delete',
          extraData: { unexistingTimeComponentIds },
        });
      }

      await this.projectsRepository.updateProject(
        { id: dto.id },
        {
          name: dto.name,
          goal: dto.goal,
          context: dto.context,
          projectType: dto.projectType,
          timeNeededMinutes: dto.timeNeededMinutes,
          minBlockMinutes: dto.minBlockMinutes,
          repetitionsNeeded: dto.repetitionsNeeded,
          earliestDate: dateColumn(dto.earliestDate),
          earliestTime: timeColumn(dto.earliestTime),
          deadlineDate: dateColumn(dto.deadlineDate),
          deadlineTime: timeColumn(dto.deadlineTime),
          originalTimezone: dto.originalTimezone,

          // TODO: status can be edited with children follow
          /* Category and parent are not editable here. They decide each other —
               a parent owns its children's category — and only the move endpoint
               cascades that to the subtree, holds the lock, and bumps the version a
               client needs to accept the result. */
          color: relation(dto.colorId),
        },
      );

      for (const id of dto.deletedRecurringTimeComponentIds ?? [])
        await this.recurringTimeComponentsService.deleteRecurringTimeComponent(
          id,
        );

      for (const component of dto.updatedRecurringTimeComponents ?? [])
        await this.recurringTimeComponentsService.updateRecurringTimeComponent(
          component,
        );

      for (const component of dto.createdRecurringTimeComponents ?? [])
        await this.recurringTimeComponentsService.createRecurringTimeComponent({
          ...component,
          projectId: dto.id,
        });

      for (const id of dto.deletedEventIds ?? [])
        await this.eventsService.deleteEvent(id);

      for (const event of dto.updatedEvents ?? [])
        await this.eventsService.updateEvent(event);

      for (const event of dto.createdEvents ?? [])
        await this.eventsService.createEvent({ ...event, projectId: dto.id });

      await this.projectsRepository.bumpProjectsVersion(userId);

      return this.projectsRepository.getProjectWithTimeSlots({ id: dto.id });
    });
  }

  deleteProject() {}
}
