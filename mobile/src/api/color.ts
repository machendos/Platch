import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getConnection } from '../system/api.client';

/* The palette, and which projects already wear each colour. */

export type ProjectColor = {
  id: string;
  hexCode: string;
  placement: number;
};

export type ColorInUse = ProjectColor & {
  projects: { id: string; name: string | null }[];
};

export const COLORS_KEY = ['colors'] as const;

export const colorsQuery = {
  queryKey: COLORS_KEY,
  queryFn: () => apiClient.project.colors.getColors(getConnection()),
};

export const useColorsQuery = (): ColorInUse[] => {
  const { data } = useQuery(colorsQuery);

  return data ?? [];
};

export const useRefreshColors = () => {
  const client = useQueryClient();

  return useCallback(
    () => client.query({ ...colorsQuery, staleTime: 0 }),
    [client],
  );
};
