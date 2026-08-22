import { useEffect, useRef, useState } from 'react';

/* Reads the real page rather than a model of it. An earlier attempt measured a
   hand-rolled `overflow-y: auto` div standing in for ion-content, and on iOS
   that div never scrolled at all — the document did — so its sticky test never
   ran and its numbers described nothing.

   Two placement constraints, both learned the hard way: rendered as a sibling
   of IonContent, because a `position: fixed` element inside the scroller
   scrolls away with the content; and parked in the middle of the screen,
   because the bottom is under the keyboard exactly when a field has focus and
   the top is where the thing being measured lives. */

type Reading = {
  barTop: number;
  barBottom: number;
  contentTop: number;
  clearance: number;
  scrollTop: number;
  docScrollTop: number;
  offsetTop: number;
  innerH: number;
  clientH: number;
};

const read = (): Reading | null => {
  const bar = document.querySelector('.rich-toolbar');
  const content = document.querySelector('ion-content');
  if (!bar || !content) return null;

  const b = bar.getBoundingClientRect();
  const c = content.getBoundingClientRect();
  const scroller = content.shadowRoot?.querySelector('.inner-scroll');

  return {
    barTop: Math.round(b.top),
    barBottom: Math.round(b.bottom),
    contentTop: Math.round(c.top),
    clearance: Math.round(b.top - c.top),
    scrollTop: Math.round((scroller as HTMLElement | null)?.scrollTop ?? -1),
    docScrollTop: Math.round(document.scrollingElement?.scrollTop ?? -1),
    offsetTop: Math.round(window.visualViewport?.offsetTop ?? -1),
    innerH: Math.round(window.innerHeight),
    clientH: Math.round(document.documentElement.clientHeight),
  };
};

const show = (r: Reading) =>
  [
    `bar ${r.barTop}..${r.barBottom}  content ${r.contentTop}`,
    `clearance ${r.clearance}`,
    `scroll ${r.scrollTop}  doc ${r.docScrollTop}`,
    `vvTop ${r.offsetTop}  inner ${r.innerH}  client ${r.clientH}`,
  ].join('\n');

export const ToolbarProbe = () => {
  const [text, setText] = useState('focus a Context field');
  // Kept so the interaction can happen under the keyboard and be read after.
  const worst = useRef<Reading | null>(null);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = read();
      if (!now) return setText('focus a Context field');

      // barTop is the criterion now: below 0 means off the top of the screen.
      if (!worst.current || now.barTop < worst.current.barTop) {
        worst.current = now;
      }

      setText(
        `NOW\n${show(now)}\n\nWORST bar.top ${worst.current.barTop} ${worst.current.barTop < 0 ? 'CLIPPED' : 'ok'}\n${show(worst.current)}`,
      );
    }, 150);

    return () => clearInterval(tick);
  }, []);

  return (
    <pre
      onClick={() => {
        worst.current = null;
      }}
      style={{
        position: 'fixed',
        top: '32%',
        left: 0,
        zIndex: 99999,
        margin: 0,
        padding: '5px 7px',
        background: 'rgba(255, 255, 200, 0.94)',
        border: '2px solid #000',
        borderRadius: '0 8px 8px 0',
        font: '10px/1.35 ui-monospace, Menlo, monospace',
        whiteSpace: 'pre',
      }}
    >
      {text}
    </pre>
  );
};
