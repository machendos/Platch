import './PaneGroup.css';

import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../../ui/buttons/icon-button/IconButton';
import type { PanesVisible } from '../layoutStorage';

/* Two switches sharing one track, not a segmented control and not a
   radiogroup. Joined geometry conventionally promises "pick one", so the ON
   state has to read as state rather than as position: a raised chip says
   *current*, the accent glyph says *enabled*, and both being on and both being
   raised at rest is what disproves exclusivity before anyone touches it.

   The pair has three legal states, never four. Turning the last one off would
   leave a screen made of nothing, so that button refuses — and says why. A
   silent refusal reads as a broken button, which is the one outcome worse than
   the empty screen it prevents. */

const REFUSAL = 'Keep at least one pane open';
const REFUSAL_MS = 2200;

/* Drawn here rather than taken from lucide: the dispatcher's glyph needs its
   left column *filled*, which is what says the panel is showing rather than
   merely existing, and no icon in either family we carry does that. Both are
   the shapes docs/final-screens.html specifies. 1em so they follow the glyph
   ratio like every other icon. */
const PaneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="1em" height="1em">
    <rect
      x="3.25"
      y="4.75"
      width="17.5"
      height="14.5"
      rx="3.2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="4.6"
      y="6.1"
      width="4.4"
      height="11.8"
      rx="1.6"
      fill="currentColor"
    />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="1em" height="1em">
    <rect
      x="3.25"
      y="5.25"
      width="17.5"
      height="14"
      rx="3.2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M3.25 9.6h17.5" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M8 3.4v3.2M16 3.4v3.2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

type PaneGroupProps = {
  panes: PanesVisible;
  onChange: (panes: PanesVisible) => void;
};

export const PaneGroup = ({ panes, onChange }: PaneGroupProps) => {
  const [refused, setRefused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const toggle = (key: keyof PanesVisible) => {
    const next = { ...panes, [key]: !panes[key] };

    if (!next.dispatcher && !next.calendar) {
      setRefused(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setRefused(false), REFUSAL_MS);
      return;
    }

    setRefused(false);
    onChange(next);
  };

  const isLast = (key: keyof PanesVisible) =>
    panes[key] && !panes[key === 'dispatcher' ? 'calendar' : 'dispatcher'];

  return (
    <div className="pane-group-shell">
      <div className="pane-group">
        <IconButton
          label="Show tasks"
          size="medium"
          pressed={panes.dispatcher}
          unavailable={isLast('dispatcher')}
          onClick={() => toggle('dispatcher')}
        >
          <PaneIcon />
        </IconButton>
        <IconButton
          label="Show calendar"
          size="medium"
          pressed={panes.calendar}
          unavailable={isLast('calendar')}
          onClick={() => toggle('calendar')}
        >
          <CalendarIcon />
        </IconButton>
      </div>

      {/* Out of flow on purpose: a reason that pushed the toolbar sideways
          would move every control the moment one of them refused. */}
      <span className="pane-group-refusal" role="status" aria-live="polite">
        {refused ? REFUSAL : ''}
      </span>
    </div>
  );
};
