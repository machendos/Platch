import { useLayoutEffect, useRef, useState } from 'react';

/* Three outcomes, in order of preference:

   1. the label fits the box at the standard font — nothing changes;
   2. it does not, so the text shrinks to fit, which moves nothing;
   3. shrinking would take it under the floor, so the box expands instead.

   Only (3) moves the controls after the box, and it needs a label carrying a
   year, so it needs paging out of this one.

   Measured on a canvas: measureText does not force layout the way reading the
   painted label would, and answers before the browser has drawn the string at
   a size that is about to change. The box's own width comes from the token
   rather than from the element, so an expansion in (3) cannot feed back into
   the next measurement and ratchet.

   Anything read here that is not a token — the caret's width, the padding, the
   gap — comes from the live styles, so the numbers cannot drift from the CSS
   that produces them. */

const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');

type Fitted = {
  fontPx: number | null;
  /** Set only when even the floor does not fit. */
  widthPx: number | null;
};

export const useFittedLabel = (text: string, widthToken: string) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [fitted, setFitted] = useState<Fitted>({ fontPx: null, widthPx: null });

  useLayoutEffect(() => {
    const label = ref.current;
    const box = label?.parentElement;
    if (!label || !box || !context) return;

    const boxStyle = getComputedStyle(box);
    const labelStyle = getComputedStyle(label);

    const basePx = parseFloat(
      labelStyle.getPropertyValue('--text-button-font'),
    );
    const floorPx = parseFloat(
      boxStyle.getPropertyValue('--header-range-min-font'),
    );
    const boxPx = parseFloat(boxStyle.getPropertyValue(widthToken));

    const caret = label.nextElementSibling?.getBoundingClientRect().width ?? 0;
    const chrome =
      parseFloat(boxStyle.paddingLeft) +
      parseFloat(boxStyle.paddingRight) +
      parseFloat(boxStyle.columnGap || '0') +
      caret;

    if (!basePx || !floorPx || !boxPx) return;

    const widthAt = (px: number) => {
      context.font = `${labelStyle.fontStyle} ${labelStyle.fontWeight} ${px}px ${labelStyle.fontFamily}`;
      return context.measureText(text).width;
    };

    const room = boxPx - chrome;
    const needed = widthAt(basePx);

    if (needed <= room) {
      setFitted({ fontPx: null, widthPx: null });
      return;
    }

    const shrunk = basePx * (room / needed);
    if (shrunk >= floorPx) {
      setFitted({ fontPx: shrunk, widthPx: null });
      return;
    }

    setFitted({
      fontPx: floorPx,
      widthPx: Math.ceil(widthAt(floorPx) + chrome),
    });
  }, [text, widthToken]);

  return { ref, ...fitted };
};
