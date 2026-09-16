import './Header.css';

import { useState } from 'react';
import type { ReactNode } from 'react';
import '@mobiscroll/react/dist/css/mobiscroll.min.css';
import { Datepicker } from '@mobiscroll/react';
import type { MbscDatepickerChangeEvent } from '@mobiscroll/react/dist/src/core/components/datepicker/datepicker.types.public';
import { fromJsDate, toJsDate } from '../../../system/helpers/helpers';
import { serializeRange } from '../../../system/helpers/dateTimeSerializers';
import type { DateRange } from '../../../system/helpers/dateRange';
import { WEEK_STARTS_ON } from '../../../config/calendarPreferences';
import { DateFrameInput } from './DateFrameInput';
import { HeaderMenu } from './HeaderMenu';
import { usePress } from '../../../ui/buttons/pressable/usePress';

/* usePress is a hook, so each control needs its own call — hence a component
   rather than a shared class name. Local to the header because these are the
   toolbar's own controls; the general one arrives with Button. */
const HeaderButton = ({
  onClick,
  className,
  label,
  children,
}: {
  onClick: () => void;
  className?: string;
  label?: string;
  children: ReactNode;
}) => {
  const press = usePress();

  return (
    <button
      ref={press.ref}
      className={[press.className, 'header-button', className]
        .filter(Boolean)
        .join(' ')}
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={press.onPointerDown}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onPointerLeave={press.onPointerLeave}
    >
      {children}
    </button>
  );
};

type HeaderProps = {
  isDispatcherVisible: boolean;
  isCalendarVisible: boolean;
  isDarkModeEnabled: boolean;
  dateFrame: DateRange;
  onToggleDispatcher: () => void;
  onToggleCalendar: () => void;
  /** Whole pages, signed: -1 is back, 1 is forward. */
  onPageChange: (delta: number) => void;
  onToday: () => void;
  onRangeChange: (range: DateRange) => void;
};

export const Header = ({
  isDispatcherVisible,
  isCalendarVisible,
  isDarkModeEnabled,
  dateFrame,
  onToggleDispatcher,
  onToggleCalendar,
  onPageChange,
  onToday,
  onRangeChange,
}: HeaderProps) => {
  // The half-made range, held only while the picker is open.
  const [pendingRange, setPendingRange] = useState<
    [Date | null, Date | null] | null
  >(null);

  const handleRangeChange = ({ value }: MbscDatepickerChangeEvent) => {
    const [start, end] = value as [Date | null, Date | null];

    if (start && end) {
      setPendingRange(null);
      onRangeChange({ start: fromJsDate(start), end: fromJsDate(end) });
      return;
    }

    setPendingRange([start, end]);
  };

  return (
    <header className="main-page-header">
      {/* TODO: A and B are placeholders for the pane toggles. */}
      <HeaderButton
        className={isDispatcherVisible ? 'active' : undefined}
        onClick={onToggleDispatcher}
      >
        A
      </HeaderButton>
      <HeaderButton
        className={isCalendarVisible ? 'active' : undefined}
        onClick={onToggleCalendar}
      >
        B
      </HeaderButton>
      <HeaderButton
        className="header-button-glyph"
        label="Previous period"
        onClick={() => onPageChange(-1)}
      >
        ‹
      </HeaderButton>
      <HeaderButton onClick={onToday}>Today</HeaderButton>
      <HeaderButton
        className="header-button-glyph"
        label="Next period"
        onClick={() => onPageChange(1)}
      >
        ›
      </HeaderButton>

      <Datepicker
        select="range"
        controls={['calendar']}
        display="anchored"
        touchUi="auto"
        firstDay={WEEK_STARTS_ON}
        // Pinned rather than left on `auto`, which picks by platform and would
        // render this picker `mbsc-material` in environments where the
        // Eventcalendar — pinned in Calendar.tsx — still renders `mbsc-ios`.
        theme="ios"
        themeVariant={isDarkModeEnabled ? 'dark' : 'light'}
        // Controlled, so a page turn or a swipe leaves the picker showing the
        // range the calendar actually moved to rather than the last one picked
        // — except mid-pick, where the half-made range has to win or the click
        // that started it gets undone.
        value={
          pendingRange ?? [toJsDate(dateFrame.start), toJsDate(dateFrame.end)]
        }
        // Dismissing part-way through leaves a start with no end; forget it,
        // so the field and the next open show the range actually in effect.
        onClose={() => setPendingRange(null)}
        inputComponent={DateFrameInput}
        inputProps={{
          serializedRange: serializeRange(dateFrame.start, dateFrame.end),
        }}
        onChange={handleRangeChange}
      />

      <HeaderMenu />
    </header>
  );
};
