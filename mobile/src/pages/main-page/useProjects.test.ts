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

const makeDeferred = () => {
  let settle: (rows: unknown[]) => void = () => {};
  let fail: (error: unknown) => void = () => {};
  const promise = new Promise<unknown[]>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  return { promise, settle, fail };
};

describe('useProjects', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getProjectsByUser.mockResolvedValue([
      makeProject('a', 'a1'),
      makeProject('b', 'a2'),
    ]);
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
    moveProject.mockReturnValueOnce(first.promise).mockResolvedValue([]);

    const { result } = await renderProjects();

    act(() => result.current.move(makeMove('a', 'a3')));
    act(() => result.current.move(makeMove('a', 'a4')));
    act(() => result.current.move(makeMove('a', 'a5')));

    expect(moveProject).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.settle([]);
    });

    await waitFor(() => expect(moveProject).toHaveBeenCalledTimes(2));
    expect(moveProject.mock.calls[1][1].position).toBe('a5');
  });

  it('sends moves of different projects in parallel', async () => {
    moveProject.mockReturnValue(makeDeferred().promise);

    const { result } = await renderProjects();

    act(() => result.current.move(makeMove('a', 'a3')));
    act(() => result.current.move(makeMove('b', 'a4')));

    expect(moveProject).toHaveBeenCalledTimes(2);
  });

  it('keeps a move made while a failing one was in flight', async () => {
    const first = makeDeferred();
    moveProject.mockReturnValueOnce(first.promise).mockResolvedValue([]);

    const { result } = await renderProjects();

    act(() => result.current.move(makeMove('a', 'a3')));
    act(() => result.current.move(makeMove('a', 'a9')));

    await act(async () => {
      first.fail(new Error('network'));
    });

    /* Generous: the first move exhausts its retries and their backoff before
       the newer one is sent. */
    await waitFor(
      () => expect(moveProject.mock.calls.at(-1)?.[1].position).toBe('a9'),
      { timeout: 4000 },
    );
  });

  it('reloads rather than rewinding when a move fails', async () => {
    moveProject.mockRejectedValue(new Error('rejected'));

    const { result } = await renderProjects();
    getProjectsByUser.mockClear();

    act(() => result.current.move(makeMove('a', 'a3')));

    await waitFor(() => expect(getProjectsByUser).toHaveBeenCalled(), {
      timeout: 4000,
    });
  });
});
