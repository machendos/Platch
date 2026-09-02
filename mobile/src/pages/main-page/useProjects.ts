import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoveProjectDto } from '../../api/structures/MoveProjectDto';
import type { ProjectWithTimeSlots } from '../../api/structures/ProjectWithTimeSlots';
import { apiClient, getConnection } from '../../system/api.client';
import { applyMove } from './dispatcher/projects/applyMove';

/* Extracted from MainPage now that it carries something: the move applies
   locally, waits, and puts the old list back if the server refuses. Loading
   alone was four lines and belonged inline, next to the current user's fetch. */
export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectWithTimeSlots[]>([]);

  /* Every load is numbered, and a response from an older one is dropped. A
     GET in flight when a move lands would otherwise arrive afterwards holding
     the state from before it and quietly undo it on screen. */
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const attempt = (generation.current += 1);
    const loaded = await apiClient.project.getProjectsByUser(getConnection());

    if (attempt === generation.current) setProjects(loaded);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const move = useCallback(
    async (dto: MoveProjectDto) => {
      let restore: ProjectWithTimeSlots[] = [];

      setProjects((current) => {
        restore = current;
        return applyMove(current, dto);
      });

      /* Claims the next generation immediately, so a load already in flight
         cannot land on top of the optimistic list. */
      generation.current += 1;

      try {
        await apiClient.project.move.moveProject(getConnection(), dto);
      } catch (error) {
        setProjects(restore);
        throw error;
      }

      /* The server may have done more than the optimistic pass — splicing two
         chains a section change merged, for one — so the truth is read back
         rather than assumed. */
      await reload();
    },
    [reload],
  );

  return { projects, reload, move };
};
