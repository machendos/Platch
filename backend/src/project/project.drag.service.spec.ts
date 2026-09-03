import { $Enums, Prisma, Project } from '../../prisma-client';
import { TransactionsService } from '../system/database/transactions.service';
import { MoveProjectDto } from './dto/move.project.dto';
import { ProjectDragService } from './project.drag.service';
import { ProjectsRepository } from './project.repository';

type Seed = {
  id: string;
  parent?: string | null;
  prev?: string | null;
  status?: $Enums.ProjectStatus;
};

const project = ({
  id,
  parent = null,
  prev = null,
  status = 'ACTIVE',
}: Seed): Project =>
  ({
    id,
    parentProjectId: parent,
    prevProjectIdInHierarchy: prev,
    projectStatus: status,
    userId: 'user',
  }) as Project;

const buildRepository = (seed: Seed[]) => {
  const rows = seed.map(project);

  const claim = (id: string, prev: string | null) => {
    if (prev === null) return;

    const claimant = rows.find(
      (row) => row.id !== id && row.prevProjectIdInHierarchy === prev,
    );

    if (claimant) {
      throw new Error(
        `unique violation: ${id} and ${claimant.id} claim ${prev}`,
      );
    }
  };

  return {
    rows,
    findProjects: jest.fn(async () => rows.map((row) => ({ ...row }))),
    updateProject: jest.fn(
      async (
        where: Prisma.ProjectWhereUniqueInput,
        data: Prisma.ProjectUpdateArgs['data'],
      ) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error(`no such project ${String(where.id)}`);

        const next = data as Record<string, string | null>;

        if ('prevProjectIdInHierarchy' in next) {
          claim(row.id, next.prevProjectIdInHierarchy);
          row.prevProjectIdInHierarchy = next.prevProjectIdInHierarchy;
        }

        if ('parentProjectId' in next) {
          row.parentProjectId = next.parentProjectId;
        }

        if ('projectStatus' in next) {
          row.projectStatus = next.projectStatus as $Enums.ProjectStatus;
        }

        return row;
      },
    ),
    updateProjects: jest.fn(
      async (
        where: Prisma.ProjectWhereInput,
        data: Prisma.ProjectUpdateManyArgs['data'],
      ) => {
        const ids = (where.id as { in: string[] }).in;
        const next = data as Record<string, string | null>;

        for (const row of rows) {
          if (!ids.includes(row.id)) continue;

          if ('prevProjectIdInHierarchy' in next) {
            row.prevProjectIdInHierarchy = next.prevProjectIdInHierarchy;
          }

          if ('projectStatus' in next) {
            row.projectStatus = next.projectStatus as $Enums.ProjectStatus;
          }
        }

        return { count: ids.length };
      },
    ),
  };
};

const buildService = (seed: Seed[]) => {
  const repository = buildRepository(seed);
  const transactions = {
    executeInTransaction: async <T>(_: unknown, callback: () => Promise<T>) =>
      callback(),
    acquireLock: jest.fn(async () => undefined),
  };

  const service = new ProjectDragService(
    repository as unknown as ProjectsRepository,
    transactions as unknown as TransactionsService,
  );

  return { service, repository, transactions };
};

const chain = (
  rows: Project[],
  parent: string | null,
  status: $Enums.ProjectStatus = 'ACTIVE',
) => {
  const members = rows.filter(
    (row) => row.parentProjectId === parent && row.projectStatus === status,
  );
  const heads = members.filter((row) => row.prevProjectIdInHierarchy === null);

  expect(heads).toHaveLength(members.length === 0 ? 0 : 1);

  const order: string[] = [];
  let current = heads[0];

  while (current) {
    order.push(current.id);
    current = members.find(
      (row) => row.prevProjectIdInHierarchy === current.id,
    ) as Project;
  }

  expect(order).toHaveLength(members.length);

  return order;
};

const move = (overrides: Partial<MoveProjectDto> & { id: string }) => ({
  parentProjectId: null,
  prevProjectIdInHierarchy: null,
  ...overrides,
});

