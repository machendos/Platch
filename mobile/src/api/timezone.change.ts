import { apiClient, getConnection } from '../system/api.client';
import { useQuery } from '@tanstack/react-query';
import { CreateTimezoneChangeDto } from './sdk/structures/CreateTimezoneChangeDto';
import { queryClient } from './query.client';
import { Temporal } from 'temporal-polyfill';

const TZ_CHANGE_KEY = ['timezone_change'] as const;

const timezoneChangeQuery = {
  queryKey: TZ_CHANGE_KEY,
  queryFn: () =>
    apiClient.timezone_change.getUserTimezoneChanges(getConnection()),
  select: (rows: readonly { ianaTimezone: string; changesAt: string }[]) =>
    rows
      .map((row) => ({
        ...row,
        changesAt: Temporal.Instant.from(row.changesAt),
      }))
      .sort((a, b) => Temporal.Instant.compare(a.changesAt, b.changesAt)),
};

export const useTimezoneChangesQuery = () => {
  const { data } = useQuery(timezoneChangeQuery);

  return data ?? [];
};

export const refreshTimezoneChanges = () =>
  queryClient.query({
    ...timezoneChangeQuery,
    staleTime: 0,
  });

export const createTimezoneChange = async (dto: CreateTimezoneChangeDto) => {
  const created = await apiClient.timezone_change.createTimezoneChange(
    getConnection(),
    dto,
  );
  await queryClient.invalidateQueries({ queryKey: TZ_CHANGE_KEY });
  return created;
};
