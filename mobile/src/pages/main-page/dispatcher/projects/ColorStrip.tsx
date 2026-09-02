import './ColorStrip.css';

type ColorStripProps = {
  hexCode: string | null;
  // A root project carries a broad band; anything nested carries a hairline.
  isNested: boolean;
};

// Always rendered, even with no colour
export const ColorStrip = ({ hexCode, isNested }: ColorStripProps) => (
  <span
    className={isNested ? 'color-strip color-strip-nested' : 'color-strip'}
    style={hexCode ? { background: hexCode } : undefined}
    aria-hidden="true"
  />
);
