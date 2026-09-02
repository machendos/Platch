import { Temporal } from 'temporal-polyfill';
import { MIN_BLOCK_TIME } from '../../../config/timeScales';
import { clampToScale, snapTo } from '../../../ui/time-input/timeInputLogic';
import type { TimeScale } from '../../../ui/time-input/timeInputLogic';

/* Null-shaped, so the value the parent receives is the Project columns
   themselves — no second representation that could disagree with them, and
   `isDirty` is exact: a number picked behind a box that was then unticked
   leaves nothing behind. */
export type TargetDraft = {
  timeNeededMinutes: number | null;
  minBlockMinutes: number | null;
  repetitionsNeeded: number | null;

  /* The window the work has to land inside. Not the same kind of thing as the
     targets above: those say how much, these say when it may happen — which is
     why nothing here is exclusive with anything, and why a mode change carries
     them through untouched. */
  earliestDate: Temporal.PlainDate | null;
  earliestTime: Temporal.PlainTime | null;
  deadlineDate: Temporal.PlainDate | null;
  deadlineTime: Temporal.PlainTime | null;
};

export type TargetBound =
  | 'earliestDate'
  | 'earliestTime'
  | 'deadlineDate'
  | 'deadlineTime';

const NO_BOUNDS = {
  earliestDate: null,
  earliestTime: null,
  deadlineDate: null,
  deadlineTime: null,
} as const;

const boundsOf = (draft: TargetDraft) => ({
  earliestDate: draft.earliestDate,
  earliestTime: draft.earliestTime,
  deadlineDate: draft.deadlineDate,
  deadlineTime: draft.deadlineTime,
});

/* Which target the user has asked for, which is **not** derivable from the
   value: neither target has a default, so a box can be ticked with its field
   still empty — and that state is exactly the one worth reporting as a
   problem. Nulls alone cannot tell it from an untouched form. */
export type TargetMode = 'none' | 'time' | 'repetitions';

/* What each field last held, kept outside `value` so it is neither saved nor
   counted as a change. Switching target hides the numbers rather than
   destroying them: coming back to a target the user has already filled in and
   finding it blank reads as the form having thrown the work away. */
export type TargetMemory = TargetDraft & {
  /* Whether the block line was last on, separate from its number for the same
     reason `mode` is separate from the value: a block that is off has no
     number, so "off because it was turned off" would otherwise read the same
     as "off because this target has not been opened yet" — and the second one
     is what the default is for. */
  dividable: boolean;
};

export type TargetState = {
  mode: TargetMode;
  value: TargetDraft;
  remembered: TargetMemory;
};

/* A problem names its control by DOM id rather than by a path through the
   component tree, which is what lets the form root scroll to it and paint it
   without knowing how deeply the control is nested. */
export type FieldProblem = {
  fieldId: string;
  message: string;
};

export type TargetReport = {
  isDirty: boolean;
  isValid: boolean;
  problems: FieldProblem[];
  /* What would be saved, which is not always what is on screen: an unticked
     box holds nothing, and the window belongs to a target that was asked for.
     Same value isDirty is measured against, so a form cannot save something it
     did not consider a change. */
  value: TargetDraft;
};

export const TARGET_FIELD_IDS = {
  timeNeeded: 'target-time-needed',
  repetitions: 'target-repetitions',
} as const;

export const EMPTY_TARGET: TargetDraft = {
  timeNeededMinutes: null,
  minBlockMinutes: null,
  repetitionsNeeded: null,
  ...NO_BOUNDS,
};

/* Which half of a window is impossible, if either is.

   Only ever answered when both dates are known: with one of them missing the
   two ends may land on any pair of days, so no time can be ruled out. Equal
   moments count as backwards — a window that opens and closes at the same
   instant is one nothing can happen inside, which is the whole point of a
   window. */
