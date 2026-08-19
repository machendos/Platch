import { describe, expect, it } from 'vitest';
import { PROJECT_TOTAL_TIME, TIME_OF_DAY } from '../../config/timeScales';
import {
  allowedHours,
  allowedMinutes,
  applyColumn,
  buildColumns,
  clampToScale,
  hours,
  isAllowed,
  minutes,
  snapTo,
  toTotalMinutes,
  toValue,
  withHours,
  withMeridiem,
  withMinutes,
} from './timeInputLogic';
import type { TimeScale } from './timeInputLogic';

const SCALE = PROJECT_TOTAL_TIME;

const range = (from: number, to: number, step = 1) => {
  const result: number[] = [];
  for (let value = from; value <= to; value += step) result.push(value);
  return result;
};

const labels = (scale: TimeScale, value: number, index: number) =>
  buildColumns('time', scale, value)[index].options.map(
    (option) => option.label,
  );

describe('allowedMinutes', () => {
  it('offers every minute up to five in the first hour, then fives', () => {
    expect(allowedMinutes(SCALE, 0)).toEqual([1, 2, 3, 4, ...range(5, 55, 5)]);
  });

  it('keeps the five-minute step to the last hour before ten', () => {
    expect(allowedMinutes(SCALE, 9)).toEqual(range(0, 55, 5));
  });

  it('widens to fifteen minutes at ten hours', () => {
    expect(allowedMinutes(SCALE, 10)).toEqual([0, 15, 30, 45]);
  });

  it('holds fifteen minutes to the last hour before fifty', () => {
    expect(allowedMinutes(SCALE, 49)).toEqual([0, 15, 30, 45]);
  });

  it('pins minutes to zero from fifty hours', () => {
    expect(allowedMinutes(SCALE, 50)).toEqual([0]);
    expect(allowedMinutes(SCALE, 99)).toEqual([0]);
  });

  it('has no minutes at all for an hour the scale skips', () => {
    expect(allowedMinutes(SCALE, 101)).toEqual([]);
  });

  it('offers only zero at the maximum', () => {
    expect(allowedMinutes(SCALE, 500)).toEqual([0]);
  });
});

describe('allowedHours', () => {
  const hourOptions = allowedHours(SCALE);

  it('runs one by one to a hundred, then by fives to five hundred', () => {
    expect(hourOptions).toEqual([...range(0, 99), ...range(100, 500, 5)]);
  });

  it('stops at the maximum rather than overrunning it', () => {
    expect(hourOptions[hourOptions.length - 1]).toBe(500);
  });

  // The wheels are built from these lists and a scroll container cannot scroll
  // past its own content, so "the wheel stops at min/max" is this assertion.
  it('never offers an hour outside the scale', () => {
    expect(hourOptions.every((hour) => allowedMinutes(SCALE, hour).length > 0));
    expect(Math.min(...hourOptions)).toBe(0);
  });
});

describe('isAllowed', () => {
  it('rejects zero, which is below the minimum of one minute', () => {
    expect(isAllowed(SCALE, 0)).toBe(false);
    expect(isAllowed(SCALE, 1)).toBe(true);
  });

  it('rejects a value past the maximum', () => {
    expect(isAllowed(SCALE, hours(500))).toBe(true);
    expect(isAllowed(SCALE, hours(500) + 5)).toBe(false);
  });

  it('rejects a value off the grid of its band', () => {
    expect(isAllowed(SCALE, minutes(7))).toBe(false);
    expect(isAllowed(SCALE, hours(10) + 10)).toBe(false);
    expect(isAllowed(SCALE, hours(10) + 15)).toBe(true);
  });
});

describe('snapTo', () => {
  it('clamps below the minimum and above the maximum', () => {
    expect(snapTo(SCALE, -30)).toBe(minutes(1));
    expect(snapTo(SCALE, 0)).toBe(minutes(1));
    expect(snapTo(SCALE, hours(900))).toBe(hours(500));
  });

  it('takes the nearer of the two neighbours', () => {
    expect(snapTo(SCALE, 7)).toBe(5);
    expect(snapTo(SCALE, 9)).toBe(10);
  });

  it('leaves a value that is already on the grid alone', () => {
    expect(snapTo(SCALE, hours(12) + 30)).toBe(hours(12) + 30);
  });
});

describe('clampToScale', () => {
  // The range is a real constraint; the grid is only how finely the wheel can
  // be pointed. A value from outside the wheel keeps what it meant.
  it('keeps a value the wheel could never land on', () => {
    for (const off of [7, 23, hours(47) + 20, hours(3) + 7]) {
      expect(clampToScale(SCALE, off)).toBe(off);
      expect(isAllowed(SCALE, off)).toBe(false);
    }
  });

  it('still holds the minimum, which is a real limit', () => {
    expect(clampToScale(SCALE, 0)).toBe(minutes(1));
    expect(clampToScale(SCALE, -50)).toBe(minutes(1));
  });

  // The wheel stopping at 500h says nothing about how long a duration can be.
  it('allows a value past the end of the wheel, up to the real ceiling', () => {
    expect(clampToScale(SCALE, hours(700))).toBe(hours(700));
    expect(clampToScale(SCALE, hours(9999))).toBe(hours(9999));
    expect(clampToScale(SCALE, hours(99999))).toBe(hours(9999));

    // The wheel itself still ends where it ends.
    expect(snapTo(SCALE, hours(700))).toBe(hours(500));
  });

  it('falls back to the wheel end when a scale states no separate ceiling', () => {
    expect(TIME_OF_DAY.absoluteMax).toBeUndefined();
    expect(clampToScale(TIME_OF_DAY, hours(30))).toBe(TIME_OF_DAY.wheelMax);
  });

  it('leaves a value already on the grid alone', () => {
    expect(clampToScale(SCALE, hours(12) + 30)).toBe(hours(12) + 30);
  });

  // What the wheel shows for it: the nearest row it can draw, which is what
  // snapTo is for. The two answers are allowed to differ, and that difference
  // is the whole point.
  it('is what is kept, while snapTo is only what is drawn', () => {
    const typed = hours(47) + 20;

    expect(clampToScale(SCALE, typed)).toBe(typed);
    expect(snapTo(SCALE, typed)).toBe(hours(47) + 15);
  });
});

