import { useEffect, useRef, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Temporal } from 'temporal-polyfill';
import { Calendar } from './calendar/Calendar';
import { Dispatcher } from './dispatcher/Dispatcher';
import { Header } from './header/Header';
import { Divider } from './Divider';
import { testEvents } from './test.data';
import { DEFAULT_PANE_WEIGHTS, layoutCssVariables } from './layout-config';
import './MainPage.css';
import type { DateRange } from '../../system/helpers/dateRange';
import type { PanesVisible } from './layoutStorage';
import { layoutStorage } from './layoutStorage';
import { apiClient, getConnection } from '../../system/api.client';
import type { CurrentUser } from '../../api/structures/CurrentUser';
import { useProjects } from './useProjects';
import { useVisibleRange } from './useVisibleRange';
import { useWorkspaceLayout } from './useWorkspaceLayout';
import { MbscCalendarEvent } from '@mobiscroll/react/dist/src/core/shared/calendar-view/calendar-view.types.public';

const DEFAULT_PANES: PanesVisible = { dispatcher: true, calendar: true };

// TODO: the range is the span the test events sit in; make it today's once
// there is real data to show.
const DEFAULT_RANGE: DateRange = {
  start: new Temporal.PlainDate(2026, 8, 1),
  end: new Temporal.PlainDate(2026, 8, 2),
};

export const MainPage = () => {
  const [panes, setPanes] = useState(DEFAULT_PANES);
  const [paneWeights, setPaneWeights] = useState(DEFAULT_PANE_WEIGHTS);
  const [dateFrame, setDateFrame] = useState(DEFAULT_RANGE);

  const [isLoaded, setIsLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    apiClient.user.getCurrentUser(getConnection()).then(setCurrentUser);
  }, []);

  /* Not part of the render gate below: the header and the calendar must not
     wait on a list only the dispatcher shows. Its sections draw empty and
     fill. */
  const { projects, move } = useProjects();

  useEffect(() => {
    Promise.all([
      layoutStorage.getPanes(),
      layoutStorage.getPaneWeights(),
      layoutStorage.getDateFrame(),
    ]).then(([storedPanes, storedWeights, storedDateFrame]) => {
      if (storedPanes) setPanes(storedPanes);
      if (storedWeights) setPaneWeights(storedWeights);
      if (storedDateFrame) setDateFrame(storedDateFrame);
      setIsLoaded(true);
    });
  }, []);

  const showPanes = (next: PanesVisible) => {
    setPanes(next);
    layoutStorage.setPanes(next);
  };

  const goToDateFrame = (next: DateRange) => {
    setDateFrame(next);
    layoutStorage.setDateFrame(next);
  };

  // TODO: expose as user settings.
  const [isDarkModeEnabled] = useState(false);
  const [timeFrame] = useState<[string, string]>(['00:00:00', '24:00:00']);
  const [events] = useState(testEvents);

  const { dayCount, todayRequest, goToPage, goToToday } = useVisibleRange(
    dateFrame,
    goToDateFrame,
  );

  const workspaceRef = useRef<HTMLElement>(null);

  const { rememberWidths, resizePanes, gridTemplateColumns } =
    useWorkspaceLayout(
      workspaceRef,
      {
        isDispatcherVisible: panes.dispatcher,
        isCalendarVisible: panes.calendar,
      },
      paneWeights,
      // Only the drag's own state, not the stored copy: the write waits for
      // `onDragEnd`, so one drag is one write instead of one per pointer move.
      setPaneWeights,
    );

  return (
    <IonPage>
      <IonContent scrollY={false}>
        {isLoaded && currentUser && (
          <div className="main-page-shell" style={layoutCssVariables}>
            <Header
              isDispatcherVisible={panes.dispatcher}
              isCalendarVisible={panes.calendar}
              isDarkModeEnabled={isDarkModeEnabled}
              dateFrame={dateFrame}
              onToggleDispatcher={() =>
                showPanes({ ...panes, dispatcher: !panes.dispatcher })
              }
              onToggleCalendar={() =>
                showPanes({ ...panes, calendar: !panes.calendar })
              }
              onPageChange={goToPage}
              onToday={goToToday}
              onRangeChange={goToDateFrame}
            />

            <main
              className="workspace"
              ref={workspaceRef}
              style={{ gridTemplateColumns }}
            >
              {panes.dispatcher && (
                <Dispatcher
                  currentUser={currentUser}
                  projects={projects}
                  onMove={move}
                />
              )}

              {panes.dispatcher && panes.calendar && (
                <Divider
                  orientation="vertical"
                  onDragStart={rememberWidths}
                  onDrag={resizePanes}
                  onDragEnd={() => layoutStorage.setPaneWeights(paneWeights)}
                />
              )}

              {panes.calendar && (
                <Calendar
                  isDarkModeEnabled={isDarkModeEnabled}
                  pageStart={dateFrame.start}
                  dayCount={dayCount}
                  timeFrame={timeFrame}
                  events={events as MbscCalendarEvent[]}
                  todayRequest={todayRequest}
                  onPageChange={goToPage}
                />
              )}
            </main>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};
