// Referenced by `test.setupFiles` in vite.config.ts. Adds the extra DOM
// matchers (toBeInTheDocument, toHaveClass, ...) to expect().
import '@testing-library/jest-dom';

/* jsdom implements no scrolling, and `Reveal`'s `intoView` asks for some on
   every frame of an opening panel. Unstubbed it throws inside the rAF
   callback, which vitest reports as an unhandled error and warns can mask real
   failures — so it is a no-op here rather than absent. */
Element.prototype.scrollIntoView = () => {};

/* jsdom implements no ResizeObserver, and @dnd-kit/dom constructs one as soon
   as it is imported — so a component that merely renders a sortable row fails
   to load without this, before a single assertion runs. */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver;

/* jsdom implements no PointerEvent either, and @dnd-kit's sensor guards with
   `event instanceof PointerEvent` — which throws outright when the right-hand
   side is undefined, rather than returning false. Any click on a row that
   carries a sortable takes the whole suite down with it. */
class PointerEventStub extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;

  constructor(type: string, params: PointerEventInit = {}) {
    super(type, params);
    this.pointerId = params.pointerId ?? 0;
    this.pointerType = params.pointerType ?? '';
    this.isPrimary = params.isPrimary ?? false;
  }
}

globalThis.PointerEvent ??= PointerEventStub as unknown as typeof PointerEvent;