const windowFault = (draft: TargetDraft): 'date' | 'time' | null => {
  const { earliestDate, earliestTime, deadlineDate, deadlineTime } = draft;

  if (earliestDate === null || deadlineDate === null) return null;

  const days = Temporal.PlainDate.compare(earliestDate, deadlineDate);
  if (days > 0) return 'date';
  if (days < 0) return null;

  return earliestTime !== null &&
    deadlineTime !== null &&
    Temporal.PlainTime.compare(earliestTime, deadlineTime) >= 0
    ? 'time'
    : null;
};

/* The deadline gives way, and gives way by being wiped rather than moved: a
   clamped deadline is a date nobody chose, and this file already answers an
   impossible combination that way — a block longer than its total is dropped,
   not shortened, and a repetition count beside a time is dropped, not merged.

   Only as much is wiped as is impossible. A deadline on the wrong day takes
   its time with it; one on the right day at the wrong hour keeps its date and
   loses only the hour. */
const withPossibleWindow = (draft: TargetDraft): TargetDraft => {
  const fault = windowFault(draft);

  if (fault === 'date') {
    return { ...draft, deadlineDate: null, deadlineTime: null };
  }

  return fault === 'time' ? { ...draft, deadlineTime: null } : draft;
};

/* A total and a repetition count are alternatives, so a record holding both is
   data the form cannot draw. Time wins. A deadline that precedes its earliest
   is the same kind of unusable record. Applied to the baseline as well as to
   the draft, so a record that arrives broken opens clean showing the reading
   it will be saved under, rather than opening pre-dirtied by a correction
   nobody made. */
export const normalizeTarget = (draft: TargetDraft): TargetDraft =>
  withPossibleWindow(
    draft.timeNeededMinutes !== null && draft.repetitionsNeeded !== null
      ? { ...draft, repetitionsNeeded: null }
      : draft,
  );

/* What each end of the window may be set to, given where the other one is.
   The picker is told, so an impossible window cannot be entered rather than
   being entered and reported — the same move the exact-time component makes
   for its From and To.

   Dates bound dates. Times bound times only on a shared day: on different days
   every hour is reachable, and with a date still missing the day relationship
   is not known yet, which is what `windowFault` catches afterwards. */
export type BoundLimits = {
  minDate: Temporal.PlainDate | null;
  maxDate: Temporal.PlainDate | null;
  notBefore: Temporal.PlainTime | null;
  notAfter: Temporal.PlainTime | null;
};

export const boundLimits = (
  draft: TargetDraft,
  end: 'earliest' | 'deadline',
): BoundLimits => {
  const sameDay =
    draft.earliestDate !== null &&
    draft.deadlineDate !== null &&
    draft.earliestDate.equals(draft.deadlineDate);

  return end === 'earliest'
    ? {
        minDate: null,
        maxDate: draft.deadlineDate,
        notBefore: null,
        notAfter: sameDay ? draft.deadlineTime : null,
      }
    : {
        minDate: draft.earliestDate,
        maxDate: null,
        notBefore: sameDay ? draft.earliestTime : null,
        notAfter: null,
      };
};

export const modeOf = (draft: TargetDraft): TargetMode => {
  if (draft.timeNeededMinutes !== null) return 'time';
  if (draft.repetitionsNeeded !== null) return 'repetitions';
  return 'none';
};

export const openState = (initial: TargetDraft): TargetState => {
  const value = normalizeTarget(initial);

  return {
    mode: modeOf(value),
    value,
    remembered: {
      ...value,
      /* A record that already carries a time target has decided about its
         block, and a stored `null` means the user said no. One with no time
         target has decided nothing, so the default still applies. */
      dividable:
        value.timeNeededMinutes === null || value.minBlockMinutes !== null,
    },
  };
};

/* A block can never be longer than the whole of the time it divides, so the
   wheel simply stops at the total — the same move `afterTimeScale` makes for
   an end time constrained by its start. */
export const minBlockScale = (timeNeededMinutes: number | null): TimeScale =>
  timeNeededMinutes === null || timeNeededMinutes >= MIN_BLOCK_TIME.wheelMax
    ? MIN_BLOCK_TIME
    : { ...MIN_BLOCK_TIME, wheelMax: timeNeededMinutes };

