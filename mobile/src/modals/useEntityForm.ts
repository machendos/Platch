import { useCallback, useMemo, useState } from 'react';

export type SectionReport = { isDirty: boolean; isValid: boolean };

type EntityFormOptions<T extends Record<string, string | boolean | null>> = {
  initialValues: T;
  reports: (SectionReport | null)[];
  onDismiss: () => void;
};

/* The plumbing every entity form repeats: what the scalar fields hold, whether
   anything has changed, whether it may be saved, and the save itself. It builds
   no payload and knows no endpoint — `save` takes the submit as an argument so
   the mapping stays a pure function with tests of its own.

   See docs/modals.md for why dirty compares against the opening values rather
   than counting edits, and why blocks register through one array. */
export const useEntityForm = <
  T extends Record<string, string | boolean | null>,
>({
  initialValues,
  reports,
  onDismiss,
}: EntityFormOptions<T>) => {
  const [values, setValues] = useState<T>(initialValues);
  const [baseline] = useState<T>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  /* Latched rather than re-baselined, because the blocks hold baselines of
     their own: moving this one would leave an edited time component still
     reporting dirty, and the sheet would offer to discard what it had just
     written. */
  const [isSaved, setIsSaved] = useState(false);

  const set = useCallback(
    <K extends keyof T>(data: Record<K, T[K]>) =>
      setValues((current) => ({ ...current, ...data })),
    [],
  );

  const areValuesDirty = useMemo(
    () =>
      (Object.keys(baseline) as (keyof T)[]).some(
        (key) => values[key] !== baseline[key],
      ),
    [values, baseline],
  );

  const isDirty =
    !isSaved &&
    (areValuesDirty || reports.some((report) => report?.isDirty === true));

  const canSave =
    !isSaving && reports.every((report) => report?.isValid !== false);

  const save = useCallback(
    async (submit: () => Promise<void>) => {
      setIsSaving(true);

      try {
        await submit();
        setIsSaved(true);
        onDismiss();
      } finally {
        setIsSaving(false);
      }
    },
    [onDismiss],
  );

  return { values, set, isDirty, canSave, isSaving, save };
};
