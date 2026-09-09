import { useCallback, useState } from 'react';
import { useFormState } from './useFormState';

export type SectionReport = { isDirty: boolean; isValid: boolean };

type EntityFormOptions<T extends Record<string, string | boolean | null>> = {
  initialValues: T;
  reports: (SectionReport | null)[];
  onDismiss: () => void;
};

/* The plumbing every entity form repeats: what the scalar fields hold,
   whether anything has changed, whether it may be saved, and the save itself.
   It builds no payload and knows no endpoint — `save` takes the submit as an
   argument so the mapping stays a pure function with tests of its own. */
export const useEntityForm = <T extends Record<string, string | boolean | null>>({
  initialValues,
  reports,
  onDismiss,
}: EntityFormOptions<T>) => {
  const { values, set, isDirty: areValuesDirty } = useFormState(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

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
