// Asked fresh every time rather than cached like `isCoarsePointer`: this one is
// an accessibility preference the user can change while the app is open, and
// nothing here is worse for being answered late.
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
