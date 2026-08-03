import { useRef, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Calendar } from './calendar/Calendar';
import { Dispatcher } from './dispatcher/Dispatcher';
import { Divider } from './Divider';
import { layoutCssVariables } from './layout-constants';
import './MainPage.css';

const MIN_PANE_WIDTH = 60;
const DEFAULT_PANE_WEIGHTS = { dispatcher: 1, calendar: 2 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const MainPage = () => {
  const [isDispatcherVisible, setIsDispatcherVisible] = useState(true);
  const [isCalendarVisible, setIsCalendarVisible] = useState(true);

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
    const applied = clamp(
      delta,
      MIN_PANE_WIDTH - start.dispatcher,
      start.calendar - MIN_PANE_WIDTH,
    );
    setPaneWeights({
      dispatcher: start.dispatcher + applied,
      calendar: start.calendar - applied,
    });
  };

  // dispatcher | divider | calendar.
  const paneTrack = (weight: number) =>
    `minmax(${MIN_PANE_WIDTH}px, ${weight}fr)`;
  const gridTemplateColumns =
    isDispatcherVisible && isCalendarVisible
      ? `${paneTrack(paneWeights.dispatcher)} auto ${paneTrack(paneWeights.calendar)}`
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

            {isCalendarVisible && <Calendar />}
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};
