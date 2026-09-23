import { useEffect, useRef, useState } from 'react';
import { TimezoneWatcher } from '../../features/timezone/TimezoneWatcher';
import { IonContent, IonPage } from '@ionic/react';
import { Temporal } from 'temporal-polyfill';
import { Calendar } from './calendar/Calendar';
import { Dispatcher } from './dispatcher/Dispatcher';
import { Header } from './header/Header';
import { Divider } from './Divider';
import { DEFAULT_PANE_WEIGHTS, layoutCssVariables } from './layout-config';
import './MainPage.css';
import type { DateRange } from '../../system/helpers/dateRange';
import type { PanesVisible } from './layoutStorage';
import { layoutStorage } from './layoutStorage';
import { apiClient, getConnection } from '../../system/api.client';
import type { CurrentUser } from '../../api/sdk/structures/CurrentUser';
import { useVisibleRange } from './useVisibleRange';
import { useWorkspaceLayout } from './useWorkspaceLayout';
import { spreadProjectsToEvents } from '../../features/projects-spread/spread.projects.to.events';
import { useProjectsHotReload } from '../../api/project';
import { useEventsInRangeHotReload } from '../../api/event';
import { useTimezone } from '../../features/timezone/useTimezone';

const DEFAULT_PANES: PanesVisible = { dispatcher: true, calendar: true };

const defaultDateFrame = (): DateRange => {
  const today = Temporal.Now.plainDateISO();

  return { start: today, end: today.add({ days: 1 }) };
};

export const MainPage = () => {
  const [panes, setPanes] = useState(DEFAULT_PANES);
  const [paneWeights, setPaneWeights] = useState(DEFAULT_PANE_WEIGHTS);
  const [dateFrame, setDateFrame] = useState(defaultDateFrame);

  const [isLoaded, setIsLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    apiClient.user.getCurrentUser(getConnection()).then(setCurrentUser);
  }, []);

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

  const { dayCount, todayRequest, goToPage, goToToday } = useVisibleRange(
    dateFrame,
    goToDateFrame,
  );

  const workspaceRef = useRef<HTMLElement>(null);

  const projects = useProjectsHotReload();
  const frameEvents = useEventsInRangeHotReload(dateFrame.start, dateFrame.end);
  const { history } = useTimezone();

  const events = spreadProjectsToEvents(
    projects,
    frameEvents,
    [dateFrame.start, dateFrame.end],
    history,
  );

  const { rememberWidths, resizePanes, gridTemplateColumns } =
    useWorkspaceLayout(
      workspaceRef,
      {
        isDispatcherVisible: panes.dispatcher,
        isCalendarVisible: panes.calendar,
      },
      paneWeights,
      setPaneWeights,
    );

  return (
    <IonPage>
      <IonContent scrollY={false}>
        {isLoaded && currentUser && (
          <div className="main-page-shell" style={layoutCssVariables}>
            <TimezoneWatcher />
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
              {panes.dispatcher && <Dispatcher currentUser={currentUser} />}

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
                  events={events}
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
