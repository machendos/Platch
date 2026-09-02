// Referenced by `test.setupFiles` in vite.config.ts. Adds the extra DOM
// matchers (toBeInTheDocument, toHaveClass, ...) to expect().
import '@testing-library/jest-dom';

/* jsdom implements no scrolling, and `Reveal`'s `intoView` asks for some on
   every frame of an opening panel. Unstubbed it throws inside the rAF
   callback, which vitest reports as an unhandled error and warns can mask real
   failures — so it is a no-op here rather than absent. */
Element.prototype.scrollIntoView = () => {};