describe('ProjectDragService', () => {
  const list: Seed[] = [
    { id: 'a' },
    { id: 'b', prev: 'a' },
    { id: 'c', prev: 'b' },
    { id: 'd', prev: 'c' },
  ];

  describe('reordering', () => {
    it('moves a project down the list', async () => {
      const { service, repository } = buildService(list);

      await service.moveProject(
        move({ id: 'b', prevProjectIdInHierarchy: 'c' }),
        'user',
      );

      expect(chain(repository.rows, null)).toEqual(['a', 'c', 'b', 'd']);
    });

    it('moves a project up the list', async () => {
      const { service, repository } = buildService(list);

      await service.moveProject(
        move({ id: 'd', prevProjectIdInHierarchy: 'a' }),
        'user',
      );

      expect(chain(repository.rows, null)).toEqual(['a', 'd', 'b', 'c']);
    });

    it('moves a project to the head', async () => {
      const { service, repository } = buildService(list);

      await service.moveProject(move({ id: 'c' }), 'user');

      expect(chain(repository.rows, null)).toEqual(['c', 'a', 'b', 'd']);
    });

    it('releases every pointer before claiming any of them', async () => {
      const { service } = buildService(list);

      await expect(
        service.moveProject(
          move({ id: 'b', prevProjectIdInHierarchy: 'c' }),
          'user',
        ),
      ).resolves.not.toThrow();
    });

    it('takes the lock before reading', async () => {
      const { service, transactions, repository } = buildService(list);

      await service.moveProject(
        move({ id: 'b', prevProjectIdInHierarchy: 'c' }),
        'user',
      );

      expect(transactions.acquireLock).toHaveBeenCalledWith(
        'project-chain:user',
      );
      expect(transactions.acquireLock.mock.invocationCallOrder[0]).toBeLessThan(
        repository.findProjects.mock.invocationCallOrder[0],
      );
    });
  });

  describe('reparenting', () => {
    const tree: Seed[] = [
      { id: 'sport' },
      { id: 'workout', parent: 'sport' },
      { id: 'legs', parent: 'workout' },
      { id: 'errands', prev: 'sport' },
    ];

    it('closes the gap behind it and keeps its children', async () => {
      const { service, repository } = buildService(tree);

      await service.moveProject(
        move({ id: 'workout', prevProjectIdInHierarchy: 'sport' }),
        'user',
      );

      expect(chain(repository.rows, null)).toEqual([
        'sport',
        'workout',
        'errands',
      ]);
      expect(
        repository.rows.find((row) => row.id === 'legs')?.parentProjectId,
      ).toBe('workout');
    });

    it.each([
      ['inside its own subtree', { id: 'sport', parentProjectId: 'legs' }],
      ['under itself', { id: 'sport', parentProjectId: 'sport' }],
    ])('refuses to move a project %s', async (_, overrides) => {
      const { service } = buildService(tree);

      await expect(
        service.moveProject(move(overrides), 'user'),
      ).rejects.toThrow(/inside itself/);
    });

    it('refuses a destination in another list', async () => {
      const { service } = buildService(tree);

      await expect(
        service.moveProject(
          move({ id: 'errands', prevProjectIdInHierarchy: 'legs' }),
          'user',
        ),
      ).rejects.toThrow(/not in the destination list/);
    });

    it('refuses a parent that does not exist', async () => {
      const { service } = buildService(tree);

      await expect(
        service.moveProject(
          move({ id: 'errands', parentProjectId: 'ghost' }),
          'user',
        ),
      ).rejects.toThrow(/new parent does not exist/);
    });

    it('refuses a project that does not exist', async () => {
      const { service } = buildService(tree);

      await expect(
        service.moveProject(move({ id: 'ghost' }), 'user'),
      ).rejects.toThrow(/not found/);
    });
  });

  describe('the subtree it carries', () => {
    it('finds descendants whatever order the rows arrive in', async () => {
      const { service, repository } = buildService([
        { id: 'A' },
        { id: 'A11', parent: 'A1' },
        { id: 'A12', parent: 'A1' },
        { id: 'A1', parent: 'A' },
        { id: 'A2', parent: 'A' },
      ]);

      await service.moveProject(
        move({ id: 'A', projectStatus: 'BACKLOG' }),
        'user',
      );

      expect(
        repository.rows
          .filter((row) => row.projectStatus === 'BACKLOG')
          .map((row) => row.id)
          .sort(),
      ).toEqual(['A', 'A1', 'A11', 'A12', 'A2']);
    });
  });

  describe('crossing sections', () => {
    it('carries the whole subtree across', async () => {
      const { service, repository } = buildService([
        { id: 'sport' },
        { id: 'workout', parent: 'sport' },
        { id: 'legs', parent: 'workout' },
      ]);

      await service.moveProject(
        move({
          id: 'workout',
          parentProjectId: 'sport',
          projectStatus: 'BACKLOG',
        }),
        'user',
      );

      expect(
        repository.rows.filter((row) => row.projectStatus === 'BACKLOG'),
      ).toHaveLength(2);
    });

    it('splices the chains a merged group would otherwise leave two-headed', async () => {
      const { service, repository } = buildService([
        { id: 'workout' },
        { id: 'legs', parent: 'workout' },
        { id: 'shoulders', parent: 'workout', prev: 'legs' },
        { id: 'arms', parent: 'workout', status: 'BACKLOG' },
        { id: 'abs', parent: 'workout', prev: 'arms', status: 'BACKLOG' },
      ]);

      await service.moveProject(
        move({ id: 'workout', projectStatus: 'BACKLOG' }),
        'user',
      );

      expect(chain(repository.rows, 'workout', 'BACKLOG')).toEqual([
        'arms',
        'abs',
        'legs',
        'shoulders',
      ]);
    });

    it('leaves a descendant already in the destination ahead of the arrivals', async () => {
      const { service, repository } = buildService([
        { id: 'workout' },
        { id: 'cardio', parent: 'workout' },
        { id: 'stretching', parent: 'workout', prev: 'cardio' },
        { id: 'legs', parent: 'workout', status: 'BACKLOG' },
      ]);

      await service.moveProject(
        move({ id: 'workout', projectStatus: 'BACKLOG' }),
        'user',
      );

      expect(chain(repository.rows, 'workout', 'BACKLOG')).toEqual([
        'legs',
        'cardio',
        'stretching',
      ]);
    });
  });
});
