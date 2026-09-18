/* Records the device's zone when the timeline does not already account for it.
 *
 * Returns the zone to tell the user about, or null when there is nothing to
 * say — a first-ever change is a baseline, not a move. See docs/timezone.md.
 */

import { getDeviceId } from '../../system/device-storage/deviceId';
import { timezoneChanges } from './api/timezoneChanges';
import { canonicalZone, deviceZone, settledZone } from './helpers';
import { zoneAtMoment } from './useTimezone';

let recordInFlight: Promise<string | null> | null = null;

const onlyOneRecordAtATime = (run: () => Promise<string | null>) => {
  recordInFlight ??= run().finally(() => {
    recordInFlight = null;
  });

  return recordInFlight;
};

export const recordDeviceZone = (): Promise<string | null> =>
  onlyOneRecordAtATime(async () => {
    const zoneReadNow = deviceZone();

    const history = await timezoneChanges.getHistory();
    const zoneOnTimeline = zoneAtMoment(history, new Date());

    if (
      zoneOnTimeline !== null &&
      canonicalZone(zoneOnTimeline) === zoneReadNow
    )
      return null;

    const zoneToRecord = await settledZone(zoneReadNow, deviceZone);

    if (zoneToRecord === null) {
      console.warn('Device zone never settled, nothing recorded', {
        firstReading: zoneReadNow,
      });

      return null;
    }
    if (
      zoneOnTimeline !== null &&
      canonicalZone(zoneOnTimeline) === zoneToRecord
    )
      return null;

    await timezoneChanges.create({
      ianaTimezone: zoneToRecord,
      changesAt: new Date().toISOString(),
      deviceId: await getDeviceId(),
    });

    const timelineWasEmpty = zoneOnTimeline === null;

    return timelineWasEmpty ? null : zoneToRecord;
  });
