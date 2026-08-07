const distributeEvenly = (total: number, rows: number): number[] => {
  const base = Math.floor(total / rows);
  const remainder = total % rows;
  return Array.from({ length: rows }, (_, i) => base + (i < remainder ? 1 : 0));
};

export const daysPerRowThatFit = (
  schedulerAreaWidth: number,
  minColumnWidth: number,
) => Math.max(1, Math.floor(schedulerAreaWidth / minColumnWidth));

export const splitDaysIntoRows = (
  dayCount: number,
  columnsPerRow: number,
  weekAligned: boolean = false,
): number[] => {
  if (dayCount <= 0) return [];

  const fits = Math.max(1, columnsPerRow);
  if (dayCount <= fits) return [dayCount];

  if (weekAligned && fits >= 7) {
    return Array(Math.round(dayCount / 7)).fill(7);
  }

  // Weeks that cannot fit are still split one week at a time, so days from
  // different weeks never share a row: 14 days at 4-per-row becomes
  // [4,3,4,3] rather than [4,4,3,3], whose second row would straddle them.
  if (weekAligned) {
    const rowsPerWeek = Math.ceil(7 / fits);
    return Array.from({ length: dayCount / 7 }, () =>
      distributeEvenly(7, rowsPerWeek),
    ).flat();
  }

  return distributeEvenly(dayCount, Math.ceil(dayCount / fits));
};
