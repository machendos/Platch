/* Fields mobiscroll renders but does not declare.
 *
 * The runtime reads `title` and `cssClass` on both, and the docs list `title`
 * for `invalid` — the shipped interfaces just omit them.
 *
 * Two things about the shape of this file are load-bearing. The `export {}`
 * makes it a module: without it `declare module` is an *ambient* declaration
 * that replaces the interface instead of merging, and `start` and `end`
 * silently stop existing. And the paths are the modules that *declare* these
 * interfaces, not `@mobiscroll/react`, which only re-exports them —
 * augmenting a re-export replaces it the same way.
 */

export {};

declare module '@mobiscroll/react/dist/src/core/util/datetime.types.public' {
  interface MbscCalendarInvalid {
    title?: string;
    cssClass?: string;
  }
}

declare module '@mobiscroll/react/dist/src/core/shared/calendar-view/calendar-view.types.public' {
  interface MbscCalendarColor {
    title?: string;
  }
}
