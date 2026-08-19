// A device whose primary pointer cannot hover and is imprecise is a
// touchscreen. Asked once and cached: it decides which control the field is,
// and swapping that under a focused caret would be worse than being wrong on a
// hybrid laptop, where the coarse-pointer answer is the safer default anyway.
let coarse: boolean | null = null;

export const isCoarsePointer = (): boolean => {
  if (coarse !== null) return coarse;

  coarse =
    typeof window === 'undefined' || !window.matchMedia
      ? true
      : window.matchMedia('(pointer: coarse)').matches;

  return coarse;
};
