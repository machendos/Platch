import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoveProjectDto } from '../../api/structures/MoveProjectDto';
import type { ProjectWithTimeSlots } from '../../api/structures/ProjectWithTimeSlots';
import { apiClient, getConnection } from '../../system/api.client';
import {
  applyMove,
  applyServerRows,
} from './dispatcher/projects/dnd/applyMove';

const SEND_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 400;

const wait = (ms: number) =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectWithTimeSlots[]>([]);

  const generation = useRef(0);

  const inFlight = useRef(new Set<string>());
  const pending = useRef(new Map<string, MoveProjectDto>());

  const reload = useCallback(async () => {
    const attempt = (generation.current += 1);
    const loaded = await apiClient.project.getProjectsByUser(getConnection());

    if (attempt === generation.current) setProjects(loaded);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const send = useCallback(async (dto: MoveProjectDto) => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt += 1) {
      try {
        return await apiClient.project.move.moveProject(getConnection(), dto);
      } catch (error) {
        lastError = error;
        if (attempt < SEND_ATTEMPTS) await wait(RETRY_BACKOFF_MS * attempt);
      }
    }

    throw lastError;
  }, []);

  const drain = useCallback(
    async (id: string) => {
      while (pending.current.has(id)) {
        const dto = pending.current.get(id) as MoveProjectDto;
        pending.current.delete(id);

        try {
          const changed = await send(dto);
          generation.current += 1;
          setProjects((current) => applyServerRows(current, changed));
        } catch (error) {
          /* Not `break`, and nothing cleared: the user may have dragged this
             project again while the failed request was in flight, and that
             newer intent is now sitting in the slot. Reload puts the list back
             on server truth, then the loop sends it. */
          console.error('Move failed, reloading projects', error);
          await reload();
        }
      }

      inFlight.current.delete(id);
    },
    [reload, send],
  );

  const move = useCallback(
    (dto: MoveProjectDto) => {
      setProjects((current) => applyMove(current, dto));
      generation.current += 1;

      pending.current.set(dto.id, dto);

      if (inFlight.current.has(dto.id)) return;

      inFlight.current.add(dto.id);
      void drain(dto.id);
    },
    [drain],
  );

  return { projects, reload, move };
};
