import { useRef, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Calendar } from './calendar/Calendar';
import { Dispatcher } from './dispatcher/Dispatcher';
import { Divider } from './Divider';
import {
  CALENDAR_MIN_PANE_WIDTH,
  DISPATCHER_MIN_PANE_WIDTH,
  layoutCssVariables,
} from './layout-constants';
import './MainPage.css';
import { clamp } from '../../common/helpers';

// TODO: dynamic default pane weights
const DEFAULT_PANE_WEIGHTS = { dispatcher: 1, calendar: 2 };

export const MainPage = () => {
  const [isDispatcherVisible, setIsDispatcherVisible] = useState(true);
  const [isCalendarVisible, setIsCalendarVisible] = useState(true);
  const [isDarkModeEnabled] = useState(false);

  const [paneWeights, setPaneWeights] = useState(DEFAULT_PANE_WEIGHTS);

  const workspaceRef = useRef<HTMLElement>(null);
  const widthsAtDragStart = useRef({ dispatcher: 0, calendar: 0 });

  const rememberWidths = () => {
    const workspace = workspaceRef.current;
    const dispatcher = workspace?.querySelector('.dispatcher');
    const calendar = workspace?.querySelector('.calendar');
    if (!dispatcher || !calendar) return;
    widthsAtDragStart.current = {
      dispatcher: dispatcher.getBoundingClientRect().width,
      calendar: calendar.getBoundingClientRect().width,
    };
  };

  const resizePanes = (delta: number) => {
    const start = widthsAtDragStart.current;
    // Negative when drags left, positive when drags right
    const appliedDelta = clamp(
      delta,
      DISPATCHER_MIN_PANE_WIDTH - start.dispatcher,
      start.calendar - CALENDAR_MIN_PANE_WIDTH,
    );
    setPaneWeights({
      dispatcher: start.dispatcher + appliedDelta,
      calendar: start.calendar - appliedDelta,
    });
  };

  // dispatcher | divider | calendar.
  const paneTrack = (weight: number, min: number) =>
    `minmax(${min}px, ${weight}fr)`;
  const gridTemplateColumns =
    isDispatcherVisible && isCalendarVisible
      ? [
          paneTrack(paneWeights.dispatcher, DISPATCHER_MIN_PANE_WIDTH),
          'auto',
          paneTrack(paneWeights.calendar, CALENDAR_MIN_PANE_WIDTH),
        ].join(' ')
      : '1fr';

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div className="main-page-shell" style={layoutCssVariables}>
          <header className="main-page-header">
            <button
              className={
                isDispatcherVisible ? 'header-button active' : 'header-button'
              }
              onClick={() => setIsDispatcherVisible((v) => !v)}
            >
              A
            </button>
            <button
              className={
                isCalendarVisible ? 'header-button active' : 'header-button'
              }
              onClick={() => setIsCalendarVisible((v) => !v)}
            >
              B
            </button>
            <button
              className="header-button header-button-glyph"
              aria-label="Previous period"
            >
              ‹
            </button>
            <button className="header-button">Today</button>
            <button
              className="header-button header-button-glyph"
              aria-label="Next period"
            >
              ›
            </button>
          </header>

          <main
            className="workspace"
            ref={workspaceRef}
            style={{ gridTemplateColumns }}
          >
            {isDispatcherVisible && <Dispatcher />}

            {isDispatcherVisible && isCalendarVisible && (
              <Divider
                orientation="vertical"
                onDragStart={rememberWidths}
                onDrag={resizePanes}
              />
            )}

            {isCalendarVisible && (
              <Calendar isDarkModeEnabled={isDarkModeEnabled} />
            )}
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};
