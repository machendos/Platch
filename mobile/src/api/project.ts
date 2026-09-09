import { useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { CreateProjectDto } from './sdk/structures/CreateProjectDto';
import type { MoveProjectDto } from './sdk/structures/MoveProjectDto';
import type { ProjectWithTimeSlots } from './sdk/structures/ProjectWithTimeSlots';
import type { UpdateProjectDto } from './sdk/structures/UpdateProjectDto';
import { apiClient, getConnection } from '../system/api.client';

/* Reading and writing projects. Every caller goes through here, so keeping the
   cache correct after a write is this file's job rather than something each
   caller has to remember. */

export const PROJECTS_KEY = ['projects'] as const;

export const useProjectsQuery = () => {
  const { data } = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async () =>
      (await apiClient.project.getProjectsByUser(getConnection())).projects,
  });

  return data ?? [];
};

export const useReloadProjects = () => {
  const client = useQueryClient();

  return useCallback(
    () => client.invalidateQueries({ queryKey: PROJECTS_KEY }),
    [client],
  );
};

const optimistically = async (
  client: QueryClient,
  change: (projects: ProjectWithTimeSlots[]) => ProjectWithTimeSlots[],
) => {
  /* Cancelled first, or a fetch already in flight lands afterwards and undoes
     the write. */
  await client.cancelQueries({ queryKey: PROJECTS_KEY });

  const previous = client.getQueryData<ProjectWithTimeSlots[]>(PROJECTS_KEY);
  client.setQueryData<ProjectWithTimeSlots[]>(PROJECTS_KEY, (current) =>
    change(current ?? []),
  );

  return previous;
};

type Reorder = (
  projects: ProjectWithTimeSlots[],
  dto: MoveProjectDto,
) => ProjectWithTimeSlots[];

/* `reorder` is passed in rather than imported: what a move does to the list is
   the dispatcher's business, and this file only knows how to show it early and
   put it back if the server refuses.

   Moves of one project coalesce, which the query layer does not do for us —
   scoped mutations serialise but still send every queued one, and a project
   dragged five times should tell the server where it ended up rather than
   where it passed through. */
export const useMoveProject = (reorder: Reorder) => {
  const client = useQueryClient();
  const inFlight = useRef(new Set<string>()).current;
  const pending = useRef(new Map<string, MoveProjectDto>()).current;

  const send = useMutation({
    mutationFn: (dto: MoveProjectDto) =>
      apiClient.project.move.moveProject(getConnection(), dto),
  });

  return useCallback(
    async (dto: MoveProjectDto) => {
      const previous = await optimistically(client, (projects) =>
        reorder(projects, dto),
      );

      const { id } = dto;
      pending.set(id, dto);
      if (inFlight.has(id)) return;

      inFlight.add(id);

      try {
        while (pending.has(id)) {
          const queued = pending.get(id) as MoveProjectDto;
          pending.delete(id);
          await send.mutateAsync(queued);
        }
      } catch (error) {
        console.error('Move failed, restoring the list', error);
        if (previous) client.setQueryData(PROJECTS_KEY, previous);
      } finally {
        inFlight.delete(id);
        pending.delete(id);
        await client.invalidateQueries({ queryKey: PROJECTS_KEY });
      }
    },
    [client, inFlight, pending, reorder, send],
  );
};

export const useSaveProject = () => {
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: PROJECTS_KEY });

  const create = useMutation({
    mutationFn: (dto: CreateProjectDto) =>
      apiClient.project.createProject(getConnection(), dto),
    onSettled: settle,
  });

  const update = useMutation({
    mutationFn: (dto: UpdateProjectDto) =>
      apiClient.project.updateProject(getConnection(), dto),
    onSettled: settle,
  });

  return {
    createProject: create.mutateAsync,
    updateProject: update.mutateAsync,
  };
};
