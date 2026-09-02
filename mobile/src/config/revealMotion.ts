export const REVEAL_MOTION = {
  // Read by the CSS transition and by the timer that keeps the content mounted
  // long enough to animate out, so it is declared once here.
  durationMs: 200,
  /* The exit unmounts this much *after* the transition rather than on the same
     tick. The reveal animates opacity and transform, so WebKit composites it on
     its own layer; tearing that layer down in the frame the animation finishes
     can leave its last painted rows on screen. Nothing repaints them, because
     nothing above them changed — the DOM is already correct and the pixels are
     not. A few frames of margin lets the final paint land before the node goes. */
  exitTailMs: 80,
} as const;
