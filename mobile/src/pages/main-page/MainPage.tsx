import { useRef, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Temporal } from 'temporal-polyfill';
import { Calendar } from './calendar/Calendar';
import { useCalendarPaging } from './calendar/useCalendarPaging';
import { Dispatcher } from './dispatcher/Dispatcher';
import { Header } from './header/Header';
import { Divider } from './Divider';
import { testEvents } from './test.data';
import { layoutCssVariables } from './layout-config';
import './MainPage.css';
import { useWorkspaceLayout } from './useWorkspaceLayout';

export const MainPage = () => {
  const [isDispatcherVisible, setIsDispatcherVisible] = useState(true);
  const [isCalendarVisible, setIsCalendarVisible] = useState(true);

  // TODO: expose as user settings.
  const [isDarkModeEnabled] = useState(false);
  const [startDate] = useState(new Temporal.PlainDate(2026, 8, 1));
  const [dayCount] = useState(2);
  const [timeFrame] = useState<[string, string]>(['00:00:00', '24:00:00']);
  const [events] = useState(testEvents);

  const { pageStart, todayRequest, goToPage, goToToday } = useCalendarPaging(
    startDate,
    dayCount,
  );

  const workspaceRef = useRef<HTMLElement>(null);

  const { rememberWidths, resizePanes, gridTemplateColumns } =
    useWorkspaceLayout(workspaceRef, {
      isDispatcherVisible,
      isCalendarVisible,
    });

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div className="main-page-shell" style={layoutCssVariables}>
          <Header
            isDispatcherVisible={isDispatcherVisible}
            isCalendarVisible={isCalendarVisible}
            onToggleDispatcher={() => setIsDispatcherVisible((v) => !v)}
            onToggleCalendar={() => setIsCalendarVisible((v) => !v)}
            onPageChange={goToPage}
            onToday={goToToday}
          />

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
              <Calendar
                isDarkModeEnabled={isDarkModeEnabled}
                pageStart={pageStart}
                dayCount={dayCount}
                timeFrame={timeFrame}
                events={events}
                todayRequest={todayRequest}
                onPageChange={goToPage}
              />
            )}
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};
