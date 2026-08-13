import { useRef, useState } from 'react';

type DividerProps = {
  orientation: 'vertical' | 'horizontal';
  onDragStart: () => void;
  onDrag: (delta: number) => void;
  onDragEnd: () => void;
};

export const Divider = ({
  orientation,
  onDragStart,
  onDrag,
  onDragEnd,
}: DividerProps) => {
  const dragOrigin = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragOrigin.current = orientation === 'vertical' ? e.clientX : e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    onDragStart();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; // not dragging
    const position = orientation === 'vertical' ? e.clientX : e.clientY;
    onDrag(position - dragOrigin.current);
  };

  return (
    <div
      className={`divider divider-${orientation}${isDragging ? ' divider-dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onLostPointerCapture={() => {
        setIsDragging(false);
        onDragEnd();
      }}
    />
  );
};
