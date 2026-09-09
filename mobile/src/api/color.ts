import { useQuery } from '@tanstack/react-query';
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

export const useColorsQuery = (): ColorInUse[] => {
  const { data } = useQuery({
    queryKey: COLORS_KEY,
    queryFn: () => apiClient.project.colors.getColors(getConnection()),
  });

  return data ?? [];
};
