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

export const TIME_OF_DAY: TimeScale = {
  min: 0,
  wheelMax: hours(24) - 1,
  bands: [{ from: 0, step: minutes(5) }],
};
