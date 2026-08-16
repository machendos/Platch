import { Temporal } from 'temporal-polyfill';

export type ScaleBand = {
  from: number;
  step: number;
};

export type TimeScale = {
  min: number;
  max: number;
  bands: ScaleBand[];
};

export type PickerMode = 'time' | 'duration';

export type TimeInputValue =
  | { time: Temporal.PlainTime; durationMinutes: null }
  | { time: null; durationMinutes: number };

export type WheelOption = {
  value: number;
  label: string;
};

export type ColumnKey = 'hours' | 'minutes' | 'meridiem';

export type PickerColumn = {
  key: ColumnKey;
  label: string;
  unit?: string;
  options: WheelOption[];
  value: number;
};

export const hours = (count: number) => count * 60;

export const minutes = (count: number) => count;

const MINUTES_PER_HOUR = 60;

const bandAt = (scale: TimeScale, value: number): ScaleBand => {
  let match = scale.bands[0];

  for (const band of scale.bands) {
    if (band.from <= value) match = band;
  }

  return match;
};

const bandEnd = (scale: TimeScale, index: number) =>
  index + 1 < scale.bands.length ? scale.bands[index + 1].from : Infinity;

// Values in a band are `from + k * step`, so a band is walked from its own
// start rather than from the scale's — that is what keeps `{from: 5, step: 5}`
// landing on 5, 10, 15 instead of inheriting the previous band's phase.
const firstAtOrAfter = (band: ScaleBand, value: number) =>
  value <= band.from
    ? band.from
    : band.from + Math.ceil((value - band.from) / band.step) * band.step;

const nearest = (options: number[], target: number) =>
  options.reduce((best, option) =>
    Math.abs(option - target) < Math.abs(best - target) ? option : best,
  );

export const isAllowed = (scale: TimeScale, value: number): boolean => {
  if (value < scale.min || value > scale.max) return false;

  const band = bandAt(scale, value);
  return (value - band.from) % band.step === 0;
};

export const allowedHours = (scale: TimeScale): number[] => {
  const result: number[] = [];
  const push = (hour: number) => {
    if (result[result.length - 1] !== hour) result.push(hour);
  };

  scale.bands.forEach((band, index) => {
    const lo = firstAtOrAfter(band, Math.max(band.from, scale.min));
    const hi = Math.min(bandEnd(scale, index) - 1, scale.max);
    if (lo > hi) return;

    const last = lo + Math.floor((hi - lo) / band.step) * band.step;

    // A step under an hour cannot skip a whole hour, so every hour the band
    // spans holds a value and the range can be taken wholesale. Only coarse
    // bands are walked, and those are short by definition.
    if (band.step < MINUTES_PER_HOUR) {
      const to = Math.floor(last / MINUTES_PER_HOUR);
      for (let hour = Math.floor(lo / MINUTES_PER_HOUR); hour <= to; hour++) {
        push(hour);
      }
      return;
    }

    for (let value = lo; value <= last; value += band.step) {
      push(Math.floor(value / MINUTES_PER_HOUR));
    }
  });

  return result;
};

export const allowedMinutes = (scale: TimeScale, hour: number): number[] => {
  const start = hour * MINUTES_PER_HOUR;
  const end = start + MINUTES_PER_HOUR - 1;
  const result: number[] = [];

  scale.bands.forEach((band, index) => {
    const lo = firstAtOrAfter(band, Math.max(band.from, scale.min, start));
    const hi = Math.min(bandEnd(scale, index) - 1, scale.max, end);

    for (let value = lo; value <= hi; value += band.step) {
      result.push(value - start);
    }
  });

  return result;
};

export const snapTo = (scale: TimeScale, value: number): number => {
  if (value <= scale.min) return scale.min;
  if (value >= scale.max) return scale.max;
  if (isAllowed(scale, value)) return value;

  const band = bandAt(scale, value);
  const below = Math.max(
    band.from + Math.floor((value - band.from) / band.step) * band.step,
    scale.min,
  );
  const above = Math.min(below + band.step, scale.max);

  return value - below <= above - value ? below : above;
};

