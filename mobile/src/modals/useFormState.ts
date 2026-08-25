import { useCallback, useMemo, useState } from 'react';

/* Dirty is "does this differ from what we opened with", not "did anyone type".
   Typing a character and deleting it again leaves the form clean, which is the
   whole reason this compares values rather than counting edits — otherwise a
   typo and its correction would earn a "discard changes?" on the way out.

   Comparing is a shallow scan because every field's value is a string, the
   formatted one included: markdown is the storage format, so there is no tree
   to walk and no deep equality to get wrong.

   The baseline is state rather than a ref because it is something the render
   depends on — holding it in a ref left isDirty stale after a save, since
   nothing told React to look again.

   Both are seeded once. A modal reused for a different record remounts with a
   `key`, the same discipline a formatted field needs for its seed — see
   docs/rich-text.md. */
export const useFormState = <T extends Record<string, string>>(initial: T) => {
  const [values, setValues] = useState<T>(initial);
  const [baseline, setBaseline] = useState<T>(initial);

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) =>
      setValues((current) => ({ ...current, [key]: value })),
    [],
  );

  const isDirty = useMemo(
    () =>
      (Object.keys(baseline) as (keyof T)[]).some(
        (key) => values[key] !== baseline[key],
      ),
    [values, baseline],
  );

  const reset = useCallback(() => setValues(baseline), [baseline]);

  /* After a successful save the record *is* what the form holds, so that is
     what it was opened with from now on. Without this, saving and then closing
     would offer to discard the changes that were just written. */
  const markSaved = useCallback(() => setBaseline(values), [values]);

  return { values, set, isDirty, reset, markSaved };
};
