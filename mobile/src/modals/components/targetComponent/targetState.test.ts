import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { MIN_BLOCK_TIME } from '../../../config/timeScales';
import { hours, minutes } from '../../../ui/time-input/timeInputLogic';
import {
  EMPTY_TARGET,
  boundLimits,
  buildReport,
  canDivide,
  defaultMinBlock,
  minBlockScale,
  normalizeTarget,
  openState,
  withBound,
  withMinBlock,
  withMode,
  withRepetitions,
  withTimeNeeded,
} from './targetState';
import type { TargetDraft, TargetMode, TargetState } from './targetState';

/* The user's own default block length, which is what the form is handed. */
const EVEN_LENGTH = hours(1);

const empty: TargetState = {
  mode: 'none',
  value: EMPTY_TARGET,
  remembered: { ...EMPTY_TARGET, dividable: true },
};

const timed = (
  timeNeededMinutes: number,
  minBlockMinutes: number | null = null,
): TargetState => {
  const value = {
    ...EMPTY_TARGET,
    timeNeededMinutes,
    minBlockMinutes,
  };
  return {
    mode: 'time',
    value,
    remembered: { ...value, dividable: minBlockMinutes !== null },
  };
};

const toMode = (state: TargetState, mode: TargetMode) =>
  withMode(state, mode, EVEN_LENGTH);

const toTime = (state: TargetState, timeNeededMinutes: number) =>
  withTimeNeeded(state, timeNeededMinutes, EVEN_LENGTH);

describe('normalizeTarget', () => {
  /* Only the backend can produce this: the form makes the two exclusive. */
  it('drops repetitions when both targets arrive set', () => {
    const draft: TargetDraft = {
      ...EMPTY_TARGET,
      timeNeededMinutes: hours(2),
      minBlockMinutes: hours(1),
      repetitionsNeeded: 3,
    };

    expect(normalizeTarget(draft)).toEqual({
      ...EMPTY_TARGET,
      timeNeededMinutes: hours(2),
      minBlockMinutes: hours(1),
    });
  });

  it('leaves either targetComponent alone on its own', () => {
    const onlyTime: TargetDraft = { ...EMPTY_TARGET, timeNeededMinutes: hours(2) };
    const onlyReps: TargetDraft = { ...EMPTY_TARGET, repetitionsNeeded: 3 };

    expect(normalizeTarget(onlyTime)).toBe(onlyTime);
    expect(normalizeTarget(onlyReps)).toBe(onlyReps);
  });
});

describe('openState', () => {
  it('reads the mode back off the values', () => {
    expect(openState(EMPTY_TARGET).mode).toBe('none');
    expect(openState({ ...EMPTY_TARGET, timeNeededMinutes: 60 }).mode).toBe(
      'time',
    );
    expect(openState({ ...EMPTY_TARGET, repetitionsNeeded: 3 }).mode).toBe(
      'repetitions',
    );
  });

  /* Bad data opens clean under the reading it will be saved with, rather than
     opening pre-dirtied by a correction nobody made. */
  it('opens conflicting data as a time targetComponent', () => {
    const state = openState({
      ...EMPTY_TARGET,
      timeNeededMinutes: hours(2),
      repetitionsNeeded: 3,
    });

    expect(state.mode).toBe('time');
    expect(state.value.repetitionsNeeded).toBeNull();
    expect(buildReport(state, state.value).isDirty).toBe(false);
  });
});

describe('minBlockScale', () => {
  it('stops the wheel at the total when that is the lower ceiling', () => {
    expect(minBlockScale(hours(3)).wheelMax).toBe(hours(3));
  });

  it('keeps its own ceiling when the total is higher or unset', () => {
    expect(minBlockScale(hours(40)).wheelMax).toBe(MIN_BLOCK_TIME.wheelMax);
    expect(minBlockScale(null)).toBe(MIN_BLOCK_TIME);
  });
});

describe('canDivide', () => {
  it('is off at or below one block, on above it', () => {
    expect(canDivide(MIN_BLOCK_TIME.min)).toBe(false);
    expect(canDivide(MIN_BLOCK_TIME.min + minutes(5))).toBe(true);
    expect(canDivide(null)).toBe(true);
  });
});

