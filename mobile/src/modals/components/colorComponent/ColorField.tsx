import './ColorField.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { checkmark } from 'ionicons/icons';
import { Checkbox } from '../../../ui/checkbox/Checkbox';
import { Reveal } from '../../../ui/reveal/Reveal';
import { Warning } from '../../../ui/warning/Warning';
import { useOutsideClose } from '../useOutsideClose';
import { apiClient, getConnection } from '../../../system/api.client';
import { projectName } from '../../../config/labels';

export type ProjectColor = {
  id: string;
  hexCode: string;
  placement: number;
};

type ColorFieldProps = {
  ownColorId: string | null;
  inheritedColorId?: string | null;
  onChange: (colorId: string | null) => void;
  editable: boolean;
};

const swatchStyle = (hexCode: string) =>
  ({ '--swatch': hexCode }) as CSSProperties;

/* Two names then a count. Naming every project would make the longest warning
   the one nobody reads, and the count still says how much is being shared. */
const NAMED_IN_WARNING = 2;

export const alsoUsedIn = (names: string[]): string | null => {
  if (names.length === 0) return null;

  const shown = names.slice(0, NAMED_IN_WARNING).join(', ');
  const rest = names.length - NAMED_IN_WARNING;

  return rest > 0 ? `Also used in ${shown}, +${rest}` : `Also used in ${shown}`;
};

export const ColorField = ({
  ownColorId,
  onChange,
  editable,
  inheritedColorId = null,
}: ColorFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [colors, setColors] = useState<
    Array<ProjectColor & { projects: { id: string; name: string | null }[] }>
  >([]);
  const root = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);
  useOutsideClose(root, isOpen, close);

  const byId = (id: string | null) =>
    id === null ? null : (colors.find((c) => c.id === id) ?? null);

  const own = byId(ownColorId);
  const inherited = byId(inheritedColorId);
  const shown = own ?? inherited;

  const sharedWith = alsoUsedIn(
    (own?.projects ?? []).map(({ name }) => projectName(name)),
  );

  const setUnique = (wanted: boolean) => {
    onChange(wanted ? (inheritedColorId ?? colors[0]?.id ?? null) : null);
    setIsOpen(wanted);
  };

  const pick = (colorId: string) => {
    onChange(colorId);
    setIsOpen(false);
  };

  useEffect(() => {
    apiClient.project.colors.getColors(getConnection()).then(setColors);
  }, []);

  return (
    <div className="color-block" ref={root}>
      <div className="color-row">
        {editable && inheritedColorId ? (
          <Checkbox
            /* Owning a colour is the whole of it — `colorId` is null to
               inherit and set to own, so there is nothing else to ask. It read
               `ownColorId !== inheritedColorId` once, which is a different
               claim and a self-defeating one: ticking seeds the inherited
               colour, so the value coming back made the box untick itself with
               the palette open underneath. It also misread a project that
               deliberately owns the same colour as its parent, where unticking
               would have cleared a colour somebody chose. */
            checked={ownColorId !== null}
            onChange={setUnique}
            label="Unique color"
          />
        ) : (
          <span className="color-label">Color</span>
        )}

        <button
          className={isOpen ? 'color-chip color-chip-open' : 'color-chip'}
          type="button"
          disabled={!editable}
          aria-label="Project color"
          aria-expanded={editable ? isOpen : undefined}
          onClick={() => setIsOpen((open) => !open)}
        >
          {shown ? (
            <span
              className="color-swatch"
              style={swatchStyle(shown.hexCode)}
              aria-hidden="true"
            />
          ) : (
            <span
              className="color-swatch color-swatch-empty"
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      <Reveal when={isOpen && editable} intoView>
        <div
          className="color-palette"
          role="listbox"
          aria-label="Project color"
        >
          {colors.map((color) => (
            <button
              key={color.id}
              className={[
                'color-option',
                color.id === ownColorId ? 'color-option-selected' : null,
                color.projects.length > 0 ? 'color-option-taken' : null,
              ]
                .filter(Boolean)
                .join(' ')}
              type="button"
              role="option"
              aria-selected={color.id === ownColorId}
              /* The mark is decoration; what a screen reader needs is the
                 sentence the sighted reader gets from the dot. */
              aria-description={
                alsoUsedIn(
                  color.projects.map(({ name }) => projectName(name)),
                ) ?? undefined
              }
              style={swatchStyle(color.hexCode)}
              onClick={() => pick(color.id)}
            >
              {color.id === ownColorId && (
                <IonIcon
                  className="color-option-tick"
                  icon={checkmark}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      </Reveal>

      {sharedWith && <Warning className="color-warning">{sharedWith}</Warning>}
    </div>
  );
};
