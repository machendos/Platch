import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MoveProjectDto } from '../../api/structures/MoveProjectDto';

const getProjectsByUser = vi.fn();
const moveProject = vi.fn();

vi.mock('../../system/api.client', () => ({
  apiClient: {
    project: {
      getProjectsByUser: (...args: unknown[]) => getProjectsByUser(...args),
      move: { moveProject: (...args: unknown[]) => moveProject(...args) },
    },
  },
  getConnection: () => ({}),
}));

const { useProjects } = await import('./useProjects');

const makeProject = (id: string, position: string) => ({
  id,
  name: id,
  parentProjectId: null,
  position,
  projectStatus: 'ACTIVE',
  color: null,
  colorId: null,
  timeComponents: [],
  userId: 'user',
});

const makeMove = (id: string, position: string): MoveProjectDto =>
  ({
    id,
    parentProjectId: null,
    position,
    prevSiblingId: null,
    nextSiblingId: null,
  }) as MoveProjectDto;

const snapshot = (version: number, positionOfA = 'a1') => ({
  version,
  projects: [makeProject('a', positionOfA), makeProject('b', 'a2')],
});

const makeDeferred = () => {
  let settle: (snapshot: unknown) => void = () => {};
  let fail: (error: unknown) => void = () => {};
  const promise = new Promise<unknown>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  return { promise, settle, fail };
};

describe('useProjects', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getProjectsByUser.mockResolvedValue(snapshot(0));
    moveProject.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderProjects = async () => {
    const hook = renderHook(() => useProjects());
    await waitFor(() => expect(hook.result.current.projects).toHaveLength(2));
    return hook;
  };

  it('coalesces moves of one project into a single follow-up request', async () => {
    const first = makeDeferred();
    moveProject
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(snapshot(1));

    const { result } = await renderProjects();

    /* `move` resolves only once the queue for that project is empty, so
       awaiting the first call is what waits for the whole drain. */
    let drained!: Promise<void>;
    act(() => {
      drained = result.current.move(makeMove('a', 'a3'));
      void result.current.move(makeMove('a', 'a4'));
      void result.current.move(makeMove('a', 'a5'));
    });

    expect(moveProject).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.settle(snapshot(1));
      await drained;
    });

    expect(moveProject).toHaveBeenCalledTimes(2);
    expect(moveProject.mock.calls[1][1].position).toBe('a5');
  });

  it('sends moves of different projects in parallel', async () => {
    const forA = makeDeferred();
    const forB = makeDeferred();
    moveProject
      .mockReturnValueOnce(forA.promise)
      .mockReturnValueOnce(forB.promise);

    const { result } = await renderProjects();

    let drained!: Promise<[void, void]>;
    act(() => {
      drained = Promise.all([
        result.current.move(makeMove('a', 'a3')),
        result.current.move(makeMove('b', 'a4')),
      ]);
    });

    /* Neither has answered yet, so both being in flight is the point. */
    expect(moveProject).toHaveBeenCalledTimes(2);

    await act(async () => {
      forA.settle(snapshot(1));
      forB.settle(snapshot(1));
      await drained;
    });
  });

  it('keeps a move made while a failing one was in flight', async () => {
    const first = makeDeferred();
    moveProject
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(snapshot(1));

    const { result } = await renderProjects();

    let drained!: Promise<void>;
    act(() => {
      drained = result.current.move(makeMove('a', 'a3'));
      void result.current.move(makeMove('a', 'a9'));
    });

    await act(async () => {
      first.fail(new Error('network'));
      await drained;
    });

    expect(moveProject.mock.calls.at(-1)?.[1].position).toBe('a9');
  });

  it('ignores a snapshot older than the one already applied', async () => {
    const stale = makeDeferred();
    const fresh = makeDeferred();
    moveProject
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(fresh.promise);

    const { result } = await renderProjects();

    let drained!: Promise<[void, void]>;
    act(() => {
      drained = Promise.all([
        result.current.move(makeMove('a', 'a3')),
        result.current.move(makeMove('b', 'a4')),
      ]);
    });

    await act(async () => {
      /* The newer snapshot lands first, then the one the server produced
         before it — which is the case the version exists to survive. */
      fresh.settle(snapshot(9, 'zz'));
      stale.settle(snapshot(4, 'a1'));
      await drained;
    });

    expect(result.current.projects.find((row) => row.id === 'a')?.position).toBe(
      'zz',
    );
  });

  it('does not let a snapshot undo a drag made after it was sent', async () => {
    const slowReload = makeDeferred();
    const moveAnswer = makeDeferred();
    moveProject.mockReturnValue(moveAnswer.promise);

    const { result } = await renderProjects();

    getProjectsByUser.mockReturnValueOnce(slowReload.promise);

    let reloading!: Promise<void>;
    let drag!: Promise<void>;
    act(() => {
      reloading = result.current.reload();
      drag = result.current.move(makeMove('a', 'zz'));
    });

    await act(async () => {
      /* Newer than anything applied, but produced before the drag existed. */
      slowReload.settle(snapshot(7, 'a1'));
      await reloading;
    });

    expect(
      result.current.projects.find((row) => row.id === 'a')?.position,
    ).toBe('zz');

    await act(async () => {
      moveAnswer.settle(snapshot(8, 'zz'));
      await drag;
    });
  });

  it('reloads rather than rewinding when a move fails', async () => {
    moveProject.mockRejectedValue(new Error('rejected'));

    const { result } = await renderProjects();
    getProjectsByUser.mockClear();

    await act(async () => {
      await result.current.move(makeMove('a', 'a3'));
    });

    expect(getProjectsByUser).toHaveBeenCalled();
  });
});
