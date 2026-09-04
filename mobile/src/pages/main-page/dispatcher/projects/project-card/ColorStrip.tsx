import './ColorStrip.css';

type ColorStripProps = {
  hexCode: string | null;
  isInherited: boolean;
};

export const ColorStrip = ({ hexCode, isInherited }: ColorStripProps) => (
  <span
    className={isInherited ? 'color-strip color-strip-inherited' : 'color-strip'}
    style={hexCode ? { background: hexCode } : undefined}
    aria-hidden="true"
  />
);
