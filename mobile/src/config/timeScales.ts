import { hours, minutes } from '../ui/time-input/timeInputLogic';
import type { TimeScale } from '../ui/time-input/timeInputLogic';

export const PROJECT_TOTAL_TIME: TimeScale = {
  min: minutes(1),
  wheelMax: hours(500),
  absoluteMax: hours(9999),
  bands: [
    { from: minutes(0), step: minutes(1) },
    { from: minutes(5), step: minutes(5) },
    { from: hours(10), step: minutes(15) },
    { from: hours(50), step: hours(1) },
    { from: hours(100), step: hours(5) },
  ],
};

export const SLOT_FLEXIBLE_TIME: TimeScale = {
  min: minutes(1),
  wheelMax: hours(24),
  bands: [
    { from: minutes(0), step: minutes(1) },
    { from: minutes(5), step: minutes(5) },
  ],
};

/* How finely a project's blocks may be cut, and how coarsely. One five-minute
   band the whole way: a block is a working session, and the grid that reads
   well at twenty minutes reads just as well at ten hours. The ceiling is a
   working day's worth; a targetComponent may sit below it, and TargetComponent lowers
   `wheelMax` to the total time when that is the smaller of the two. */
export const MIN_BLOCK_TIME: TimeScale = {
  min: minutes(5),
  wheelMax: hours(12),
  bands: [{ from: minutes(0), step: minutes(5) }],
};

export const TIME_OF_DAY: TimeScale = {
  min: 0,
  wheelMax: hours(24) - 1,
  bands: [{ from: 0, step: minutes(5) }],
};
