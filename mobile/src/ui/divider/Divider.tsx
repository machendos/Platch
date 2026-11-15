import { useEffect, useRef, useState } from 'react';
import './Divider.css';

/* The browser retargets a tap to the nearest control when nothing clickable is
   directly under it, so a press on a seam four pixels from a button arrived at
   the seam while the click arrived at the button — the seam moved and the
   button fired. Swallowed in the capture phase, before React sees it, and
   disarmed by the click it was waiting for or by the next press if none came. */
const swallowNextClick = () => {
  const disarm = () => {
    document.removeEventListener('click', swallow, true);
    document.removeEventListener('pointerdown', disarm, true);
  };
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    disarm();
  };

  document.addEventListener('click', swallow, true);
  document.addEventListener('pointerdown', disarm, true);
};

/* A seam that is always drawn and only sometimes movable. `draggable` gates the
   grip, the hit area and the gesture together, so a seam between two collapsed
   neighbours is a line and nothing else. */

type DividerProps = {
  orientation: 'vertical' | 'horizontal';
  draggable: boolean;
  onDragStart: () => void;
  /** Returning true means the drag was clamped — the seam then says so rather
      than just refusing to move. */
  onDrag: (delta: number) => boolean | void;
  onDragEnd: () => void;
};

export const Divider = ({
  orientation,
  draggable,
  onDragStart,
  onDrag,
  onDragEnd,
}: DividerProps) => {
  const dragOrigin = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAtLimit, setIsAtLimit] = useState(false);

  /* On <body> rather than the divider, so it survives the pointer leaving a
     one-pixel element mid-drag. Cleared by the effect teardown, which also
     covers the divider unmounting while still held. */
  useEffect(() => {
    if (!isDragging) return;
    const cursor =
      orientation === 'vertical' ? 'is-dragging-col' : 'is-dragging-row';
    document.body.classList.add(cursor);
    return () => document.body.classList.remove(cursor);
  }, [isDragging, orientation]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    event.preventDefault();

    dragOrigin.current =
      orientation === 'vertical' ? event.clientX : event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    onDragStart();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const position = orientation === 'vertical' ? event.clientX : event.clientY;
    setIsAtLimit(onDrag(position - dragOrigin.current) === true);
  };

  return (
    <div
      className={[
        'divider',
        `divider-${orientation}`,
        draggable && 'divider-draggable',
        isDragging && 'divider-dragging',
        isAtLimit && 'divider-at-limit',
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onLostPointerCapture={() => {
        swallowNextClick();
        setIsDragging(false);
        setIsAtLimit(false);
        onDragEnd();
      }}
    >
      {draggable && <span className="divider-grip" />}
    </div>
  );
};
