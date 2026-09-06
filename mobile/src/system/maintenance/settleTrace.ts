/* Records where an element goes on every frame after an interaction and prints
   the result into the page.

   For the class of bug a screenshot cannot show and a console cannot reach: a
   one-frame flash, an animation nobody asked for, a row that lands twice. There
   is no console on a device, and reading a library's source is not evidence —
   this exists because doing that twice produced two confident wrong answers
   about a drag animation that was running the whole time.

   Off unless turned on: `?trace=1` in the URL, which persists so a router
   dropping the query string does not disable it. `?trace=0` turns it off.
   Callers guard on `import.meta.env.DEV`, and nothing here runs at module load,
   so the whole file drops out of a production build.

   Reading the output: `offset` is the layout position and ignores scrolling and
   transforms, `scroll` is the container, `top` is what is actually painted. If
   `top` moves while `offset` and `scroll` hold still, something is animating a
   transform — and `running` names it. */

const FRAMES = 40;
const PANEL_ID = 'settle-trace-panel';
const FLAGS = ['trace', 'droptrace'];

const readFlag = () => {
  try {
    const params = new URLSearchParams(window.location.search);

    for (const flag of FLAGS) {
      const value = params.get(flag);
      if (value !== null) window.localStorage.setItem(flag, value);
    }

    return FLAGS.some((flag) => window.localStorage.getItem(flag) === '1');
  } catch {
    return false;
  }
};

/* Read on first use rather than at module load: a side effect up here would
   anchor the module and stop it being tree-shaken out of production. */
let enabled: boolean | null = null;

const isEnabled = () => {
  if (enabled === null)
    enabled = typeof window === 'undefined' ? false : readFlag();
  return enabled;
};

const panel = () => {
  const existing = document.getElementById(PANEL_ID);
  if (existing) return existing;

  const node = document.createElement('pre');
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

export const traceSettle = (label: string, find: () => Element | null) => {
  if (!isEnabled()) return;

  const startedAt = performance.now();

  const sample = () => {
    const element = find() as HTMLElement | null;
    const scroller = element?.closest('[data-trace-scroller], .section-body');
    const style = element ? getComputedStyle(element) : null;

    return {
      top: element ? Math.round(element.getBoundingClientRect().top) : null,
      offset: element ? Math.round(element.offsetTop) : null,
      scroll: scroller ? Math.round(scroller.scrollTop) : null,
      transform: style?.transform ?? null,
      translate: style?.translate ?? null,
      running: element
        ? element.getAnimations({ subtree: false }).map((animation) => {
            const timing = animation.effect?.getTiming?.();
            const name =
              (animation as { animationName?: string }).animationName ??
              (animation as { transitionProperty?: string })
                .transitionProperty ??
              animation.constructor.name;

            return `${name}@${String(timing?.duration ?? '?')}ms`;
          })
        : [],
    };
  };

  const samples: ReturnType<typeof sample>[] = [];
  const attributes: string[] = [];

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const name = record.attributeName;
      if (!name) continue;

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
    const distinct = (key: 'top' | 'offset' | 'scroll') =>
      new Set(samples.map((entry) => entry[key])).size;
    const unique = (key: 'transform' | 'translate') => [
      ...new Set(samples.map((entry) => entry[key])),
    ];

    panel().textContent = [
      `settle trace — ${label}`,
      `top    (${distinct('top')}): ${series('top')}`,
      `offset (${distinct('offset')}): ${series('offset')}`,
      `scroll (${distinct('scroll')}): ${series('scroll')}`,
      `transform: ${unique('transform').join(' | ')}`,
      `translate: ${unique('translate').join(' | ')}`,
      `running: ${[...new Set(samples.flatMap((entry) => entry.running))].join(' | ') || 'none'}`,
      `attributes: ${attributes.length ? attributes.join(' | ') : 'none'}`,
      '',
    ].join('\n');
  };

  requestAnimationFrame(step);
};
