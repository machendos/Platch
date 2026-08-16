import './Wheel.css';

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { WHEEL_FEEL } from '../../config/wheelFeel';
import { armTicks, tick } from '../../system/feedback/tick';
import {
  clampOffset,
  decayProgress,
  detentOffset,
  easeOut,
  indexAt,
  isBeyondEnds,
  planFling,
  velocityFrom,
  withRubberBand,
} from './wheelPhysics';
import type { PointerSample } from './wheelPhysics';

export type WheelOption = {
  value: number;
  label: string;
};

type WheelProps = {
  options: WheelOption[];
  value: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  className?: string;
};

export const Wheel = ({
  options,
  value,
  onChange,
  label,
  unit,
  className,
}: WheelProps) => {
  const list = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const wheeling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offset = useRef(0);
  const row = useRef(0);
  const frame = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const dragging = useRef(false);
  const samples = useRef<PointerSample[]>([]);
  const origin = useRef({ y: 0, offset: 0, moved: 0 });

  // The animation loop outlives the render that started it, so it reads these
  // rather than the closure it was created in.
  const live = useRef({ options, value, onChange });
  live.current = { options, value, onChange };

  const selected = options.findIndex((option) => option.value === value);
  const index = Math.max(selected, 0);

  const place = (next: number, notify: boolean) => {
    const { options: current, value: held, onChange: emit } = live.current;

    offset.current = next;
    if (list.current) {
      list.current.style.transform = `translate3d(0, ${-next}px, 0)`;
    }

    const landed = indexAt(next, WHEEL_FEEL.itemHeight, current.length);
    if (landed === row.current) return;
    row.current = landed;
    if (!notify) return;

    tick();
    const option = current[landed];
    if (option && option.value !== held) emit(option.value);
  };

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = null;
  };

  const glide = (
    to: number,
    duration: number,
    curve: (progress: number) => number = easeOut,
    onArrival?: () => void,
  ) => {
    const from = offset.current;
    const distance = to - from;

    if (Math.abs(distance) < 0.5) {
      place(to, true);
      onArrival?.();
      return;
    }

    const started = performance.now();
    pending.current = to;

    const step = () => {
      const elapsed = performance.now() - started;
      const progress = Math.min(elapsed / duration, 1);
      place(from + distance * curve(progress), true);

      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }

      frame.current = null;
      pending.current = null;
      onArrival?.();
    };

    frame.current = requestAnimationFrame(step);
  };

  useLayoutEffect(() => {
    place(index * WHEEL_FEEL.itemHeight, false);
    return stop;
    // Mount only. Later moves come from the gesture or the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A value changed from outside — usually the parent snapping this wheel onto
  // a coarser grid — is followed silently. A gesture or a fling in flight owns
  // the wheel and is left alone.
  useEffect(() => {
    if (dragging.current || frame.current !== null) return;

    const target = index * WHEEL_FEEL.itemHeight;
    if (Math.abs(offset.current - target) < 0.5) return;

    place(target, false);
  }, [index, options.length]);

  // Mouse and trackpad. Attached natively rather than through onWheel because
  // preventDefault is needed to stop the page scrolling behind the wheel, and
  // React's wheel listener is passive. Same reason useCalendarZoom does it.
  useEffect(() => {
    const element = surface.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      stop();

      // Firefox reports lines rather than pixels.
      const lines = event.deltaMode === 1 ? 16 : 1;
      const count = live.current.options.length;

      place(
        clampOffset(
          offset.current + event.deltaY * lines * WHEEL_FEEL.wheelScale,
          count,
          WHEEL_FEEL.itemHeight,
        ),
        true,
      );

      if (wheeling.current) clearTimeout(wheeling.current);
      wheeling.current = setTimeout(() => {
        wheeling.current = null;
        glide(
          detentOffset(offset.current, WHEEL_FEEL.itemHeight, count),
          WHEEL_FEEL.minSettleMs,
        );
      }, WHEEL_FEEL.wheelSettleMs);
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
      if (wheeling.current) clearTimeout(wheeling.current);
    };
    // Subscribed once: `glide` and `place` are rebuilt every render, and
    // re-attaching a non-passive listener that often would drop wheel events
    // mid-scroll. Both read live state through refs, so they do not go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A hidden page suspends requestAnimationFrame, which would strand a fling
  // between two detents with its value never committed. Switching away lands it
  // on the row it was heading for.
  useEffect(() => {
    const settleNow = () => {
      if (!document.hidden || pending.current === null) return;

      const target = pending.current;
      stop();
      place(target, true);
    };

    document.addEventListener('visibilitychange', settleNow);
    return () => document.removeEventListener('visibilitychange', settleNow);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    stop();
    armTicks();
    dragging.current = true;
    origin.current = { y: event.clientY, offset: offset.current, moved: 0 };
    samples.current = [{ time: performance.now(), y: event.clientY }];
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;

    const travelled = event.clientY - origin.current.y;
    origin.current.moved = Math.max(origin.current.moved, Math.abs(travelled));

    samples.current.push({ time: performance.now(), y: event.clientY });
    if (samples.current.length > 12) samples.current.shift();

    place(
      withRubberBand(
        origin.current.offset - travelled,
        live.current.options.length,
        WHEEL_FEEL.itemHeight,
        WHEEL_FEEL.overscroll,
      ),
      true,
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);

    const count = live.current.options.length;

    // Let go past an end and it comes back to it, rather than the throw being
    // measured from a position the wheel is not allowed to rest at.
    if (isBeyondEnds(offset.current, count, WHEEL_FEEL.itemHeight)) {
      glide(
        clampOffset(offset.current, count, WHEEL_FEEL.itemHeight),
        WHEEL_FEEL.bounceMs,
      );
      return;
    }

    // A tap is not a throw: it moves by the number of rows between the pill and
    // the finger, which is the only way to reach a row without dragging — and
    // the only way at all to pick the row already under the pill.
    if (origin.current.moved <= WHEEL_FEEL.tapSlop) {
      const box = event.currentTarget.getBoundingClientRect();
      const rows = Math.round(
        (event.clientY - (box.top + box.height / 2)) / WHEEL_FEEL.itemHeight,
      );

      glide(
        clampOffset(
          (row.current + rows) * WHEEL_FEEL.itemHeight,
          count,
          WHEEL_FEEL.itemHeight,
        ),
        WHEEL_FEEL.minSettleMs,
      );
      return;
    }

    // Dragging down moves the wheel to earlier values, so the throw is the
    // finger's velocity inverted.
    const velocity = -velocityFrom(samples.current, performance.now());
    const { to, duration, bounce } = planFling(
      offset.current,
      velocity,
      count,
      WHEEL_FEEL.itemHeight,
      WHEEL_FEEL,
    );

    glide(
      to,
      duration,
      (progress) =>
        decayProgress(
          progress * duration,
          duration,
          WHEEL_FEEL.decelerationRate,
        ),
      bounce ? () => glide(bounce.to, bounce.duration) : undefined,
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    const count = options.length;

    if (step) {
      event.preventDefault();
      stop();
      glide(
        clampOffset(
          (row.current + step) * WHEEL_FEEL.itemHeight,
          count,
          WHEEL_FEEL.itemHeight,
        ),
        WHEEL_FEEL.minSettleMs,
      );
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      stop();
      glide(
        event.key === 'Home'
          ? 0
          : detentOffset(Infinity, WHEEL_FEEL.itemHeight, count),
        WHEEL_FEEL.minSettleMs,
      );
    }
  };

  return (
    <div
      ref={surface}
      className={className ? `wheel ${className}` : 'wheel'}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      style={
        {
          '--wheel-item-height': `${WHEEL_FEEL.itemHeight}px`,
          '--wheel-rows': WHEEL_FEEL.visibleRows,
        } as CSSProperties
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <div className="wheel-viewport">
        <div className="wheel-list" ref={list}>
          {options.map((option) => (
            <div
              key={option.value}
              className={
                option.value === value
                  ? 'wheel-item wheel-item-selected'
                  : 'wheel-item'
              }
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </div>
          ))}
        </div>
      </div>

      {unit && (
        <span className="wheel-unit" aria-hidden="true">
          {unit}
        </span>
      )}
    </div>
  );
};
