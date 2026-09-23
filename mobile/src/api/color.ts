import { apiClient, getConnection } from '../system/api.client';
import { queryClient } from './query.client';

export type ProjectColor = {
  id: string;
  hexCode: string;
  placement: number;
};

export type ColorInUse = ProjectColor & {
  projects: { id: string; name: string | null }[];
};

export const COLORS_KEY = ['colors'] as const;

const colorsQuery = {
  queryKey: COLORS_KEY,
  queryFn: () => apiClient.project.colors.getColors(getConnection()),
};

export const colors = {
  getColors: (): Promise<ColorInUse[]> =>
    queryClient.query({ ...colorsQuery, staleTime: 0 }),
};