/* At one block there is nothing left to divide, so the line is not offered at
   all rather than offered with a wheel holding a single row. */
export const canDivide = (timeNeededMinutes: number | null): boolean =>
  timeNeededMinutes === null || timeNeededMinutes > MIN_BLOCK_TIME.min;

export const defaultMinBlock = (
  timeNeededMinutes: number | null,
  defaultEvenLengthMinutes: number,
): number => {
  const scale = minBlockScale(timeNeededMinutes);
  return snapTo(scale, clampToScale(scale, defaultEvenLengthMinutes));
};

/* The block a time target shows against a given total: what was chosen before
   if there is one, the user's own default otherwise.

   The two ways it comes back empty are **not** the same, and keeping them
   apart is what the memory is for. A total too short to divide leaves the line
   *unavailable* — the user has decided nothing, so the memory is untouched and
   the block returns as soon as the total grows. A total that simply cannot
   hold the chosen block is an answer, and `withTimeNeeded` forgets it. */
const blockAt = (
  remembered: TargetMemory,
  timeNeededMinutes: number | null,
  defaultEvenLengthMinutes: number,
): number | null => {
  if (!remembered.dividable || !canDivide(timeNeededMinutes)) return null;

  const wanted = remembered.minBlockMinutes ?? defaultEvenLengthMinutes;

  return timeNeededMinutes !== null && wanted > timeNeededMinutes
    ? null
    : defaultMinBlock(timeNeededMinutes, wanted);
};

/* What a target shows when it is switched back to. Only the fields that belong
   to the mode come back, which is what keeps the two exclusive. */
type TargetFields = Pick<
  TargetDraft,
  'timeNeededMinutes' | 'minBlockMinutes' | 'repetitionsNeeded'
>;

const restore = (
  mode: TargetMode,
  remembered: TargetMemory,
  defaultEvenLengthMinutes: number,
): TargetFields => {
  if (mode === 'repetitions') {
    return {
      timeNeededMinutes: null,
      minBlockMinutes: null,
      repetitionsNeeded: remembered.repetitionsNeeded,
    };
  }

  if (mode === 'none') {
    return {
      timeNeededMinutes: null,
      minBlockMinutes: null,
      repetitionsNeeded: null,
    };
  }

  const timeNeededMinutes = remembered.timeNeededMinutes;

  return {
    timeNeededMinutes,
    minBlockMinutes: blockAt(
      remembered,
      timeNeededMinutes,
      defaultEvenLengthMinutes,
    ),
    repetitionsNeeded: null,
  };
};

export const withMode = (
  state: TargetState,
  mode: TargetMode,
  defaultEvenLengthMinutes: number,
): TargetState => {
  if (mode === state.mode) return state;

  return {
    ...state,
    mode,
    /* The window survives the switch: it says when the work may happen, which
       is true whichever target is being asked for. */
    value: {
      ...restore(mode, state.remembered, defaultEvenLengthMinutes),
      ...boundsOf(state.value),
    },
  };
};

export const withTimeNeeded = (
  state: TargetState,
  timeNeededMinutes: number,
  defaultEvenLengthMinutes: number,
): TargetState => {
  const wanted = state.remembered.minBlockMinutes ?? defaultEvenLengthMinutes;

  /* A total that cannot hold the block is an answer, not an obstacle: the
     block goes and the memory forgets it, so it does not reappear the next
     time this target is opened. A total too short to divide at all is the
     other case entirely and is left to `blockAt`. */
  const outgrown =
    state.remembered.dividable &&
    canDivide(timeNeededMinutes) &&
    wanted > timeNeededMinutes;

  const remembered: TargetMemory = {
    ...state.remembered,
    timeNeededMinutes,
    dividable: state.remembered.dividable && !outgrown,
  };

  return {
    mode: 'time',
    value: {
      timeNeededMinutes,
      minBlockMinutes: blockAt(
        remembered,
        timeNeededMinutes,
        defaultEvenLengthMinutes,
      ),
      repetitionsNeeded: null,
      ...boundsOf(state.value),
    },
    remembered,
  };
};