describe('defaultMinBlock', () => {
  it("takes the user's default when the total leaves room for it", () => {
    expect(defaultMinBlock(hours(4), hours(1))).toBe(hours(1));
  });

  it('is held down to the total when that is smaller', () => {
    expect(defaultMinBlock(minutes(30), hours(1))).toBe(minutes(30));
  });
});

describe('the two targets are exclusive', () => {
  it('clears the time targetComponent when repetitions are chosen', () => {
    const next = withRepetitions(timed(hours(2), hours(1)), 3);

    expect(next.mode).toBe('repetitions');
    expect(next.value).toEqual({ ...EMPTY_TARGET, repetitionsNeeded: 3 });
  });

  it('clears repetitions when a time is chosen', () => {
    const reps = withRepetitions(empty, 3);
    const next = toTime(reps, hours(2));

    expect(next.mode).toBe('time');
    expect(next.value.repetitionsNeeded).toBeNull();
  });

  /* Ticking the other box before anything is picked has to switch too, or the
     first box stays ticked with a field the user has stopped looking at. */
  it('empties the targetComponent being left when the mode alone changes', () => {
    const next = toMode(timed(hours(2), hours(1)), 'repetitions');

    expect(next.mode).toBe('repetitions');
    expect(next.value).toEqual(EMPTY_TARGET);
  });

  it('is a no-op when the mode does not change', () => {
    const state = timed(hours(2));
    expect(toMode(state, 'time')).toBe(state);
  });
});

describe('the block line starts on, at the default length', () => {
  it('ticks itself when the time targetComponent is ticked', () => {
    expect(toMode(empty, 'time').value.minBlockMinutes).toBe(EVEN_LENGTH);
  });

  /* Ticking a box the form then fills in for you is not an edit: nothing here
     would be written, so closing must not offer to discard it. */
  it('does not make the form dirty on its own', () => {
    expect(buildReport(toMode(empty, 'time'), EMPTY_TARGET).isDirty).toBe(
      false,
    );
  });

  it('is dropped by a total shorter than the default', () => {
    const short = toTime(toMode(empty, 'time'), minutes(30));

    expect(short.value.minBlockMinutes).toBeNull();
  });

  /* A stored record has already decided about its block, so `null` there means
     the user said no rather than "not asked yet". */
  it('does not turn itself on for a record saved without one', () => {
    const saved = openState({ ...EMPTY_TARGET, timeNeededMinutes: hours(4) });
    const back = toMode(toMode(saved, 'repetitions'), 'time');

    expect(back.value.minBlockMinutes).toBeNull();
  });

  /* Turning it off is a decision, and decisions survive a trip away. */
  it('stays off once it has been turned off', () => {
    const off = withMinBlock(toMode(empty, 'time'), null);
    const back = toMode(toMode(off, 'repetitions'), 'time');

    expect(back.value.minBlockMinutes).toBeNull();
  });
});

describe('a total too short to divide suspends the block, it does not answer for it', () => {
  const chosen = withMinBlock(
    toTime(toMode(empty, 'time'), hours(4)),
    hours(1),
  );

  it('drops the block while the total is at the floor', () => {
    const tiny = toTime(chosen, MIN_BLOCK_TIME.min);

    expect(canDivide(tiny.value.timeNeededMinutes)).toBe(false);
    expect(tiny.value.minBlockMinutes).toBeNull();
  });

  /* The whole point of the distinction: nothing was decided, so nothing is
     lost — raising the total brings the line back exactly as it was. */
  it('gives it back at the previous value when the total grows again', () => {
    const back = toTime(toTime(chosen, MIN_BLOCK_TIME.min), hours(4));

    expect(canDivide(back.value.timeNeededMinutes)).toBe(true);
    expect(back.value.minBlockMinutes).toBe(hours(1));
  });

  it('keeps the line off if it was off before the total shrank', () => {
    const off = withMinBlock(chosen, null);
    const back = toTime(toTime(off, MIN_BLOCK_TIME.min), hours(4));

    expect(back.value.minBlockMinutes).toBeNull();
  });

  /* A total that cannot hold the block is the other case, and it *is* an
     answer: the block goes for good rather than waiting to come back. */
  it('forgets a block the total outgrew, unlike a suspended one', () => {
    const back = toTime(toTime(chosen, minutes(30)), hours(4));

    expect(back.value.minBlockMinutes).toBeNull();
  });
});

