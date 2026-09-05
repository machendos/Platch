import { generateKeyBetween } from 'fractional-indexing';
import { $Enums, Prisma, Project } from '../../prisma-client';
import { TransactionsService } from '../system/database/transactions.service';
import { MoveProjectDto } from './dto/move.project.dto';
import {
  ProjectDragService,
  REBALANCE_KEY_LENGTH,
} from './project.drag.service';
import { ProjectsRepository } from './project.repository';

type Seed = {
  id: string;
  parent?: string | null;
  position?: string;
  status?: $Enums.ProjectStatus;
};

const makeProject = ({
  id,
  parent = null,
  position = 'a0',
  status = 'ACTIVE',
}: Seed): Project =>
  ({
    id,
    parentProjectId: parent,
    position,
    projectStatus: status,
    userId: 'user',
  }) as Project;

const matches = (row: Project, where: Prisma.ProjectWhereInput) =>
  (where.userId === undefined || row.userId === where.userId) &&
  (where.parentProjectId === undefined ||
    row.parentProjectId === where.parentProjectId) &&
  (where.projectStatus === undefined ||
    row.projectStatus === where.projectStatus) &&
  (where.id === undefined ||
    (where.id as { in: string[] }).in.includes(row.id));

const buildRepository = (seed: Seed[]) => {
  let version = 0;
  const rows = seed.map(makeProject);

  const write = (row: Project, data: Record<string, string | null>) => {
    if ('position' in data) row.position = data.position as string;
    if ('parentProjectId' in data) row.parentProjectId = data.parentProjectId;
    if ('projectStatus' in data) {
      row.projectStatus = data.projectStatus as $Enums.ProjectStatus;
    }
  };

  return {
    rows,
    findProjects: jest.fn(async (where: Prisma.ProjectWhereInput) =>
      rows.filter((row) => matches(row, where)).map((row) => ({ ...row })),
    ),
    getProjectsWithTimeSlots: jest.fn(async (where: Prisma.ProjectWhereInput) =>
      rows.filter((row) => matches(row, where)).map((row) => ({ ...row })),
    ),
    bumpProjectsVersion: jest.fn(async () => (version += 1)),
    readProjectsVersion: jest.fn(async () => version),
    updateProject: jest.fn(
      async (
        where: Prisma.ProjectWhereUniqueInput,
        data: Prisma.ProjectUpdateArgs['data'],
      ) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error(`no such project ${String(where.id)}`);

        write(row, data as Record<string, string | null>);

        return { ...row };
      },
    ),
    updateProjects: jest.fn(
      async (
        where: Prisma.ProjectWhereInput,
        data: Prisma.ProjectUpdateManyArgs['data'],
      ) => {
        const affected = rows.filter((row) => matches(row, where));

        for (const row of affected) {
          write(row, data as Record<string, string | null>);
        }

        return { count: affected.length };
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

const listOrderedIds = (
  rows: Project[],
  parent: string | null,
  status: $Enums.ProjectStatus = 'ACTIVE',
) =>
  rows
    .filter(
      (row) => row.parentProjectId === parent && row.projectStatus === status,
    )
    .sort((left, right) =>
      left.position === right.position
        ? left.id.localeCompare(right.id)
        : left.position < right.position
          ? -1
          : 1,
    )
    .map((row) => row.id);

const makeMove = (
  overrides: Partial<MoveProjectDto> & { id: string },
): MoveProjectDto =>
  ({
    parentProjectId: null,
    prevSiblingId: null,
    nextSiblingId: null,
    position: 'a0',
    ...overrides,
  }) as MoveProjectDto;

describe('ProjectDragService', () => {
  const list: Seed[] = [
    { id: 'a', position: 'a1' },
    { id: 'b', position: 'a2' },
    { id: 'c', position: 'a3' },
    { id: 'd', position: 'a4' },
  ];

  describe('reordering', () => {
    it('takes the position the client computed', async () => {
      const { service, repository } = buildService(list);

      await service.moveProject(
        makeMove({
          id: 'b',
          position: generateKeyBetween('a3', 'a4'),
          prevSiblingId: 'c',
          nextSiblingId: 'd',
        }),
        'user',
      );

      expect(listOrderedIds(repository.rows, null)).toEqual(['a', 'c', 'b', 'd']);
    });

    it('moves a project to the head', async () => {
      const { service, repository } = buildService(list);

      await service.moveProject(
        makeMove({
          id: 'c',
          position: generateKeyBetween(null, 'a1'),
          nextSiblingId: 'a',
        }),
        'user',
      );

      expect(listOrderedIds(repository.rows, null)).toEqual(['c', 'a', 'b', 'd']);
    });

    it('returns the whole list, with the move already applied', async () => {
      const { service } = buildService(list);

      const returned = await service.moveProject(
        makeMove({ id: 'b', position: generateKeyBetween('a4', null) }),
        'user',
      );

      expect(returned.projects.map((row) => row.id).sort()).toEqual([
        'a',
        'b',
        'c',
        'd',
      ]);
      expect(returned.projects.find((row) => row.id === 'b')?.position).toBe(
        generateKeyBetween('a4', null),
      );
    });

    it('labels each snapshot with a version that only ever climbs', async () => {
      const { service } = buildService(list);

      const first = await service.moveProject(
        makeMove({ id: 'b', position: 'a5' }),
        'user',
      );
      const second = await service.moveProject(
        makeMove({ id: 'c', position: 'a6' }),
        'user',
      );

      expect(second.version).toBeGreaterThan(first.version);
    });

    it('takes the lock before reading', async () => {
      const { service, transactions, repository } = buildService(list);

      await service.moveProject(makeMove({ id: 'b', position: 'a5' }), 'user');

      expect(transactions.acquireLock).toHaveBeenCalledWith(
        'project-chain:user',
      );
      expect(transactions.acquireLock.mock.invocationCallOrder[0]).toBeLessThan(
        repository.findProjects.mock.invocationCallOrder[0],
      );
    });
  });

  describe('a key computed against keys that have since moved', () => {
    it('resolves from the sibling ids when they no longer bracket it', async () => {
      const { service, repository } = buildService(list);

      await service.moveProject(
        makeMove({
          id: 'd',
          position: 'a15',
          prevSiblingId: 'a',
          nextSiblingId: 'b',
        }),
        'user',
      );

      expect(listOrderedIds(repository.rows, null)).toEqual(['a', 'd', 'b', 'c']);
    });

    it('keeps the key when the siblings still bracket it', async () => {
      const { service, repository } = buildService(list);
      const position = generateKeyBetween('a1', 'a2');

      await service.moveProject(
        makeMove({ id: 'd', position, prevSiblingId: 'a', nextSiblingId: 'b' }),
        'user',
      );

      expect(
        repository.rows.find((row) => row.id === 'd')?.position,
      ).toBe(position);
    });

    it('takes the key as sent when a named sibling has left the group', async () => {
      const { service, repository } = buildService(list);

      await service.moveProject(
        makeMove({
          id: 'd',
          position: 'a15',
          prevSiblingId: 'a',
          nextSiblingId: 'ghost',
        }),
        'user',
      );

      expect(repository.rows.find((row) => row.id === 'd')?.position).toBe(
        'a15',
      );
    });
  });

  describe('reparenting', () => {
    const tree: Seed[] = [
      { id: 'sport', position: 'a1' },
      { id: 'workout', parent: 'sport', position: 'a1' },
      { id: 'legs', parent: 'workout', position: 'a1' },
      { id: 'errands', position: 'a2' },
    ];

    it('keeps its children', async () => {
      const { service, repository } = buildService(tree);

      await service.moveProject(
        makeMove({ id: 'workout', position: generateKeyBetween('a1', 'a2') }),
        'user',
      );

      expect(listOrderedIds(repository.rows, null)).toEqual([
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
        service.moveProject(makeMove(overrides), 'user'),
      ).rejects.toThrow(/inside itself/);
    });

    it('refuses a parent that does not exist', async () => {
      const { service } = buildService(tree);

      await expect(
        service.moveProject(
          makeMove({ id: 'errands', parentProjectId: 'ghost' }),
          'user',
        ),
      ).rejects.toThrow(/new parent does not exist/);
    });

    it('refuses a project that does not exist', async () => {
      const { service } = buildService(tree);

      await expect(
        service.moveProject(makeMove({ id: 'ghost' }), 'user'),
      ).rejects.toThrow(/not found/);
    });
  });

  describe('crossing sections', () => {
    it('carries the whole subtree across', async () => {
      const { service, repository } = buildService([
        { id: 'sport', position: 'a1' },
        { id: 'workout', parent: 'sport', position: 'a1' },
        { id: 'legs', parent: 'workout', position: 'a1' },
      ]);

      await service.moveProject(
        makeMove({
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

    it('appends arrivals after the members already there', async () => {
      const { service, repository } = buildService([
        { id: 'workout', position: 'a1' },
        { id: 'legs', parent: 'workout', position: 'a1' },
        { id: 'shoulders', parent: 'workout', position: 'a2' },
        { id: 'arms', parent: 'workout', position: 'a1', status: 'BACKLOG' },
        { id: 'abs', parent: 'workout', position: 'a2', status: 'BACKLOG' },
      ]);

      await service.moveProject(
        makeMove({ id: 'workout', projectStatus: 'BACKLOG' }),
        'user',
      );

      expect(listOrderedIds(repository.rows, 'workout', 'BACKLOG')).toEqual([
        'arms',
        'abs',
        'legs',
        'shoulders',
      ]);
    });

    it('leaves a descendant already in the destination ahead of the arrivals', async () => {
      const { service, repository } = buildService([
        { id: 'workout', position: 'a1' },
        { id: 'cardio', parent: 'workout', position: 'a1' },
        { id: 'stretching', parent: 'workout', position: 'a2' },
        { id: 'legs', parent: 'workout', position: 'a1', status: 'BACKLOG' },
      ]);

      await service.moveProject(
        makeMove({ id: 'workout', projectStatus: 'BACKLOG' }),
        'user',
      );

      expect(listOrderedIds(repository.rows, 'workout', 'BACKLOG')).toEqual([
        'legs',
        'cardio',
        'stretching',
      ]);
    });
  });

  describe('rebalancing', () => {
    it('renumbers the group once a key grows past the threshold', async () => {
      const long = `a0${'V'.repeat(REBALANCE_KEY_LENGTH)}`;
      const { service, repository } = buildService([
        { id: 'a', position: 'a0' },
        { id: 'b', position: long },
        { id: 'c', position: 'a1' },
      ]);

      const changed = await service.moveProject(
        makeMove({ id: 'a', position: 'a0' }),
        'user',
      );

      expect(
        repository.rows.every((row) => row.position.length < 10),
      ).toBe(true);
      expect(listOrderedIds(repository.rows, null)).toEqual(['a', 'b', 'c']);
      expect(changed.projects.map((row) => row.id).sort()).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('leaves short keys alone', async () => {
      const { service, repository } = buildService(list);

      await service.moveProject(makeMove({ id: 'a', position: 'a1' }), 'user');

      expect(repository.rows.map((row) => row.position)).toEqual([
        'a1',
        'a2',
        'a3',
        'a4',
      ]);
    });
  });
});