// Moving a wheel must land on the value that wheel was pointed at, so the hour
// is held fixed and only the minute is re-snapped. Snapping the total instead
// reads "nearest allowed value" as the goal and silently answers hour 51 to a
// user who picked hour 50 with 35 minutes showing.
const atHour = (scale: TimeScale, hour: number, minute: number): number => {
  const options = allowedMinutes(scale, hour);
  if (options.length === 0) return snapTo(scale, hour * MINUTES_PER_HOUR);

  return hour * MINUTES_PER_HOUR + nearest(options, minute);
};

export const withHours = (scale: TimeScale, value: number, hour: number) =>
  atHour(scale, hour, value % MINUTES_PER_HOUR);

export const withMinutes = (scale: TimeScale, value: number, minute: number) =>
  atHour(scale, Math.floor(value / MINUTES_PER_HOUR), minute);

export const withMeridiem = (
  scale: TimeScale,
  value: number,
  meridiem: number,
) => {
  const hour = Math.floor(value / MINUTES_PER_HOUR) % 12;
  return atHour(scale, hour + meridiem * 12, value % MINUTES_PER_HOUR);
};

export const toValue = (mode: PickerMode, total: number): TimeInputValue =>
  mode === 'duration'
    ? { time: null, durationMinutes: total }
    : {
        time: new Temporal.PlainTime(
          Math.floor(total / MINUTES_PER_HOUR),
          total % MINUTES_PER_HOUR,
        ),
        durationMinutes: null,
      };

export const toTotalMinutes = (value: TimeInputValue): number =>
  value.time === null
    ? value.durationMinutes
    : value.time.hour * MINUTES_PER_HOUR + value.time.minute;

const pad = (value: number) => String(value).padStart(2, '0');

const halfDayOf = (hour: number) => (hour < 12 ? 0 : 1);

export const buildColumns = (
  mode: PickerMode,
  scale: TimeScale,
  value: number,
): PickerColumn[] => {
  const hour = Math.floor(value / MINUTES_PER_HOUR);
  const minute = value % MINUTES_PER_HOUR;

  const minuteColumn: PickerColumn = {
    key: 'minutes',
    label: 'Minutes',
    unit: mode === 'duration' ? 'min' : undefined,
    options: allowedMinutes(scale, hour).map((option) => ({
      value: option,
      label: mode === 'time' ? pad(option) : String(option),
    })),
    value: minute,
  };

  if (mode === 'duration') {
    return [
      {
        key: 'hours',
        label: 'Hours',
        unit: 'h',
        options: allowedHours(scale).map((option) => ({
          value: option,
          label: String(option),
        })),
        value: hour,
      },
      minuteColumn,
    ];
  }

  const meridiem = halfDayOf(hour);
  const scaleHours = allowedHours(scale);

  return [
    {
      key: 'hours',
      label: 'Hour',
      options: scaleHours
        .filter((option) => halfDayOf(option) === meridiem)
        .map((option) => ({ value: option, label: String(option % 12 || 12) })),
      value: hour,
    },
    minuteColumn,
    {
      key: 'meridiem',
      label: 'AM or PM',
      options: [
        { value: 0, label: 'AM' },
        { value: 1, label: 'PM' },
      ].filter((option) =>
        scaleHours.some((scaleHour) => halfDayOf(scaleHour) === option.value),
      ),
      value: meridiem,
    },
  ];
};

export const applyColumn = (
  scale: TimeScale,
  value: number,
  key: ColumnKey,
  next: number,
): number => {
  if (key === 'hours') return withHours(scale, value, next);
  if (key === 'minutes') return withMinutes(scale, value, next);
  return withMeridiem(scale, value, next);
};
