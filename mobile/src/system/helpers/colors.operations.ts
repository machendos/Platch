type RGB = {
  r: number;
  g: number;
  b: number;
};

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '');

  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  const value = parseInt(full, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance({ r, g, b }: RGB): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export function getTextColorForBackground(
  backgroundColor: string,
): '#000000' | '#ffffff' {
  const bgLuminance = getRelativeLuminance(hexToRgb(backgroundColor));

  const blackContrast = getContrastRatio(bgLuminance, 0);
  const whiteContrast = getContrastRatio(bgLuminance, 1);

  return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
}