describe('a targetComponent switched away from and back keeps what it held', () => {
  const filled = withMinBlock(toTime(empty, hours(12)), hours(1));

  it('gives the time and its block back', () => {
    const away = withRepetitions(filled, 5);
    const back = toMode(away, 'time');

    expect(back.value).toEqual({
      ...EMPTY_TARGET,
      timeNeededMinutes: hours(12),
      minBlockMinutes: hours(1),
    });
  });

  it('gives the repetition count back', () => {
    const away = withRepetitions(filled, 5);
    const back = toMode(toMode(away, 'time'), 'repetitions');

    expect(back.value.repetitionsNeeded).toBe(5);
  });

  it('gives them back across an untick rather than a switch', () => {
    const off = toMode(filled, 'none');

    expect(off.value).toEqual(EMPTY_TARGET);
    expect(toMode(off, 'time').value.timeNeededMinutes).toBe(hours(12));
  });

  /* The memory must not smuggle the other targetComponent back in — that is the rule
     the exclusivity rests on. */
  it('never restores the targetComponent that was not asked for', () => {
    const away = withRepetitions(filled, 5);

    expect(toMode(away, 'time').value.repetitionsNeeded).toBeNull();
    expect(
      toMode(toMode(away, 'time'), 'repetitions').value.timeNeededMinutes,
    ).toBeNull();
  });

  /* A block the user's own edit invalidated is gone, not hidden: restoring it
     would put the field somewhere the wheel could never have reached. */
  it('forgets a block a lowered total can no longer hold', () => {
    const lowered = toTime(filled, minutes(30));
    expect(lowered.value.minBlockMinutes).toBeNull();

    const back = toMode(withRepetitions(lowered, 5), 'time');
    expect(back.value.timeNeededMinutes).toBe(minutes(30));
    expect(back.value.minBlockMinutes).toBeNull();
  });

  it('offers a remembered block back when Dividable is ticked again', () => {
    const off = withMinBlock(filled, null);

    expect(off.value.minBlockMinutes).toBeNull();
    expect(off.remembered.dividable).toBe(false);
    expect(off.remembered.minBlockMinutes).toBe(hours(1));
  });

  /* Memory is not a value: it is neither saved nor counted as a change. */
  it('does not make an emptied targetComponent dirty', () => {
    const away = withRepetitions(filled, 5);
    const off = toMode(away, 'none');

    expect(buildReport(off, EMPTY_TARGET).isDirty).toBe(false);
  });
});

describe('the block cannot outlast the total it divides', () => {
  it('wipes a block the new total is shorter than', () => {
    const next = toTime(timed(hours(4), hours(2)), hours(1));

    expect(next.value.minBlockMinutes).toBeNull();
  });

  it('keeps a block the new total still contains', () => {
    const next = toTime(timed(hours(4), hours(2)), hours(3));

    expect(next.value.minBlockMinutes).toBe(hours(2));
  });

  it('keeps a block exactly as long as the total', () => {
    const next = toTime(timed(hours(4), hours(2)), hours(2));

    expect(next.value.minBlockMinutes).toBe(hours(2));
  });
});

describe('problems', () => {
  it('reports a ticked time targetComponent with no time picked', () => {
    const report = buildReport(toMode(empty, 'time'), EMPTY_TARGET);

    expect(report.isValid).toBe(false);
    expect(report.problems).toEqual([
      { fieldId: 'target-time-needed', message: expect.any(String) },
    ]);
  });

  it('reports a ticked repetition targetComponent with no count picked', () => {
    const report = buildReport(toMode(empty, 'repetitions'), EMPTY_TARGET);

    expect(report.isValid).toBe(false);
    expect(report.problems[0].fieldId).toBe('target-repetitions');
  });

  it('has none when nothing is asked for, or when the field is filled', () => {
    expect(buildReport(empty, EMPTY_TARGET).isValid).toBe(true);
    expect(buildReport(timed(hours(2)), EMPTY_TARGET).isValid).toBe(true);
  });
});

