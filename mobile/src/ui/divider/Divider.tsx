import { useEffect, useRef, useState } from 'react';
import './Divider.css';

/* A seam that is always drawn and only sometimes movable. `draggable` gates the
   grip, the hit area and the gesture together, so a seam between two collapsed
   neighbours is a line and nothing else. */

type DividerProps = {
  orientation: 'vertical' | 'horizontal';
  draggable: boolean;
  onDragStart: () => void;
  onDrag: (delta: number) => void;
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
    onDrag(position - dragOrigin.current);
  };

  return (
    <div
      className={[
        'divider',
        `divider-${orientation}`,
        draggable && 'divider-draggable',
        isDragging && 'divider-dragging',
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onLostPointerCapture={() => {
        setIsDragging(false);
        onDragEnd();
      }}
    >
      {draggable && <span className="divider-grip" />}
    </div>
  );
};
