import './Header.css';

type HeaderProps = {
  isDispatcherVisible: boolean;
  isCalendarVisible: boolean;
  onToggleDispatcher: () => void;
  onToggleCalendar: () => void;
  /** Whole pages, signed: -1 is back, 1 is forward. */
  onPageChange: (delta: number) => void;
  onToday: () => void;
};

/**
 * The page's controls: which panes are shown, and where the calendar is
 * pointed.
 *
 * It owns no state. The panes' visibility and the paged date both live in
 * MainPage, because the calendar needs them too — this only reports presses.
 */
export const Header = ({
  isDispatcherVisible,
  isCalendarVisible,
  onToggleDispatcher,
  onToggleCalendar,
  onPageChange,
  onToday,
}: HeaderProps) => (
  <header className="main-page-header">
    {/* TODO: A and B are placeholders for the pane toggles. */}
    <button
      className={isDispatcherVisible ? 'header-button active' : 'header-button'}
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
  </header>
);