describe('withHours', () => {
  it('keeps the minute when the new hour still allows it', () => {
    expect(withHours(SCALE, hours(2) + 30, 3)).toBe(hours(3) + 30);
  });

  it('drags an off-grid minute onto the coarser grid', () => {
    expect(withHours(SCALE, hours(9) + 35, 10)).toBe(hours(10) + 30);
  });

  // Snapping the total instead of the minute would answer hour 51 here.
  it('lands on the hour that was chosen, not the nearest allowed total', () => {
    expect(withHours(SCALE, hours(9) + 35, 50)).toBe(hours(50));
  });

  it('respects the minimum in the first hour', () => {
    expect(withHours(SCALE, hours(4), 0)).toBe(minutes(1));
  });
});

describe('withMinutes', () => {
  it('keeps the hour and takes the minute', () => {
    expect(withMinutes(SCALE, hours(12) + 15, 45)).toBe(hours(12) + 45);
  });

  it('snaps a minute the current hour does not allow', () => {
    expect(withMinutes(SCALE, hours(20), 20)).toBe(hours(20) + 15);
  });
});

describe('buildColumns', () => {
  it('gives duration two columns with unit captions', () => {
    const columns = buildColumns('duration', SCALE, hours(3) + 30);

    expect(columns.map((column) => column.key)).toEqual(['hours', 'minutes']);
    expect(columns.map((column) => column.unit)).toEqual(['h', 'min']);
    expect(columns[0].value).toBe(3);
    expect(columns[1].value).toBe(30);
  });

  it('gives time three columns', () => {
    const columns = buildColumns('time', TIME_OF_DAY, hours(17) + 45);

    expect(columns.map((column) => column.key)).toEqual([
      'hours',
      'minutes',
      'meridiem',
    ]);
    expect(columns[2].value).toBe(1);
  });

  it('labels the twelve-hour clock with twelve at the top', () => {
    expect(labels(TIME_OF_DAY, hours(17) + 45, 0)).toEqual([
      '12',
      ...range(1, 11).map(String),
    ]);
  });

  it('pads minutes in time mode but not in duration mode', () => {
    expect(labels(TIME_OF_DAY, hours(17), 1).slice(0, 2)).toEqual(['00', '05']);
    expect(
      buildColumns('duration', SCALE, hours(3))[1]
        .options.slice(0, 2)
        .map((option) => option.label),
    ).toEqual(['0', '5']);
  });

  it('derives the meridiem options rather than assuming both', () => {
    const morningOnly: TimeScale = {
      min: 0,
      wheelMax: hours(11) + 55,
      bands: [{ from: 0, step: minutes(5) }],
    };

    expect(labels(morningOnly, hours(9), 2)).toEqual(['AM']);
    expect(labels(TIME_OF_DAY, hours(9), 2)).toEqual(['AM', 'PM']);
  });
});

describe('applyColumn', () => {
  it('routes each column to its own setter', () => {
    expect(applyColumn(SCALE, hours(2) + 30, 'hours', 3)).toBe(hours(3) + 30);
    expect(applyColumn(SCALE, hours(2) + 30, 'minutes', 45)).toBe(
      hours(2) + 45,
    );
  });

  it('moves a time across the half-day boundary', () => {
    expect(withMeridiem(TIME_OF_DAY, hours(9) + 30, 1)).toBe(hours(21) + 30);
    expect(withMeridiem(TIME_OF_DAY, hours(21) + 30, 0)).toBe(hours(9) + 30);
  });
});

describe('toValue', () => {
  it('sets only the duration arm in duration mode', () => {
    expect(toValue('duration', hours(3) + 30)).toEqual({
      time: null,
      durationMinutes: 210,
    });
  });

  it('sets only the time arm in time mode', () => {
    const value = toValue('time', hours(17) + 45);

    expect(value.durationMinutes).toBeNull();
    expect(value.time?.toString()).toBe('17:45:00');
  });

  it('round-trips through toTotalMinutes', () => {
    for (const total of [1, 210, hours(17) + 45, hours(23) + 55]) {
      expect(toTotalMinutes(toValue('time', total))).toBe(total);
      expect(toTotalMinutes(toValue('duration', total))).toBe(total);
    }
  });
});

describe('every value the wheels can produce', () => {
  // The wheels only ever offer what these two lists hold, so if every pair is
  // allowed then no combination of spins can land off the grid or outside the
  // range — which is the whole guarantee the contract exists to make.
  it('is allowed by the scale it came from', () => {
    for (const scale of [PROJECT_TOTAL_TIME, TIME_OF_DAY]) {
      for (const hour of allowedHours(scale)) {
        for (const minute of allowedMinutes(scale, hour)) {
          expect(isAllowed(scale, hour * 60 + minute)).toBe(true);
        }
      }
    }
  });

  it('survives a round trip through both setters', () => {
    for (const hour of allowedHours(SCALE)) {
      const value = withHours(SCALE, hours(2) + 30, hour);
      expect(isAllowed(SCALE, value)).toBe(true);
      expect(Math.floor(value / 60)).toBe(hour);
    }
  });
});
