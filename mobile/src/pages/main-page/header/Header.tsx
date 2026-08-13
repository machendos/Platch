import './Header.css';

import { useState } from 'react';
import '@mobiscroll/react/dist/css/mobiscroll.min.css';
import { Datepicker } from '@mobiscroll/react';
import type { MbscDatepickerChangeEvent } from '@mobiscroll/react/dist/src/core/components/datepicker/datepicker.types.public';
import { fromJsDate, toJsDate } from '../../../system/helpers/helpers';
import { serializeRange } from '../../../system/helpers/dateTimeSerializers';
import type { DateRange } from '../../../system/helpers/dateRange';
import { WEEK_STARTS_ON } from '../layout-config';
import { DateFrameInput } from './DateFrameInput';
import { HeaderMenu } from './HeaderMenu';

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
      <button
        className={
          isDispatcherVisible ? 'header-button active' : 'header-button'
        }
        onClick={onToggleDispatcher}
      >
        A
      </button>
      <button
        className={isCalendarVisible ? 'header-button active' : 'header-button'}
        onClick={onToggleCalendar}
      >
        B
      </button>
      <button
        className="header-button header-button-glyph"
        aria-label="Previous period"
        onClick={() => onPageChange(-1)}
      >
        ‹
      </button>
      <button className="header-button" onClick={onToday}>
        Today
      </button>
      <button
        className="header-button header-button-glyph"
        aria-label="Next period"
        onClick={() => onPageChange(1)}
      >
        ›
      </button>

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
