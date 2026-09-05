/* TEMPORARY — diagnostic for the post-drop jump. Delete once that is fixed.

   Off unless the URL carries `?droptrace=1`. Records where the dragged row sits
   on every frame after release and prints it into the page, because there is no
   console on a device and a screenshot cannot resolve a one-frame artefact. */

const FRAMES = 40;
const PANEL_ID = 'drop-trace-panel';
const FLAG = 'droptrace';

/* Read at module load, because the router drops the query string before the
   first drop ever happens. `?droptrace=1` turns it on, `?droptrace=0` off, and
   it then persists — which is what makes it usable on a device. */
const readFlag = () => {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(FLAG);
    if (fromUrl !== null) window.localStorage.setItem(FLAG, fromUrl);
    return window.localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
};

const enabled = typeof window === 'undefined' ? false : readFlag();

export const dropTraceEnabled = () => enabled;

const panel = () => {
  let node = document.getElementById(PANEL_ID);
  if (node) return node;

  node = document.createElement('pre');
  node.id = PANEL_ID;
  node.style.cssText = [
    'position:fixed',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:2147483647',
    'margin:0',
    'max-height:40vh',
    'overflow:auto',
    'background:rgba(0,0,0,.85)',
    'color:#0f0',
    'font:11px/1.35 ui-monospace,monospace',
    'padding:8px',
    'white-space:pre-wrap',
  ].join(';');
  document.body.appendChild(node);

  return node;
};

export const traceDrop = (projectId: string) => {
  if (!dropTraceEnabled()) return;

  const startedAt = performance.now();

  /* `top` alone cannot tell a moving row from a scrolling container. `offsetTop`
     is the layout position and ignores scrolling; `scrollTop` is the container.
     Whichever of those two changes is the one actually animating. */
  const sample = () => {
    const row = [...document.querySelectorAll(`[data-project-id="${projectId}"]`)].find(
      (node) => !node.hasAttribute('data-dnd-placeholder'),
    ) as HTMLElement | undefined;

    const scroller = row?.closest('.section-body') as HTMLElement | null;

    const style = row ? getComputedStyle(row) : null;

    return {
      top: row ? Math.round(row.getBoundingClientRect().top) : null,
      offset: row ? Math.round(row.offsetTop) : null,
      scroll: scroller ? Math.round(scroller.scrollTop) : null,
      transform: style?.transform ?? null,
      translate: style?.translate ?? null,
      running: row
        ? row.getAnimations({ subtree: false }).map((animation) => {
            const timing = animation.effect?.getTiming?.();
            const label =
              (animation as { animationName?: string }).animationName ??
              (animation as { transitionProperty?: string }).transitionProperty ??
              animation.constructor.name;

            return `${label}@${String(timing?.duration ?? '?')}ms`;
          })
        : [],
    };
  };

  const samples: ReturnType<typeof sample>[] = [];
  const attributes: string[] = [];

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const name = record.attributeName ?? '';
      if (!name.startsWith('data-dnd')) continue;

      const value = (record.target as Element).getAttribute(name);
      attributes.push(
        `${Math.round(performance.now() - startedAt)}ms ${name}=${value}`,
      );
    }
  });

  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-dnd-dragging',
      'data-dnd-dropping',
      'data-dnd-placeholder',
    ],
  });

  const step = () => {
    samples.push(sample());

    if (samples.length < FRAMES) {
      requestAnimationFrame(step);
      return;
    }

    observer.disconnect();

    const series = (key: 'top' | 'offset' | 'scroll') =>
      samples.map((entry) => entry[key]).join(' ');
    const changes = (key: 'top' | 'offset' | 'scroll') =>
      new Set(samples.map((entry) => entry[key])).size;

    panel().textContent = [
      `drop trace — ${projectId.slice(0, 8)}`,
      `top    (${changes('top')}): ${series('top')}`,
      `offset (${changes('offset')}): ${series('offset')}`,
      `scroll (${changes('scroll')}): ${series('scroll')}`,
      `transform: ${[...new Set(samples.map((entry) => entry.transform))].join(' | ')}`,
      `translate: ${[...new Set(samples.map((entry) => entry.translate))].join(' | ')}`,
      `running: ${[...new Set(samples.flatMap((entry) => entry.running))].join(' | ') || 'none'}`,
      `attributes: ${attributes.length ? attributes.join(' | ') : 'none'}`,
      '',
    ].join('\n');
  };

  requestAnimationFrame(step);
};
