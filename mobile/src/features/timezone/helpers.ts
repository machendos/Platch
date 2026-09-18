/* Reading and naming a zone.
 *
 * Zone ids are normalised before any comparison: ICU resolves some aliases
 * differently between versions (Europe/Kyiv vs Europe/Kiev). See
 * docs/timezone.md.
 */

const canonicalZoneCache = new Map<string, string>();

export const canonicalZone = (zone: string) => {
  const known = canonicalZoneCache.get(zone);
  if (known !== undefined) return known;

  const resolved = new Intl.DateTimeFormat('en', {
    timeZone: zone,
  }).resolvedOptions().timeZone;

  canonicalZoneCache.set(zone, resolved);

  return resolved;
};

export const deviceZone = () =>
  canonicalZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

export const zoneDisplayName = (zone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'longGeneric',
  })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value ?? zone;

export const ZONE_REREAD_DELAY_MS = 4000;
const ZONE_REREAD_ATTEMPTS = 3;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The zone two readings in a row agree on, or null if they never do. */
export const settledZone = async (
  firstReading: string,
  readZone: () => string,
) => {
  let candidate = firstReading;

  for (let attempt = 0; attempt < ZONE_REREAD_ATTEMPTS; attempt += 1) {
    await delay(ZONE_REREAD_DELAY_MS);

    const next = readZone();
    if (next === candidate) return candidate;

    candidate = next;
  }

  return null;
};
