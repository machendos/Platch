import type { CSSProperties } from 'react';

// Single source of truth for the sizes that both the layout math (TSX)
// and the stylesheet need. The stylesheet reads them through the CSS
// variables below, which MainPage.tsx applies once on the page shell.
export const DISPATCHER_SECTION_HEADER_HEIGHT = 36;
export const DIVIDER_SIZE = 12;

export const layoutCssVariables = {
  '--section-header-height': `${DISPATCHER_SECTION_HEADER_HEIGHT}px`,
  '--divider-size': `${DIVIDER_SIZE}px`,
} as CSSProperties;