describe('dirty', () => {
  it('is false at rest and true once a value differs', () => {
    expect(buildReport(empty, EMPTY_TARGET).isDirty).toBe(false);
    expect(buildReport(timed(hours(2)), EMPTY_TARGET).isDirty).toBe(true);
  });

  /* A tick over an empty field holds nothing to save, so closing on one must
     not offer to discard anything. */
  it('is false for a ticked box with an empty field', () => {
    expect(buildReport(toMode(empty, 'time'), EMPTY_TARGET).isDirty).toBe(
      false,
    );
  });

  it('is false again when a change is undone by hand', () => {
    const baseline: TargetDraft = {
      ...EMPTY_TARGET,
      timeNeededMinutes: hours(2),
      minBlockMinutes: hours(1),
    };
    const changed = withMinBlock(timed(hours(2), hours(1)), minutes(30));

    expect(buildReport(changed, baseline).isDirty).toBe(true);
    expect(buildReport(withMinBlock(changed, hours(1)), baseline).isDirty).toBe(
      false,
    );
  });
});

describe('the window the work has to land inside', () => {
  const JUN19 = Temporal.PlainDate.from('2026-06-19');
  const AT_5_45 = Temporal.PlainTime.from('17:45');

  const withWindow = (state: TargetState) =>
    withBound(
      withBound(state, 'deadlineDate', JUN19),
      'earliestTime',
      AT_5_45,
    );

  /* Temporal values are objects. Compared with `===` every reopened form would
     report itself dirty, which is the bug this guards. */
  it('is not dirty when the same moments are re-supplied', () => {
    const opened = openState({
      ...EMPTY_TARGET,
      timeNeededMinutes: hours(2),
      deadlineDate: JUN19,
    });
    const same = withBound(
      opened,
      'deadlineDate',
      Temporal.PlainDate.from('2026-06-19'),
    );

    expect(buildReport(same, opened.value).isDirty).toBe(false);
  });

  it('is dirty when a moment actually moves', () => {
    const opened = openState({
      ...EMPTY_TARGET,
      timeNeededMinutes: hours(2),
      deadlineDate: JUN19,
    });
    const moved = withBound(opened, 'deadlineDate', JUN19.add({ days: 1 }));

    expect(buildReport(moved, opened.value).isDirty).toBe(true);
  });

  /* The window says when the work may happen, which is true whichever target
     is being asked for — so switching between them must not wipe it. */
  it('survives a switch between targets', () => {
    const timed = withWindow(toTime(toMode(empty, 'time'), hours(2)));
    const back = toMode(toMode(withRepetitions(timed, 3), 'time'), 'time');

    expect(back.value.deadlineDate?.toString()).toBe('2026-06-19');
    expect(back.value.earliestTime?.toString()).toBe('17:45:00');
  });

  /* With no target there is nothing on screen for a window to describe, so it
     is not what gets written. */
  it('is not saved when no target is asked for', () => {
    const off = toMode(withWindow(toMode(empty, 'time')), 'none');

    expect(buildReport(off, EMPTY_TARGET).isDirty).toBe(false);
  });
});

/* A window that ends before it starts describes nothing, and the bug it caused
   was silent: Earliest Aug 15 9:30 AM with Deadline Aug 3 6:15 PM was accepted,
   reported valid, and saved. */
