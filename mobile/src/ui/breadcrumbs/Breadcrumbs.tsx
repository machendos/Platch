import './Breadcrumbs.css';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { IonPopover } from '@ionic/react';
import { planBreadcrumbs } from './breadcrumbLayout';
import { buildAncestry } from './projectAncestry';
import type { ProjectCrumb } from './projectAncestry';

export type { ProjectCrumb } from './projectAncestry';

export type BreadcrumbItem = {
  id: string;
  label: ReactNode;
};

type BreadcrumbsProps = {
  projects: ProjectCrumb[];
  parentProjectId: string | null;
  currentEntityName: ReactNode;
  onSelect: (id: string | null) => void;
  className?: string;
};

/* The entity has no id — it may not even be saved yet — so inside the row it
   carries a private one, for a React key and for the cursor. It is translated
   back to `null` before it ever reaches a caller. */
const CURRENT_ID = 'breadcrumbs-current-entity';

type Metrics = {
  naturalWidths: number[];
  separatorWidth: number;
  ellipsisWidth: number;
};

// Reaching a hidden node is the only thing anyone wants from one, and selecting
// it makes it current — which makes it visible by definition. So the `…` opens
// the nodes it hides rather than expanding in place: one tap instead of two,
// and no window state to reset.
const CollapsedCrumbs = ({
  items,
  onSelect,
}: {
  items: BreadcrumbItem[];
  onSelect: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerId = `breadcrumbs-more-${useId().replace(/[^\w-]/g, '')}`;

  return (
    <>
      <button
        id={triggerId}
        className="breadcrumbs-ellipsis"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Show ${items.length} hidden ${items.length === 1 ? 'level' : 'levels'}`}
      >
        …
      </button>

      <IonPopover
        className="breadcrumbs-popover"
        mode="ios"
        trigger={triggerId}
        side="bottom"
        alignment="start"
        arrow={false}
        dismissOnSelect
        onWillPresent={() => setIsOpen(true)}
        onDidDismiss={() => setIsOpen(false)}
      >
        <div className="breadcrumbs-popover-list">
          {items.map((item) => (
            <button
              key={item.id}
              className="breadcrumbs-popover-item"
              type="button"
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </IonPopover>
    </>
  );
};

export const Breadcrumbs = ({
  projects,
  parentProjectId,
  currentEntityName,
  onSelect,
  className,
}: BreadcrumbsProps) => {
  const container = useRef<HTMLElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [cursorId, setCursorId] = useState<string>(CURRENT_ID);

  /* Resolving the path is the row's own job: a caller hands it the tree and
     the parent, not a finished list. The entity is appended rather than looked
     up, because it is not in the tree — it may not be saved yet. */
  const items = useMemo<BreadcrumbItem[]>(
    () => [
      ...buildAncestry(projects, parentProjectId),
      { id: CURRENT_ID, label: currentEntityName },
    ],
    [projects, parentProjectId, currentEntityName],
  );

  /* The path and the cursor are two different things, which is the whole point
     of this row: the path stays whole and the cursor moves along it, so
     stepping up to a parent leaves every child still rendered and still a link
     (docs/ui-primitives.md). Welding the cursor to the leaf instead makes
     moving up a one-way trip.

     The cursor lives here because navigating the row is the row's job — a
     caller is only told where the reader went. It needs no reset: a modal
     opened on a different record remounts with a `key`, the same discipline
     useFormState's baseline depends on. */
  const cursorIndex = items.findIndex((item) => item.id === cursorId);
  const currentIndex = cursorIndex === -1 ? items.length - 1 : cursorIndex;

  const select = (id: string) => {
    setCursorId(id);
    onSelect(id === CURRENT_ID ? null : id);
  };

  // Labels are ReactNode and may hold icons, so their widths cannot be computed
  // from the text — they have to be rendered and read. The mirror renders every
  // label at its natural width, carrying the same classes as the real row so a
  // bold current node is measured bold.
  useLayoutEffect(() => {
    const row = mirror.current;
    if (!row) return;

    const width = (selector: string) =>
      row.querySelector(selector)?.getBoundingClientRect().width ?? 0;

    setMetrics({
      naturalWidths: [...row.querySelectorAll('[data-mirror="label"]')].map(
        (label) => label.getBoundingClientRect().width,
      ),
      separatorWidth: width('[data-mirror="separator"]'),
      ellipsisWidth: width('[data-mirror="ellipsis"]'),
    });
    // `available` is a dependency because a modal presents asynchronously: the
    // first measurement runs against an unlaid-out row and reads zeroes, and
    // the width arriving is the signal that real geometry now exists.
  }, [items, available]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    const observer = new ResizeObserver(() =>
      setAvailable(element.clientWidth),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const slots = useMemo(() => {
    if (!metrics || available <= 0) return null;

    return planBreadcrumbs({
      count: items.length,
      currentIndex,
      naturalWidths: metrics.naturalWidths,
      separatorWidth: metrics.separatorWidth,
      ellipsisWidth: metrics.ellipsisWidth,
      available,
    });
  }, [items.length, currentIndex, metrics, available]);

  // Before the first measurement there is nothing to plan from, so the whole
  // path renders uncapped and the container clips it for one frame.
  const planned =
    slots ??
    items.map((_, index) => ({ kind: 'item' as const, index, maxWidth: null }));

  // The cap belongs on the label alone: the plan prices separators as their own
  // slots, so including one in the capped box would truncate labels early by
  // exactly a separator's width.
  const node = (index: number, maxWidth: number | null) => {
    const item = items[index];
    if (!item) return null;

    const style = maxWidth === null ? undefined : { maxWidth };

    return index === currentIndex ? (
      <span className="breadcrumbs-current" aria-current="page" style={style}>
        {item.label}
      </span>
    ) : (
      <button
        className="breadcrumbs-link"
        type="button"
        style={style}
        onClick={() => select(item.id)}
      >
        {item.label}
      </button>
    );
  };

  return (
    <nav
      ref={container}
      className={className ? `breadcrumbs ${className}` : 'breadcrumbs'}
      aria-label="Breadcrumb"
    >
      <ol className="breadcrumbs-list">
        {planned.map((slot, position) => (
          <li
            key={
              slot.kind === 'item'
                ? items[slot.index]?.id
                : `collapsed-${slot.indices[0]}`
            }
            className="breadcrumbs-item"
          >
            {position > 0 && (
              <span className="breadcrumbs-separator" aria-hidden="true">
                /
              </span>
            )}

            {slot.kind === 'item' ? (
              node(slot.index, slot.maxWidth)
            ) : (
              <CollapsedCrumbs
                items={slot.indices.map((index) => items[index])}
                onSelect={select}
              />
            )}
          </li>
        ))}
      </ol>

      <div className="breadcrumbs-mirror" ref={mirror} aria-hidden="true">
        {items.map((item, index) => (
          <span
            key={item.id}
            data-mirror="label"
            className={
              index === currentIndex
                ? 'breadcrumbs-current'
                : 'breadcrumbs-link'
            }
          >
            {item.label}
          </span>
        ))}
        <span data-mirror="separator" className="breadcrumbs-separator">
          /
        </span>
        <span data-mirror="ellipsis" className="breadcrumbs-ellipsis">
          …
        </span>
      </div>
    </nav>
  );
};
