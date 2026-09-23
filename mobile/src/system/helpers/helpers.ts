export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function isDefined<T>(val: T | undefined | null): val is T {
  return val !== undefined && val !== null;
}