describe('the window cannot run backwards', () => {
  const date = (month: number, day: number) =>
    new Temporal.PlainDate(2026, month, day);
  const time = (hour: number, minute: number) =>
    new Temporal.PlainTime(hour, minute);

  const windowed = (over: Partial<TargetDraft>): TargetState => {
    const value = { ...EMPTY_TARGET, timeNeededMinutes: hours(2), ...over };
    return { mode: 'time', value, remembered: { ...value, dividable: false } };
  };

  it('offers each end only what the other one leaves', () => {
    const both = windowed({
      earliestDate: date(8, 15),
      deadlineDate: date(8, 20),
    }).value;

    expect(boundLimits(both, 'deadline').minDate).toBe(both.earliestDate);
    expect(boundLimits(both, 'earliest').maxDate).toBe(both.deadlineDate);
  });

  /* On different days every hour is reachable, so only a shared day bounds the
     times — and a day still unknown bounds nothing at all. */
  it('bounds the times only when both ends land on one day', () => {
    const apart = windowed({
      earliestDate: date(8, 15),
      earliestTime: time(9, 30),
      deadlineDate: date(8, 20),
      deadlineTime: time(18, 15),
    }).value;

    expect(boundLimits(apart, 'deadline').notBefore).toBeNull();

    const together = { ...apart, deadlineDate: date(8, 15) };
    expect(boundLimits(together, 'deadline').notBefore).toBe(
      together.earliestTime,
    );
    expect(boundLimits(together, 'earliest').notAfter).toBe(
      together.deadlineTime,
    );

    const undated = { ...apart, deadlineDate: null };
    expect(boundLimits(undated, 'deadline').notBefore).toBeNull();
  });

  /* The exact case reported, arriving from the backend rather than picked. */
  it('drops a deadline that precedes its earliest, on open', () => {
    const opened = normalizeTarget({
      ...EMPTY_TARGET,
      timeNeededMinutes: hours(2),
      earliestDate: date(8, 15),
      earliestTime: time(9, 30),
      deadlineDate: date(8, 3),
      deadlineTime: time(18, 15),
    });

    expect(opened.deadlineDate).toBeNull();
    expect(opened.deadlineTime).toBeNull();
    expect(opened.earliestDate).toEqual(date(8, 15));
  });

  /* The hole the pickers alone cannot close: both ends were legal on separate
     days, and pulling the deadline back onto the earliest day strands its
     time. Only the hour is impossible, so only the hour goes. */
  it('drops only the hour when a date change strands it', () => {
    const state = windowed({
      earliestDate: date(8, 15),
      earliestTime: time(9, 30),
      deadlineDate: date(8, 20),
      deadlineTime: time(6, 15),
    });

    const pulled = withBound(state, 'deadlineDate', date(8, 15));

    expect(pulled.value.deadlineDate).toEqual(date(8, 15));
    expect(pulled.value.deadlineTime).toBeNull();
  });

  /* A window open and shut at the same instant is one nothing can happen
     inside, so it counts as backwards rather than as a point. */
  it('treats an identical pair as backwards', () => {
    const same = normalizeTarget({
      ...EMPTY_TARGET,
      earliestDate: date(8, 15),
      earliestTime: time(9, 30),
      deadlineDate: date(8, 15),
      deadlineTime: time(9, 30),
    });

    expect(same.deadlineTime).toBeNull();
  });

  /* Clearing one end must not disturb the other: the two are separate
     statements, and only an impossible pair is corrected. */
  it('clears one end and leaves the other standing', () => {
    const state = windowed({
      earliestDate: date(8, 15),
      earliestTime: time(9, 30),
      deadlineDate: date(8, 20),
      deadlineTime: time(18, 15),
    });

    const cleared = withBound(state, 'earliestDate', null);

    expect(cleared.value.earliestDate).toBeNull();
    expect(cleared.value.earliestTime).toEqual(time(9, 30));
    expect(cleared.value.deadlineDate).toEqual(date(8, 20));
    expect(cleared.value.deadlineTime).toEqual(time(18, 15));
  });

  it('leaves a window that runs forwards alone', () => {
    const good = {
      ...EMPTY_TARGET,
      earliestDate: date(8, 15),
      earliestTime: time(9, 30),
      deadlineDate: date(8, 20),
      deadlineTime: time(18, 15),
    };

    expect(normalizeTarget(good)).toEqual(good);
  });
});