export const withMinBlock = (
  state: TargetState,
  minBlockMinutes: number | null,
): TargetState => ({
  ...state,
  value: { ...state.value, minBlockMinutes },
  /* Unticking keeps the number and only records the intent, so ticking the
     line again offers back what was chosen rather than the default. */
  remembered:
    minBlockMinutes === null
      ? { ...state.remembered, dividable: false }
      : { ...state.remembered, minBlockMinutes, dividable: true },
});

export const withRepetitions = (
  state: TargetState,
  repetitionsNeeded: number,
): TargetState => ({
  mode: 'repetitions',
  value: {
    timeNeededMinutes: null,
    minBlockMinutes: null,
    repetitionsNeeded,
    ...boundsOf(state.value),
  },
  remembered: { ...state.remembered, repetitionsNeeded },
});

/* A ticked box with nothing in its field is the only thing this block can get
   wrong: neither target has a default, so ticking one states an intention the
   form still needs a number for. */
export const targetProblems = (state: TargetState): FieldProblem[] => {
  if (state.mode === 'time' && state.value.timeNeededMinutes === null) {
    return [
      {
        fieldId: TARGET_FIELD_IDS.timeNeeded,
        message: 'Set how much time this needs',
      },
    ];
  }

  if (state.mode === 'repetitions' && state.value.repetitionsNeeded === null) {
    return [
      {
        fieldId: TARGET_FIELD_IDS.repetitions,
        message: 'Set how many repetitions this needs',
      },
    ];
  }

  return [];
};

/* Temporal values are objects, so `===` compares identity and would call every
   reopened form dirty. `.equals` is the only comparison that means what this
   needs. */
const sameMoment = (
  a: { equals: (other: never) => boolean } | null,
  b: unknown | null,
) => (a === null || b === null ? a === b : a.equals(b as never));

const same = (a: TargetDraft, b: TargetDraft) =>
  a.timeNeededMinutes === b.timeNeededMinutes &&
  a.minBlockMinutes === b.minBlockMinutes &&
  a.repetitionsNeeded === b.repetitionsNeeded &&
  sameMoment(a.earliestDate, b.earliestDate) &&
  sameMoment(a.earliestTime, b.earliestTime) &&
  sameMoment(a.deadlineDate, b.deadlineDate) &&
  sameMoment(a.deadlineTime, b.deadlineTime);

/* The window is only offered once a target is asked for, so with no target
   there is nothing on screen for it to describe and nothing to save. */
export const withBound = (
  state: TargetState,
  bound: TargetBound,
  moment: Temporal.PlainDate | Temporal.PlainTime | null,
): TargetState => ({
  ...state,
  /* Re-checked on every change, not only on open: the pickers stop an
     impossible window being *picked*, but moving a date the other end is
     already measured against can still strand it — set both ends on different
     days, then pull the deadline back onto the earliest one. */
  value: withPossibleWindow({ ...state.value, [bound]: moment }),
});

/* What the draft would actually be written as. A target still missing its own
   number is not saved at all, so the default block hanging off it is not
   either — otherwise merely ticking a box would count as an edit, and closing
   would offer to discard a number the user never chose. */
const savable = (state: TargetState, problems: FieldProblem[]): TargetDraft =>
  problems.length > 0 || state.mode === 'none' ? EMPTY_TARGET : state.value;

/* Dirty compares what would be saved, not what is on screen, and never the
   mode: a box ticked over an empty field holds nothing to save and nothing to
   lose, so closing on one must not offer to discard anything. */
export const buildReport = (
  state: TargetState,
  baseline: TargetDraft,
): TargetReport => {
  const problems = targetProblems(state);
  const value = savable(state, problems);

  return {
    isDirty: !same(value, baseline),
    isValid: problems.length === 0,
    problems,
    value,
  };
};
