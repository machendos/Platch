import './TimeInputLab.css';

import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Temporal } from 'temporal-polyfill';
import { PROJECT_TOTAL_TIME, TIME_OF_DAY } from '../config/timeScales';
import { TimeInput } from '../ui/time-input/TimeInput';
import { armTicks, tick, tickStatus } from '../system/feedback/tick';
import { toTotalMinutes } from '../ui/time-input/timeInputLogic';
import type { TimeInputValue } from '../ui/time-input/timeInputLogic';

const echo = (value: TimeInputValue | null) =>
  value === null
    ? 'null'
    : `${JSON.stringify({
        time: value.time?.toString() ?? null,
        durationMinutes: value.durationMinutes,
      })} — ${toTotalMinutes(value)} total minutes`;

const Case = ({
  title,
  note,
  children,
  value,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
  value: TimeInputValue | null;
}) => (
  <section className="lab-case">
    <h2 className="lab-case-title">{title}</h2>
    <p className="lab-case-note">{note}</p>
    {children}
    <pre className="lab-case-echo" data-testid={title}>
      {echo(value)}
    </pre>
  </section>
);

// Whether a tick was scheduled and whether audio is actually running cannot be
// told apart by listening, and silence has three separate causes: the context
// never leaving `suspended`, the ringer switch, and the level being too low.
const TickProbe = () => {
  const [state, setState] = useState(() => tickStatus());

  return (
    <section className="lab-case">
      <h2 className="lab-case-title">sound probe</h2>
      <p className="lab-case-note">
        Tap Test — if state is not &quot;running&quot; the context never
        unlocked. If it is running and played climbs but you hear nothing, it is
        the silent switch or the level.
      </p>
      <button
        className="lab-button"
        type="button"
        onPointerDown={() => armTicks()}
        onClick={() => {
          tick();
          setState(tickStatus());
        }}
      >
        Test sound
      </button>
      <button
        className="lab-button"
        type="button"
        onClick={() => setState(tickStatus())}
      >
        Refresh
      </button>
      <pre className="lab-case-echo">{JSON.stringify(state, null, 1)}</pre>
    </section>
  );
};

export const TimeInputLab = () => {
  const [duration, setDuration] = useState<TimeInputValue | null>({
    time: null,
    durationMinutes: 210,
  });
  const [empty, setEmpty] = useState<TimeInputValue | null>(null);
  const [offGrid, setOffGrid] = useState<TimeInputValue | null>({
    time: null,
    durationMinutes: 7,
  });
  const [time, setTime] = useState<TimeInputValue | null>(null);

  return (
    <IonPage>
      <IonContent>
        <div className="lab">
          <h1 className="lab-title">TimeInput</h1>

          <TickProbe />

          <Case
            title="duration"
            note="PROJECT_TOTAL_TIME — 1m to 500h, steps widen with the hours"
            value={duration}
          >
            <TimeInput
              mode="duration"
              scale={PROJECT_TOTAL_TIME}
              value={duration}
              onChange={setDuration}
              label="Total time needed"
            />
          </Case>

          <Case
            title="empty"
            note="No value: placeholder until picked, wheels open on the minimum"
            value={empty}
          >
            <TimeInput
              mode="duration"
              scale={PROJECT_TOTAL_TIME}
              value={empty}
              onChange={setEmpty}
              label="Minimum block"
              placeholder="Choose a duration"
            />
          </Case>

          <Case
            title="off-grid"
            note="Stored 7m, which the scale does not allow: shown as-is, wheels open on 5m"
            value={offGrid}
          >
            <TimeInput
              mode="duration"
              scale={PROJECT_TOTAL_TIME}
              value={offGrid}
              onChange={setOffGrid}
              label="Off-grid duration"
            />
          </Case>

          <Case
            title="time"
            note="TIME_OF_DAY — three wheels, 5-minute step, defaults to 9:00 AM"
            value={time}
          >
            <TimeInput
              mode="time"
              scale={TIME_OF_DAY}
              value={time}
              onChange={setTime}
              label="Earliest time"
              placeholder="Any time"
              defaultValue={{
                time: new Temporal.PlainTime(9, 0),
                durationMinutes: null,
              }}
            />
          </Case>
        </div>
      </IonContent>
    </IonPage>
  );
};
