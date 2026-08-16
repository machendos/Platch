import { hours, minutes } from '../ui/time-input/timeInputLogic';
import type { TimeScale } from '../ui/time-input/timeInputLogic';

// A band lists the step that applies from `from` until the next band starts.
// Both wheels are derived from the values those steps produce, so a step of an
// hour or more is what pins the minute wheel to 0, and a step of several hours
// is what makes the hour wheel stride. Bands must be ordered by `from`.

export const PROJECT_TOTAL_TIME: TimeScale = {
  min: minutes(1),
  max: hours(500),
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
  max: hours(24) - 1,
  bands: [{ from: 0, step: minutes(5) }],
};
