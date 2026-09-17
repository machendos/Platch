import './Header.css';

import { useState } from 'react';
import '@mobiscroll/react/dist/css/mobiscroll.min.css';
import { Datepicker } from '@mobiscroll/react';
import type { MbscDatepickerChangeEvent } from '@mobiscroll/react/dist/src/core/components/datepicker/datepicker.types.public';
import { fromJsDate, toJsDate } from '../../../system/helpers/helpers';
import { serializeRange } from '../../../system/helpers/dateTimeSerializers';
import type { DateRange } from '../../../system/helpers/dateRange';
import { WEEK_STARTS_ON } from '../../../config/calendarPreferences';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DateFrameInput } from './DateFrameInput';
import { HeaderMenu } from './HeaderMenu';
import { PaneGroup } from './PaneGroup';
import { IconButton } from '../../../ui/buttons/icon-button/IconButton';
import { TextButton } from '../../../ui/buttons/text-button/TextButton';
import type { PanesVisible } from '../layoutStorage';

type HeaderProps = {
  panes: PanesVisible;
  isDarkModeEnabled: boolean;
  dateFrame: DateRange;
  onPanesChange: (panes: PanesVisible) => void;
  /** Whole pages, signed: -1 is back, 1 is forward. */
  onPageChange: (delta: number) => void;
  onToday: () => void;
  onRangeChange: (range: DateRange) => void;
};

export const Header = ({
  panes,
  isDarkModeEnabled,
  dateFrame,
  onPanesChange,
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
      <PaneGroup panes={panes} onChange={onPanesChange} />
      <IconButton
        className="header-step"
        label="Previous period"
        size="large"
        onClick={() => onPageChange(-1)}
      >
        <ChevronLeft />
      </IconButton>

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
          isSingleDay: dateFrame.start.equals(dateFrame.end),
        }}
        onChange={handleRangeChange}
      />

      <IconButton
        className="header-step"
        label="Next period"
        size="large"
        onClick={() => onPageChange(1)}
      >
        <ChevronRight />
      </IconButton>

      {/* Permanent in both builds. With the arrows gone on touch it is the
          only way back — a swipe has no "return to origin", so a control that
          is the sole exit cannot be the conditional one. */}
      <TextButton size="large" outlined onClick={onToday}>
        Today
      </TextButton>

      <HeaderMenu />
    </header>
  );
};
