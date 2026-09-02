import type { CreateProjectDto } from '../api/structures/CreateProjectDto';
import type { ProjectStatus } from './components/projectStatusSwitch/ProjectStatusSwitch';
import type { TimeComponentFields } from '../api/structures/TimeComponentFields';
import type { TargetDraft } from './components/targetComponent/targetState';

export type ProjectFormValues = {
  name: string;
  goal: string;
  context: string;
  status: ProjectStatus;
  isTimezoneFlexible: boolean;
};

type PayloadInput = {
  values: ProjectFormValues;
  /* The target report's value, which is already what would be saved rather
     than what is on screen. */
  target: TargetDraft;
  timeComponents: TimeComponentFields[];
  parentProjectId: string | null;
  colorId: string | null;
  /* Passed in rather than read here, so the mapping stays pure and the zone is
     assertable in a test. */
  timeZone: string;
};

/* Empty is not a value. A field nobody typed in must be absent from the
   payload rather than present as '' — the column is nullable, and an empty
   string comes back as a goal that exists and says nothing. */
const text = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/* The form speaks null (a column standing empty), the DTO speaks undefined (a
   key left out). One conversion, in one place. */
const set = <T>(value: T | null): T | undefined => value ?? undefined;

/* The form's fields as the create endpoint wants them. Pure: everything it
   needs is an argument, so what gets sent can be asserted without a server or
   a rendered modal.

   Temporal serialises itself into exactly the shapes the DTO asks for —
   PlainDate.toString() is `2026-06-19`, PlainTime.toString() is `17:45:00` —
   so there is no formatting here that could drift from the contract. */
export const buildCreateProjectDto = ({
  values,
  target,
  timeComponents,
  parentProjectId,
  colorId,
  timeZone,
}: PayloadInput): CreateProjectDto => ({
  name: text(values.name),
  goal: text(values.goal),
  context: text(values.context),

  /* The only field with no empty state: the switch always reads one way or the
     other, and it opens on Active. */
  projectStatus: values.status,

  timeNeededMinutes: set(target.timeNeededMinutes),
  minBlockMinutes: set(target.minBlockMinutes),
  repetitionsNeeded: set(target.repetitionsNeeded),

  earliestDate: target.earliestDate?.toString(),
  earliestTime: target.earliestTime?.toString(),
  deadlineDate: target.deadlineDate?.toString(),
  deadlineTime: target.deadlineTime?.toString(),

  flexibleTimezone: values.isTimezoneFlexible,
  /* Sent whether or not the zone is soft: it records where the times were
     written, which is what a later reading of them has to be relative to. */
  originalTimezone: timeZone,

  parentProjectId: set(parentProjectId),
  colorId: set(colorId),

  timeComponents,
});
