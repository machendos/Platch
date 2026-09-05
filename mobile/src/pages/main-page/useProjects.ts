import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoveProjectDto } from '../../api/structures/MoveProjectDto';
import type { ProjectsSnapshot } from '../../api/structures/ProjectsSnapshot';
import type { ProjectWithTimeSlots } from '../../api/structures/ProjectWithTimeSlots';
import { apiClient, getConnection } from '../../system/api.client';
import { applyMove } from './dispatcher/projects/dnd/applyMove';

const SEND_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 400;

const wait = (ms: number) =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectWithTimeSlots[]>([]);

  /* Two different questions, so two counters.

     `serverVersion` orders snapshots against each other. Every response is the
     whole list, and they can arrive in a different order than the server
     produced them, so an older one landing last would undo a newer one. The
     server stamps each snapshot inside the transaction that wrote it.

     `localVersion` counts optimistic edits. A snapshot can be the newest the
     server has and still be older than the drag the user just did, because
     that drag has not reached the server yet — so a response is only allowed
     to replace the list if nothing was dragged since it was sent. */
  const serverVersion = useRef(-1);
  const localVersion = useRef(0);

  const inFlight = useRef(new Set<string>());
  const pending = useRef(new Map<string, MoveProjectDto>());

  const applySnapshot = useCallback(
    (snapshot: ProjectsSnapshot, sentAtLocalVersion: number) => {
      if (snapshot.version <= serverVersion.current) return;

      /* Recorded even when the rows are not taken, so a snapshot older than
         this one can never win a later race. */
      serverVersion.current = snapshot.version;

      if (sentAtLocalVersion !== localVersion.current) return;

      setProjects(snapshot.projects);
    },
    [],
  );

  const reload = useCallback(async () => {
    const sentAt = localVersion.current;

    applySnapshot(
      await apiClient.project.getProjectsByUser(getConnection()),
      sentAt,
    );
  }, [applySnapshot]);

  useEffect(() => {
    reload();
  }, [reload]);

  const sendMoveToBe = useCallback(async (dto: MoveProjectDto) => {
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

  const move = useCallback(
    async (dto: MoveProjectDto) => {
      setProjects((current) => applyMove(current, dto));
      localVersion.current += 1;

      const { id } = dto;

      pending.current.set(id, dto);
      if (inFlight.current.has(id)) return;

      inFlight.current.add(id);

      while (pending.current.has(id)) {
        const queued = pending.current.get(id) as MoveProjectDto;
        pending.current.delete(id);

        const sentAt = localVersion.current;

        try {
          applySnapshot(await sendMoveToBe(queued), sentAt);
        } catch (error) {
          console.error('Move failed, reloading projects', error);
          await reload();
        }
      }

      inFlight.current.delete(id);
    },
    [applySnapshot, reload, sendMoveToBe],
  );

  return { projects, reload, move };
};
